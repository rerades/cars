import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { loadModels } from "../src/lib/data.ts";
import { acme, sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");
const EDITORIAL_URL = "https://github.com/acme/cars/pull/999";
const NOTE = "Acme lo presenta como «SUV» sin tamaño. Criterio: E3.";

describe("«Fuentes» strip and editorial segment (PRD-002 CA-9, CA-14, CA-15, CA-18, CA-20)", () => {
  let root: string;
  let out: string;
  const page = (m: string) => readFileSync(join(out, "marcas", "acme", m, "index.html"), "utf8");
  const header = (html: string) => /<header[^>]*data-ficha-header[\s\S]*?<\/header>/.exec(html)![0];
  const fuentes = (html: string) => /<section[^>]*data-fuentes[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
  const write = (model: string, doc: Record<string, unknown>) => {
    mkdirSync(join(root, "data", "acme"), { recursive: true });
    writeFileSync(join(root, "data", "acme", `${model}.yaml`), stringify(doc));
  };
  const editorial = (extra: Record<string, unknown> = {}) =>
    sourced("suv_compacto", { source_id: "editorial", url: EDITORIAL_URL, retrieved: "2026-10-27", tier: "E", note: NOTE, ...extra });

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-franjas-"));
    // Editorial segment on a model that also has data with a note.
    const edit = acme();
    edit.model = "Edit";
    edit.segment = editorial();
    edit.open_questions = ["PREGUNTA-ABIERTA-UNICA: segmento sin clasificar por la fuente"];
    write("Edit", edit);
    // Only the editorial segment to cite: nothing else carries a note, so there is no «Fuentes» block.
    write("Only", {
      brand: "acme",
      brand_name: "Acme",
      model: "Only",
      status: sourced("on_sale", { url: "https://www.acme.example/status" }),
      segment: editorial(),
      versions: [],
    });
    // Tier E outside `segment` must be dropped, not shown.
    const bad = acme();
    bad.model = "Bad";
    bad.specs.dc_max_kw = editorial({ value: 150 });
    write("Bad", bad);
    write("Volta", acme());
    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: join(root, "data") },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-20: tier E segment says «clasificación editorial», the date and the note verbatim", () => {
    const seg = /<dd[^>]*data-field="segment"[\s\S]*?<\/dd>/.exec(header(page("Edit")))![0];
    assert.match(seg, /clasificación editorial, 27 oct 2026/);
    assert.ok(seg.includes(NOTE.replace(/«/g, "«")), "the note is shown as in the file");
  });

  test("CA-20: no link to the datum url, no «fuente no oficial», not in «Fuentes»", () => {
    const html = page("Edit");
    const seg = /<dd[^>]*data-field="segment"[\s\S]*?<\/dd>/.exec(header(html))![0];
    assert.doesNotMatch(seg, /<a /);
    assert.doesNotMatch(seg, /fuente no oficial/i);
    assert.equal(html.includes(EDITORIAL_URL), false, "the PR url is nowhere in the page");
    assert.ok(fuentes(html).length > 0, "other data still have their block");
    assert.doesNotMatch(fuentes(html), /github\.com/);
  });

  test("CA-20: a model whose only datum is editorial has no «Fuentes» block and no dangling mark", () => {
    const html = page("Only");
    assert.doesNotMatch(html, /data-fuentes|data-source-mark|id="fuente-/);
    assert.match(html, /clasificación editorial, 27 oct 2026/);
  });

  test("CA-20: tier E in any field but `segment` is dropped with a warning", () => {
    const { models } = loadModels(join(root, "data"));
    const bad = models.find((m) => m.model === "Bad")!;
    assert.equal(bad.specs.dc_max_kw, undefined);
    assert.ok(bad.warnings.some((w) => /tier E is only valid in segment/.test(w)));
    assert.doesNotMatch(page("Bad"), /clasificación editorial/);
  });

  test("CA-20: a T1 segment keeps its note mark and no editorial text", () => {
    const html = page("Volta");
    assert.match(header(html), /data-field="segment"[\s\S]*?data-source-mark="1"/);
    assert.doesNotMatch(html, /clasificación editorial/);
  });

  test("CA-9: every «[n]» mark has its li#fuente-n and every li is cited by a mark", () => {
    for (const m of ["Volta", "Edit", "Bad"]) {
      const html = page(m);
      const targets = [...fuentes(html).matchAll(/<li id="fuente-(\d+)"/g)].map((x) => x[1]);
      const marks = new Set([...html.matchAll(/data-source-mark="(\d+)"/g)].map((x) => x[1]));
      for (const n of marks) assert.ok(targets.includes(n!), `${m}: mark ${n} has an entry`);
      for (const n of targets) assert.ok(marks.has(n), `${m}: entry ${n} has a mark`);
    }
  });

  test("CA-14: the HTML carries versions, prices, specs and sources; titles are distinct, with brand and model", () => {
    const html = page("Volta");
    assert.match(html, /Volta 80 AWD/);
    assert.match(html, /47\.500/);
    assert.match(html, /520 km/);
    assert.match(html, /data-fuentes/);
    const title = (h: string) => /<title>([^<]*)<\/title>/.exec(h)![1]!;
    assert.match(title(html), /Acme/);
    assert.match(title(html), /Volta/);
    assert.notEqual(title(html), title(page("Edit")));
  });

  test("CA-15: no cookie and no storage API in the page", () => {
    const html = page("Edit");
    assert.doesNotMatch(html, /document\.cookie|localStorage|sessionStorage|Set-Cookie/i);
  });

  test("CA-18: no `open_questions` text appears in the page", () => {
    assert.doesNotMatch(page("Edit"), /PREGUNTA-ABIERTA-UNICA/);
    assert.doesNotMatch(page("Volta"), /potencia y batería no publicadas en la ficha/);
  });
});
