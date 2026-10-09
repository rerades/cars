import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { loadModels } from "../src/lib/data.ts";
import { acme, sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");

function writeModel(dir: string, brand: string, model: string, doc: Record<string, any>) {
  mkdirSync(join(dir, brand), { recursive: true });
  writeFileSync(join(dir, brand, `${model}.yaml`), stringify(doc));
}

const bare = (brand: string, brandName: string, model: string, extra: Record<string, any> = {}) => ({
  brand,
  brand_name: brandName,
  model,
  status: sourced("on_sale"),
  versions: [],
  ...extra,
});

const text = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const build = (data: string | null, outDir: string) =>
  execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", outDir], {
    cwd: WEB,
    env: data ? { ...process.env, CARS_DATA_DIR: data } : process.env,
    stdio: "pipe",
  });

describe("/marcas/{marca}/{modelo} model page (fixtures)", () => {
  let root: string;
  let out: string;
  const page = (brand: string, model: string) => readFileSync(join(out, "marcas", brand, model, "index.html"), "utf8");
  const h1 = (html: string) => text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1]);
  const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)![1];
  const header = (html: string) => /<header[^>]*data-ficha-header[\s\S]*?<\/header>/.exec(html)![0];

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-"));
    const data = join(root, "data");
    writeModel(data, "acme", "Volta", acme());
    writeModel(data, "acme", "Soon", {
      ...bare("acme", "Acme", "Soon"),
      status: sourced("announced"),
      launch: sourced("2026-10-15"),
    });
    writeModel(data, "acme", "Later", { ...bare("acme", "Acme", "Later"), status: sourced("announced") });
    writeModel(data, "acme", "Old", { ...bare("acme", "Acme", "Old"), status: sourced("discontinued") });
    writeModel(data, "beta", "Solo", bare("beta", "Beta", "Solo"));
    writeModel(data, "gamma", "Hidden", bare("gamma", "Gamma", "Hidden", { needs_review: true }));
    out = join(root, "out");
    build(data, out);
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-1: one page per published model; h1 and <title> are brand + model, distinct per page", () => {
    assert.equal(h1(page("acme", "Volta")), "Acme Volta");
    assert.equal(title(page("acme", "Volta")), "Acme Volta · siete3");
    const titles = [["acme", "Volta"], ["acme", "Soon"], ["beta", "Solo"]].map(([b, m]) => title(page(b, m)));
    assert.equal(new Set(titles).size, 3);
    assert.equal(existsSync(join(out, "marcas", "gamma", "Hidden")), false); // needs_review: no page
    assert.ok(existsSync(join(out, "marcas", "acme", "index.html"))); // brand page still there
  });

  test("CA-2: segment label in Spanish, or «Segmento por confirmar»", () => {
    assert.match(text(header(page("acme", "Volta"))), /Segmento SUV compacto/);
    assert.match(text(header(page("beta", "Solo"))), /Segmento por confirmar/);
  });

  test("CA-10: a single status label per status, none for on_sale", () => {
    const badge = (m: string) => [...header(page("acme", m)).matchAll(/<span[^>]*data-status[^>]*>([^<]*)<\/span>/g)].map((x) => x[1]);
    assert.deepEqual(badge("Soon"), ["Próximamente · oct 2026"]);
    assert.deepEqual(badge("Later"), ["Próximamente"]);
    assert.deepEqual(badge("Old"), ["Descatalogado"]);
    assert.deepEqual(badge("Volta"), []);
    assert.doesNotMatch(header(page("acme", "Volta")), /Estado/);
  });

  test("RNF-1/RNF-5: no JavaScript, no cookies or storage", () => {
    const html = page("acme", "Volta");
    assert.doesNotMatch(html, /<script\b|localStorage|document\.cookie/i);
  });
});

describe("model pages on the real data", () => {
  let root: string;
  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-real-"));
    build(null, join(root, "out"));
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("model URLs are unique and every /coches card links to an existing page (no 404)", () => {
    const { models } = loadModels();
    assert.ok(models.length > 0);
    const urls = models.map((m) => `/marcas/${m.file.replace(/\.yaml$/, "")}/`);
    assert.equal(new Set(urls).size, urls.length);
    const coches = readFileSync(join(root, "out", "coches", "index.html"), "utf8");
    const hrefs = [...coches.slice(coches.indexOf('id="resultados"')).matchAll(/<h3[\s\S]*?<a[^>]*href="(\/marcas\/[^"]+)"/g)].map((m) => m[1]);
    assert.equal(hrefs.length, models.length);
    for (const href of hrefs) assert.ok(existsSync(join(root, "out", href, "index.html")), `${href} has no page`);
  });
});
