import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { parse, stringify } from "yaml";
import { groupNotes } from "../src/lib/notes.ts";
import { acme, sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");
const text = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/[ \t\r\n]+/g, " ").replace(/ ,/g, ",").trim();

const src = (url: string, extra: Record<string, string> = {}) => ({
  source_id: "acme-es",
  url,
  retrieved: "2026-09-20",
  tier: "T1" as const,
  ...extra,
});

describe("groupNotes (RF-9, CA-9)", () => {
  test("same source_id + url + retrieved + tier -> same note; numbered by first appearance", () => {
    const a = src("https://www.acme.example/a");
    const b = src("https://www.acme.example/b");
    const { notes, numberOf } = groupNotes([a, b, { ...a }, null, { ...b }]);
    assert.deepEqual(notes.map((n) => [n.n, n.url]), [[1, a.url], [2, b.url]]);
    assert.equal(numberOf({ ...a }), 1);
    assert.equal(numberOf({ ...b }), 2);
  });

  test("a different retrieved, source_id or tier makes a different note", () => {
    const a = src("https://www.acme.example/a");
    const { notes } = groupNotes([
      a,
      { ...a, retrieved: "2026-09-21" },
      { ...a, source_id: "other" },
      { ...a, tier: "T3" },
    ]);
    assert.equal(notes.length, 4);
    assert.deepEqual(notes.map((n) => n.unofficial), [false, false, false, true]);
  });

  test("name is the domain without www.; date has a short Spanish month; empty input, no notes", () => {
    const { notes } = groupNotes([src("https://www.cupra.com/es-es/x", { retrieved: "2026-09-24" })]);
    assert.equal(notes[0]!.name, "cupra.com");
    assert.equal(notes[0]!.date, "24 sep 2026");
    assert.deepEqual(groupNotes([null, undefined]).notes, []);
  });
});

describe("notes and «Fuentes» on the model page (RF-8, RF-9, CA-8, CA-9)", () => {
  let root: string;
  let out: string;
  const page = (m: string) => readFileSync(join(out, "marcas", "acme", m, "index.html"), "utf8");
  const header = (html: string) => /<header[^>]*data-ficha-header[\s\S]*?<\/header>/.exec(html)![0];
  const fuentes = (html: string) => /<section[^>]*data-fuentes[\s\S]*?<\/section>/.exec(html)![0];
  const marks = (html: string) => [...html.matchAll(/data-source-mark="(\d+)"/g)].map((m) => m[1]);

  function write(model: string, doc: Record<string, unknown>) {
    mkdirSync(join(root, "data", "acme"), { recursive: true });
    writeFileSync(join(root, "data", "acme", `${model}.yaml`), stringify(doc));
  }
  const base = (name: string, extra: Record<string, unknown>) => ({
    brand: "acme",
    brand_name: "Acme",
    model: name,
    status: sourced("on_sale", { url: "https://www.acme.example/status" }),
    versions: [],
    ...extra,
  });

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-fuentes-"));
    const volta = acme();
    // CA-8 on the price too.
    volta.versions[0].price.note = "precio sin ayudas del Plan MOVES";
    write("Volta", volta);
    write("Soon", base("Soon", {
      status: sourced("announced", { url: "https://www.acme.example/status", note: "presentado en el salón" }),
      launch: sourced("2026-10", { url: "https://www.acme.example/launch", note: "fecha estimada", retrieved: "2026-09-25" }),
      segment: sourced("suv_compacto", { url: "https://es.wikipedia.example/wiki/Soon", tier: "T3", note: "según la prensa" }),
    }));
    // Launch shares status' source, URL, date and tier: one note.
    write("Shared", base("Shared", {
      status: sourced("announced", { url: "https://www.acme.example/status" }),
      launch: sourced("2026-11", { url: "https://www.acme.example/status" }),
    }));
    // On sale, no segment, no versions, no specs: nothing to cite.
    write("Bare", base("Bare", {}));
    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: join(root, "data") },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-9: «Fuentes» is the last block of main, one li#fuente-n per note, with name, date and full url", () => {
    const html = page("Volta");
    const section = fuentes(html);
    assert.match(section, /<h2[^>]*>Fuentes<\/h2>/);
    assert.ok(html.indexOf("data-fuentes") > html.indexOf("data-ficha-modelo"));
    assert.ok(html.indexOf("</main>") > html.lastIndexOf("data-fuentes"));
    const items = [...section.matchAll(/<li id="fuente-(\d+)" tabindex="-1"[\s\S]*?<\/li>/g)];
    assert.deepEqual(items.map((m) => m[1]), ["1", "2"]);
    assert.match(text(items[0]![0]), /^acme\.example, consultado el 20 sep 2026\. https:\/\/www\.acme\.example\/es\/volta$/);
    assert.match(items[1]![0], /<a href="https:\/\/www\.acme\.example\/es\/volta\/ficha"[^>]*>https:\/\/www\.acme\.example\/es\/volta\/ficha<\/a>/);
    assert.doesNotMatch(section, /Fuente no oficial/);
  });

  test("CA-9: every mark points to an existing li, and marks of the same source share a number", () => {
    const html = page("Volta");
    const targets = new Set([...fuentes(html).matchAll(/id="fuente-(\d+)"/g)].map((m) => m[1]));
    const used = marks(html);
    assert.ok(used.length > 10);
    for (const n of used) assert.ok(targets.has(n!), `mark ${n} has a target`);
    for (const a of html.matchAll(/<a href="#fuente-(\d+)"[^>]*aria-label="Fuente (\d+)"[^>]*><span aria-hidden="true">\[(\d+)\]/g)) {
      assert.equal(a[1], a[2]);
      assert.equal(a[1], a[3]);
    }
    // Segment and model data share the same url: the same note.
    assert.match(header(html), /data-source-mark="1"/);
    assert.match(/data-ficha-modelo[\s\S]*?<\/section>/.exec(html)![0], /data-source-mark="1"/);
  });

  test("CA-9: numbering is stable, by order of appearance (header, versions, model data)", () => {
    const html = page("Soon");
    assert.deepEqual(marks(header(html)), ["1", "2", "3"]); // status, launch, segment
    const section = fuentes(html);
    assert.deepEqual([...section.matchAll(/id="fuente-(\d+)"/g)].map((m) => m[1]), ["1", "2", "3"]);
    assert.equal(page("Soon"), html);
  });

  test("CA-9: a non-T1 datum says «fuente no oficial» next to its mark and in its entry; T1 says nothing", () => {
    const html = page("Soon");
    assert.match(header(html), /data-source-mark="3"[^>]*>[\s\S]*?<\/a>\s*<span[^>]*data-unofficial>fuente no oficial<\/span>/);
    assert.equal((header(html).match(/fuente no oficial/g) ?? []).length, 1);
    const items = [...fuentes(html).matchAll(/<li id="fuente-(\d+)"[\s\S]*?<\/li>/g)].map((m) => text(m[0]));
    assert.doesNotMatch(items[0]!, /no oficial/);
    assert.match(items[2]!, /^es\.wikipedia\.example, consultado el 20 sep 2026\. Fuente no oficial\. https:/);
    assert.doesNotMatch(page("Volta"), /fuente no oficial/i);
  });

  test("CA-9: launch sharing the status source gets a single mark", () => {
    const html = page("Shared");
    assert.deepEqual(marks(header(html)), ["1"]);
    assert.equal((fuentes(html).match(/<li /g) ?? []).length, 1);
  });

  test("CA-8: every note is shown verbatim: header, version fields, price and model data", () => {
    const html = page("Soon");
    for (const note of ["presentado en el salón", "fecha estimada", "según la prensa"]) {
      assert.match(text(header(html)), new RegExp(note));
    }
    const volta = page("Volta");
    const t = text(volta);
    assert.match(text(header(volta)), /la web lo presenta como SUV compacto/);
    assert.match(t, /publicado: 299 CV/); // power_kw
    assert.match(t, /la ficha da la capacidad bruta/); // battery_kwh
    assert.match(t, /precio sin ayudas del Plan MOVES/); // price
    assert.match(text(/data-ficha-modelo[\s\S]*?<\/section>/.exec(volta)![0]), /hasta 520 km/); // specs
  });

  test("CA-9: a page with no datum to cite has no «Fuentes» block", () => {
    const html = page("Bare");
    assert.doesNotMatch(html, /data-fuentes|id="fuente-|data-source-mark|>Fuentes</);
  });
});

