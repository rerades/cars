import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { formatDate, formatEur, sourceName, sourceView } from "../src/lib/format.ts";
import { acme, sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");
const text = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/[ \t\r\n]+/g, " ").replace(/ ,/g, ",").trim();

function writeModel(dir: string, brand: string, model: string, doc: Record<string, any>) {
  mkdirSync(join(dir, brand), { recursive: true });
  writeFileSync(join(dir, brand, `${model}.yaml`), stringify(doc));
}

const TERMS = "Oferta financiada de 47.500 €.\n\nCrédito mínimo de 10.000 € con permanencia de 48 meses.";
const pvp = (name: string, value: number, url = "https://www.acme.example/es/precios") => ({
  name,
  price: sourced(value, { unit: "EUR", price_kind: "pvp", url, retrieved: "2026-09-24" }),
});
const deal = (name: string, value: number) => ({
  name,
  price: sourced(value, {
    unit: "EUR",
    price_kind: "financed",
    price_terms: TERMS,
    price_terms_url: "https://www.acme.example/es/ofertas",
    url: "https://www.acme.example/es/ofertas",
    retrieved: "2026-09-24",
  }),
});
const model = (name: string, status: string, versions: unknown[]) => ({
  brand: "acme",
  brand_name: "Acme",
  model: name,
  status: sourced(status),
  versions,
});

describe("format helpers (RF-4, RF-9)", () => {
  test("formatEur: es-ES, no decimals, non-breaking space before the symbol", () => {
    assert.equal(formatEur(36273), "36.273 €");
    assert.equal(formatEur(36273.6), "36.274 €");
  });
  test("formatDate and sourceName: «24 sep 2026», domain without www.", () => {
    assert.equal(formatDate("2026-09-24"), "24 sep 2026");
    assert.equal(formatDate("nope"), null);
    assert.equal(sourceName("https://www.cupra.com/es-es/coches/tavascan"), "cupra.com");
    assert.equal(sourceName("https://es.wikipedia.org/wiki/X"), "es.wikipedia.org");
    assert.equal(sourceName("not a url"), null);
  });
  test("CA-9: T1 carries no «fuente no oficial»; T3 does", () => {
    const base = { url: "https://www.cupra.com/x", retrieved: "2026-09-24" };
    assert.equal(sourceView({ ...base, tier: "T1" }).unofficial, false);
    assert.equal(sourceView({ ...base, tier: "T3" }).unofficial, true);
  });
});

