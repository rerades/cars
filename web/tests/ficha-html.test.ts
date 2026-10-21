import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { acme, sourced } from "./fixtures.ts";

/**
 * PRD-002 on the served HTML of the model pages (/marcas/{brand}/{model}/):
 * CA-14 (RNF-1), CA-15 (RNF-5) and CA-18 (section 6), plus the "only pregenerated pages" check of #40.
 */
const WEB = join(import.meta.dirname, "..");
const text = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const QUESTION_VOLTA = "Volta GT: potencia y batería no publicadas en la ficha."; // from the Acme example
const QUESTION_SOON = "Pregunta interna zzq-soon: confirmar fecha de entrega con la marca.";
const QUESTION_HIDDEN = "Pregunta interna zzq-hidden: modelo en revisión.";

function writeModel(dir: string, brand: string, model: string, doc: Record<string, any>) {
  mkdirSync(join(dir, brand), { recursive: true });
  writeFileSync(join(dir, brand, `${model}.yaml`), stringify(doc));
}

describe("model pages: served HTML (PRD-002 CA-14, CA-15, CA-18)", () => {
  let root: string;
  let out: string;
  const modelDirs = () => {
    const base = join(out, "marcas");
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .flatMap((b) =>
        readdirSync(join(base, b.name), { withFileTypes: true })
          .filter((m) => m.isDirectory() && existsSync(join(base, b.name, m.name, "index.html")))
          .map((m) => `${b.name}/${m.name}`),
      )
      .sort();
  };
  const page = (key: string) => readFileSync(join(out, "marcas", key, "index.html"), "utf8");
  const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)![1];

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-html-"));
    const data = join(root, "data");
    writeModel(data, "acme", "Volta", acme()); // has open_questions, versions, prices, specs, sources
    writeModel(data, "acme", "Soon", {
      brand: "acme",
      brand_name: "Acme",
      model: "Soon",
      status: sourced("announced"),
      versions: [],
      open_questions: [QUESTION_SOON],
    });
    writeModel(data, "beta", "Hidden", {
      brand: "beta",
      brand_name: "Beta",
      model: "Hidden",
      status: sourced("on_sale"),
      needs_review: true,
      versions: [],
      open_questions: [QUESTION_HIDDEN],
    });
    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("#40: only the pregenerated pages exist; the needs_review model has none", () => {
    assert.deepEqual(modelDirs(), ["acme/Soon", "acme/Volta"]);
  });

  test("CA-14: the HTML alone holds versions, prices, specs and sources", () => {
    const html = page("acme/Volta");
    const t = text(html);
    for (const name of ["Volta 60", "Volta 80 AWD", "Volta GT"]) assert.ok(t.includes(name), name);
    assert.match(t, /39\.990\s?€/);
    assert.match(t, /47\.500\s?€/);
    assert.match(t, /Precio por confirmar/); // Volta GT: null price
    assert.match(t, /Autonomía WLTP máxima del modelo 520 km/); // model-level specs
    assert.match(t, /Carga máxima en CC 150 kW/);
    const fuentes = /<section[^>]*data-fuentes[\s\S]*?<\/section>/.exec(html)![0];
    assert.match(fuentes, /acme\.example/);
    assert.ok([...fuentes.matchAll(/<li\b/g)].length >= 1);
    assert.doesNotMatch(html, /<script\b/i); // nothing paints data on the client
  });

  test("CA-14: an announced model without versions still serves its title and sources, no script", () => {
    const html = page("acme/Soon");
    assert.match(text(html), /Acme todavía no ha publicado las versiones de este modelo\./);
    assert.match(/data-fuentes[\s\S]*?<\/section>/.exec(html)![0], /acme\.example/);
    assert.doesNotMatch(html, /<script\b/i);
  });

  test("CA-14: every title includes brand and model and is different from every other page's", () => {
    const keys = modelDirs();
    const titles = keys.map((k) => title(page(k)));
    assert.equal(new Set(titles).size, keys.length);
    assert.deepEqual(titles, ["Acme Soon · siete3", "Acme Volta · siete3"]);
    for (const k of keys) {
      const [brand, model] = k.split("/");
      assert.ok(title(page(k)).toLowerCase().includes(brand!.toLowerCase()), k);
      assert.ok(title(page(k)).includes(model!), k);
      assert.match(text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(page(k))![1]), new RegExp(`${brand}\\s+${model}`, "i"));
    }
  });

  test("CA-15: no model page has a script, nor any trace of cookies or web storage", () => {
    for (const k of modelDirs()) {
      assert.doesNotMatch(page(k), /<script\b|localStorage|sessionStorage|document\.cookie|set-cookie|indexedDB/i, k);
    }
  });

  test("CA-15: the model page source has no access to cookies or storage either", () => {
    const sources = [
      "src/pages/marcas/[marca]/[modelo].astro",
      "src/components/VersionPrice.astro",
      "src/components/VersionField.astro",
      "src/components/SourceMark.astro",
      "src/components/ModelFigure.astro",
      "src/components/ModelCard.astro",
    ];
    for (const f of sources) {
      const src = readFileSync(join(WEB, f), "utf8");
      assert.doesNotMatch(src, /<script\b|localStorage|sessionStorage|document\.cookie|indexedDB/, f);
    }
  });

  test("CA-18: no open_questions text appears on any page (whole text or its distinctive part)", () => {
    for (const k of modelDirs()) {
      const html = page(k);
      for (const q of [QUESTION_VOLTA, QUESTION_SOON, QUESTION_HIDDEN]) {
        assert.ok(!html.includes(q), `${k}: ${q}`);
        assert.ok(!text(html).includes(q), `${k}: ${q}`);
      }
      assert.doesNotMatch(html, /zzq-|potencia y batería no publicadas|open_questions/, k);
    }
  });
});