describe("CA-8 / CA-9 over all the real data", () => {
  test("every data file builds a page where each mark has its entry and every `note` is shown", () => {
    const out = mkdtempSync(join(tmpdir(), "cars-ficha-real-"));
    try {
      execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], { cwd: WEB, stdio: "pipe" });
      const dataDir = join(WEB, "..", "data", "raw");
      let checked = 0;
      for (const brand of readdirSyncSafe(dataDir)) {
        for (const file of readdirSyncSafe(join(dataDir, brand))) {
          if (!file.endsWith(".yaml")) continue;
          const page = join(out, "marcas", brand, file.replace(/\.yaml$/, ""), "index.html");
          let html: string;
          try {
            html = readFileSync(page, "utf8");
          } catch {
            continue; // needs_review: no page
          }
          const targets = new Set([...html.matchAll(/<li id="fuente-(\d+)"/g)].map((m) => m[1]));
          for (const m of html.matchAll(/data-source-mark="(\d+)"/g)) assert.ok(targets.has(m[1]!), `${page}: mark ${m[1]}`);
          assert.equal(targets.size > 0, /data-fuentes/.test(html), `${page}: block only with notes`);
          const visible = text(html.replace(/<script[\s\S]*?<\/script>/g, ""))
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&");
          const doc = parse(readFileSync(join(dataDir, brand, file), "utf8")) as Record<string, any>;
          // Notes of data the page shows. The design shows neither the status of an on-sale model nor
          // a launch that is not announced («Sin etiqueta y sin nota»), so those notes have no place.
          const shown: unknown[] = [];
          const add = (d: any) => d && typeof d === "object" && shown.push(d.note);
          if (doc.status?.value !== "on_sale") add(doc.status);
          if (doc.status?.value === "announced") add(doc.launch);
          add(doc.segment);
          for (const v of doc.versions ?? []) for (const d of Object.values(v)) add(d);
          for (const d of Object.values(doc.specs ?? {})) add(d);
          for (const note of shown) {
            if (typeof note !== "string") continue;
            checked++;
            const escaped = note.replace(/&/g, "&amp;");
            assert.ok(visible.includes(note) || html.includes(escaped), `${page}: note «${note}» is not on the page`);
          }
        }
      }
      assert.ok(checked > 0, "the real data has notes to check");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

import { readdirSync } from "node:fs";
function readdirSyncSafe(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