describe("price of each version on the model page (RF-4, CA-4, CA-9)", () => {
  let root: string;
  let out: string;
  const page = (m: string) => readFileSync(join(out, "marcas", "acme", m, "index.html"), "utf8");
  const versions = (html: string) => /<section[^>]*data-ficha-versiones[\s\S]*?<\/section>/.exec(html)![0];
  const table = (html: string) => /<table[\s\S]*?<\/table>/.exec(versions(html))![0];
  const blocks = (html: string) => /<ol[^>]*data-versiones-bloques[\s\S]*?<\/ol>/.exec(versions(html))![0];
  const prices = (html: string) => [...html.matchAll(/<(?:div)[^>]*data-price="[^"]*"[\s\S]*?<\/div>|<p[^>]*data-price="none"[\s\S]*?<\/p>/g)].map((m) => m[0]);

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-precio-"));
    const data = join(root, "data");
    writeModel(data, "acme", "Volta", acme());
    writeModel(data, "acme", "Plain", model("Plain", "on_sale", [pvp("Plain A", 36273)]));
    writeModel(data, "acme", "Old", model("Old", "discontinued", [pvp("Old A", 20000), { name: "Old B", price: null }]));
    writeModel(data, "acme", "Deals", model("Deals", "on_sale", [pvp("Deals A", 30000), deal("Deals B", 35000), deal("Deals C", 40000)]));
    // A T3 price is not published (ADR-0001, data-model rule 5): the loader drops it.
    writeModel(data, "acme", "Unofficial", model("Unofficial", "on_sale", [
      { name: "Unofficial A", price: sourced(25000, { unit: "EUR", price_kind: "pvp", tier: "T3" }) },
    ]));
    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-4 pvp: «36.273 €» with source domain (linked to price.url) and date; no badge, no terms link", () => {
    const html = page("Plain");
    for (const part of [table(html), blocks(html)]) {
      const t = text(part);
      assert.match(t, /36\.273 €/);
      assert.match(t, /Fuente: acme\.example, 24 sep 2026/);
      assert.match(part, /<a[^>]*href="https:\/\/www\.acme\.example\/es\/precios"[^>]*>acme\.example<\/a>/);
      assert.doesNotMatch(t, /Precio con oferta|Ver condiciones|Último precio publicado/);
    }
    assert.doesNotMatch(html, /data-condiciones/);
    assert.doesNotMatch(html, /Condiciones de las ofertas/);
  });

  test("CA-4 financed: badge, source, link to #condiciones-n and the literal terms once, always visible", () => {
    const html = page("Deals");
    const v = versions(html);
    for (const part of [table(html), blocks(html)]) {
      assert.equal((part.match(/Precio con oferta/g) ?? []).length, 2);
      assert.deepEqual([...part.matchAll(/href="(#condiciones-\d)"/g)].map((m) => m[1]), ["#condiciones-1", "#condiciones-2"]);
      assert.match(text(part), /Ver condiciones de la oferta/);
    }
    assert.equal((v.match(/Condiciones de las ofertas/g) ?? []).length, 1);
    assert.match(v, /<h3[^>]*>Condiciones de las ofertas<\/h3>/);
    const cond = /<div[^>]*data-condiciones[\s\S]*$/.exec(v)![0];
    assert.equal((v.match(/id="condiciones-/g) ?? []).length, 2);
    assert.match(cond, /<li id="condiciones-1" tabindex="-1"/);
    assert.match(cond, /<li id="condiciones-2" tabindex="-1"/);
    assert.match(text(cond), /Deals B Oferta financiada de 47\.500 €\. Crédito mínimo de 10\.000 € con permanencia de 48 meses\. Ver las condiciones en la web de la marca/);
    assert.equal((cond.match(/<p class="whitespace-pre-line">/g) ?? []).length, 4); // two paragraphs per offer
    assert.match(cond, /href="https:\/\/www\.acme\.example\/es\/ofertas"/);
    assert.doesNotMatch(cond, /<details/);
    // The terms block is outside the table and the blocks.
    assert.ok(v.indexOf("data-condiciones") > v.indexOf("</ol>"));
    assert.doesNotMatch(table(html) + blocks(html), /id="condiciones|Oferta financiada/);
  });

  test("CA-4 null: «Precio por confirmar», no source, no badge, no «Último precio publicado»", () => {
    const html = page("Volta");
    const gt = prices(blocks(html)).at(-1)!;
    assert.match(text(gt), /^Precio por confirmar$/);
    assert.doesNotMatch(gt, /<a\b|Fuente/);
    const old = page("Old");
    const oldNone = prices(blocks(old)).at(-1)!;
    assert.match(text(oldNone), /^Precio por confirmar$/);
  });

  test("CA-4 discontinued: «Último precio publicado» on versions with price only, in text", () => {
    const old = page("Old");
    const [first] = prices(blocks(old));
    assert.match(text(first), /^Último precio publicado 20\.000 € /);
    assert.equal((text(blocks(old)).match(/Último precio publicado/g) ?? []).length, 1);
    assert.equal((text(table(old)).match(/Último precio publicado/g) ?? []).length, 1);
    assert.doesNotMatch(text(blocks(page("Plain"))), /Último precio publicado/);
  });

  test("CA-4: prices are in the table's price row and the blocks' dl, in the same order", () => {
    const html = page("Volta");
    assert.match(table(html), /<th scope="row"[^>]*>\s*Precio\s*<\/th>/);
    const amount = (s: string) => [...text(s).matchAll(/\d{2}\.\d{3} €/g)].map((m) => m[0]);
    assert.deepEqual(amount(table(html)), ["39.990 €", "47.500 €"]);
    assert.deepEqual(amount(blocks(html)), ["39.990 €", "47.500 €"]);
  });

  test("CA-9 (price): T1 prices show no «fuente no oficial»; a T3 price is not published", () => {
    assert.doesNotMatch(versions(page("Volta")), /fuente no oficial/);
    const html = versions(page("Unofficial"));
    assert.match(text(html), /Precio por confirmar/);
    assert.doesNotMatch(html, /25\.000|Fuente:/);
  });

});
