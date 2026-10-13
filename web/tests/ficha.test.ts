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

const priced = (name: string, value: number | null) => ({
  name,
  price: value === null ? null : { ...sourced(value), unit: "EUR", price_kind: "pvp" },
});
/** Six versions out of price order, with a tie and two without price (more than 5 columns). */
const SHUFFLED_ORDER = ["Cheap", "Tie A", "Tie B", "Dear", "NoPrice 1", "NoPrice 2"];
const shuffled = [
  priced("NoPrice 1", null),
  priced("Dear", 60000),
  priced("Tie A", 40000),
  priced("NoPrice 2", null),
  priced("Tie B", 40000),
  priced("Cheap", 30000),
];

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
    writeModel(data, "acme", "Shuffled", { ...bare("acme", "Acme", "Shuffled"), versions: shuffled });
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

  const section = (html: string) => /<section[^>]*data-ficha-versiones[\s\S]*?<\/section>/.exec(html)![0];
  const headerNames = (html: string) =>
    [...html.matchAll(/<th[^>]*scope="col"[^>]*>([\s\S]*?)<\/th>/g)].map((m) => text(m[1]));
  const blockNames = (html: string) => [...html.matchAll(/<li[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => text(m[1]));

  test("CA-3: versions ordered by price, no-price last, in table and in blocks from the same list", () => {
    const html = section(page("acme", "Volta"));
    const expected = ["Volta 60", "Volta 80 AWD", "Volta GT"];
    assert.deepEqual(headerNames(html), expected);
    assert.deepEqual(blockNames(html), expected);
    assert.match(html, /<h2[^>]*>Versiones<\/h2>/);
    assert.match(html, /aria-labelledby="versiones-titulo"/);
    assert.match(text(html), /Ordenadas por precio, de menor a mayor/);
    assert.match(html, /<caption[^>]*>Versiones de Acme Volta, ordenadas por precio<\/caption>/);
    assert.equal((html.match(/<table\b/g) ?? []).length, 1);
    const [table, blocks] = [/<table[\s\S]*<\/table>/.exec(html)![0], /<ol[\s\S]*<\/ol>/.exec(html)![0]];
    assert.doesNotMatch(table, /\sid=/);
    assert.doesNotMatch(blocks, /\sid=/);
  });

  test("CA-3: the order comes from the price, not the file; ties keep the file order", () => {
    const html = section(page("acme", "Shuffled"));
    assert.deepEqual(headerNames(html), SHUFFLED_ORDER);
    assert.deepEqual(blockNames(html), SHUFFLED_ORDER);
  });

  test("CA-3: more than 5 versions split into tables of at most 5 columns, with part captions", () => {
    const html = section(page("acme", "Shuffled"));
    assert.equal((html.match(/<table\b/g) ?? []).length, 2);
    assert.match(html, /versiones 1 a 5 de 6/);
    assert.match(html, /versiones 6 a 6 de 6/);
  });

  test("CA-3: both presentations are in the HTML and switched by CSS only", () => {
    const html = section(page("acme", "Volta"));
    assert.match(html, /<div[^>]*class="[^"]*\bhidden\b[^"]*\blg:flex\b[^"]*"[^>]*data-versiones-tabla/);
    assert.match(html, /<ol[^>]*class="[^"]*\blg:hidden\b[^"]*"[^>]*data-versiones-bloques/);
  });

  test("CA-11: versions: [] keeps the section and h2, shows the empty text and omits the intro", () => {
    const html = section(page("acme", "Soon"));
    assert.match(html, /<h2[^>]*>Versiones<\/h2>/);
    assert.match(text(html), /Acme todavía no ha publicado las versiones de este modelo\./);
    assert.doesNotMatch(html, /Ordenadas por precio/);
    assert.doesNotMatch(html, /<table|<ol/);
  });

  test("CA-13: breadcrumb before the h1; Coches and brand links point to pages in the build", () => {
    const html = page("acme", "Volta");
    const nav = /<nav[^>]*aria-label="Ruta de navegación"[\s\S]*?<\/nav>/.exec(html)![0];
    assert.ok(html.indexOf(nav) < html.indexOf("<h1"));
    assert.equal((nav.match(/<li\b/g) ?? []).length, 3);
    const hrefs = [...nav.matchAll(/<a[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, ["/coches", "/marcas/acme/"]);
    for (const href of hrefs) assert.ok(existsSync(join(out, href, "index.html")), `${href} has no page`);
    const current = /<li[^>]*aria-current="page"[^>]*>([^<]*)<\/li>/.exec(nav)!;
    assert.equal(current[1], "Volta");
    assert.match(text(nav), /Coches Acme Volta/);
  });

  test("CA-16: «Ver en la web de la marca» is a plain link to status.url, not a button", () => {
    const html = page("acme", "Volta");
    const a = /<a\b[^>]*data-web-marca[^>]*>[\s\S]*?<\/a>/.exec(header(html))![0];
    const url = acme().status.url;
    assert.match(a, new RegExp(`href="${url.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"`));
    assert.match(a, /rel="noopener"/);
    assert.doesNotMatch(a, /target=|role=|\bbtn\b|bg-|border|<svg|<img/);
    assert.doesNotMatch(a, /<button/);
    assert.match(text(a), /^Ver en la web de la marca \(web de Acme, sitio externo\)$/);
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
