import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { leftOut, termsAnchorId } from "../src/lib/rankings.ts";
import { normalize } from "../src/lib/data.ts";
import { sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");
const text = (s: string) =>
  s.replace(/<[^>]*>/g, " ").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").replace(/ ,/g, ",").trim();

const TERMS = "Oferta financiada de 35.000 €.\n\nCrédito mínimo de 10.000 € con permanencia de 48 meses.";
const priceOf = (value: number, kind: "pvp" | "financed") =>
  sourced(value, {
    unit: "EUR",
    price_kind: kind,
    url: "https://www.acme.example/es/precios",
    ...(kind === "financed"
      ? { price_terms: TERMS, price_terms_url: "https://www.acme.example/es/ofertas" }
      : {}),
  });
const car = (name: string, extra: Record<string, unknown> = {}) => ({ name, ...extra });
const doc = (model: string, status: string, versions: unknown[], extra: Record<string, unknown> = {}) => ({
  brand: "acme",
  brand_name: "Acme",
  model,
  status: sourced(status),
  versions,
  ...extra,
});
const battery = (n: number, extra: Record<string, unknown> = {}) =>
  sourced(n, { basis: "usable", ...extra });

function writeModel(dir: string, model: string, d: Record<string, unknown>) {
  mkdirSync(join(dir, "acme"), { recursive: true });
  writeFileSync(join(dir, "acme", `${model}.yaml`), stringify(d));
}

function build(root: string, name: string, write: (data: string) => void): string {
  const data = join(root, `${name}-data`);
  write(data);
  const out = join(root, name);
  execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
    cwd: WEB,
    env: { ...process.env, CARS_DATA_DIR: data },
    stdio: "pipe",
  });
  return out;
}

describe("offer price and terms, left-out count and empty state of the rankings (#373, #374)", () => {
  let root: string;
  let main: string;
  let noBlock: string;
  const page = (out: string, slug: string) => readFileSync(join(out, "rankings", slug, "index.html"), "utf8");
  const places = (html: string) => [...html.matchAll(/<li\b[^>]*data-place=[\s\S]*?<\/li>/g)].map((m) => m[0]);
  const block = (html: string) => /<section[^>]*data-condiciones[\s\S]*?<\/section>/.exec(html)?.[0];

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-rankings-ofertas-"));
    main = build(root, "main", (data) => {
      writeModel(data, "Mix", doc("Mix", "on_sale", [
        car("Mix B", { price: priceOf(35000, "financed"), battery_kwh: battery(61) }),
        car("Mix A", { price: priceOf(30000, "pvp"), battery_kwh: battery(60) }),
        car("Mix C", { price: priceOf(36000, "pvp"), battery_kwh: battery(62) }),
      ]));
      // Battery: 17 ranked, 3 without the figure (omitted, null) and 1 only T3 = 4 left out.
      const ranked = Array.from({ length: 14 }, (_, i) => car(`Bat ${i}`, { battery_kwh: battery(40 + i) }));
      writeModel(data, "Bat", doc("Bat", "on_sale", [
        ...ranked,
        car("Bat none 1"),
        car("Bat none 2", { battery_kwh: null }),
        car("Bat none 3", { price: priceOf(20000, "pvp") }),
        car("Bat t3", { battery_kwh: battery(99, { tier: "T3" }) }),
      ]));
      // Never counted: announced, discontinued and under review, even without the figure.
      writeModel(data, "Soon", doc("Soon", "announced", [car("Soon A")]));
      writeModel(data, "Old", doc("Old", "discontinued", [car("Old A")]));
      writeModel(data, "Rev", doc("Rev", "on_sale", [car("Rev A")], { needs_review: true }));
    });
    // The only financed price does not fit in the 10 places: no offer shown, no block.
    noBlock = build(root, "noblock", (data) => {
      writeModel(data, "Cheap", doc("Cheap", "on_sale", [
        ...Array.from({ length: 10 }, (_, i) => car(`Cheap ${i}`, { price: priceOf(20000 + i, "pvp") })),
        car("Dear", { price: priceOf(50000, "financed") }),
      ]));
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-5, RF-5: financed has «Precio con oferta», link to its entry; pvp has no label; both ordered by price", () => {
    const html = page(main, "mas-baratos");
    const lis = places(html);
    const names = lis.map((li) => text(/data-version[^>]*>([\s\S]*?)<\/p>/.exec(li)![1]));
    assert.deepEqual(names, ["Bat none 3", "Mix A", "Mix B", "Mix C"]);
    const id = termsAnchorId("acme", "Mix", "Mix B");
    lis.forEach((li, i) => {
      if (names[i] === "Mix B") {
        assert.match(text(/data-figure[\s>][\s\S]*?<\/p>/.exec(li)![0]), /35\.000 € Precio con oferta/);
        assert.match(li, new RegExp(`<a[^>]*href="#${id}"[^>]*>Ver condiciones de la oferta</a>`));
      } else {
        assert.doesNotMatch(li, /Precio con oferta|Ver condiciones/);
      }
    });
  });

  test("CA-5: «Condiciones de las ofertas» h2 with one entry per shown financed place: literal terms and link to price_terms_url", () => {
    const html = page(main, "mas-baratos");
    const b = block(html)!;
    assert.ok(b, "block exists");
    assert.match(b, /<h2[^>]*>Condiciones de las ofertas<\/h2>/);
    const entries = [...b.matchAll(/<li\b[^>]*data-terms-entry[\s\S]*?<\/li>/g)].map((m) => m[0]);
    assert.equal(entries.length, 1);
    const id = termsAnchorId("acme", "Mix", "Mix B");
    assert.match(entries[0], new RegExp(`<li id="${id}" tabindex="-1"`));
    assert.equal(text(/data-terms-title[^>]*>([\s\S]*?)<\/p>/.exec(entries[0])![1]), "Acme Mix, Mix B");
    assert.match(text(entries[0]), /Oferta financiada de 35\.000 €\. Crédito mínimo de 10\.000 € con permanencia de 48 meses\./);
    assert.match(entries[0], /<a[^>]*href="https:\/\/www\.acme\.example\/es\/ofertas"/);
    // the block comes after the list
    assert.ok(html.indexOf("data-condiciones") > html.indexOf("data-ranking-list"));
  });

  test("RF-5: anchor id depends on (brand, model, name) only, not on the place", () => {
    assert.equal(termsAnchorId("acme", "Mix", "Mix B"), termsAnchorId("acme", "Mix", "Mix B"));
    assert.notEqual(termsAnchorId("acme", "Mix", "Mix B"), termsAnchorId("acme", "Mix", "Mix A"));
    assert.match(termsAnchorId("Acme", "Volta", "Volta 80 AWD"), /^condiciones-[a-z0-9-]+$/);
  });

  test("RF-5: the entry markup also goes in a <template> of the price page, with no data in it", () => {
    const tpl = /<template[^>]*data-terms-template>([\s\S]*?)<\/template>/.exec(page(main, "mas-baratos"));
    assert.ok(tpl);
    assert.match(tpl![1], /data-terms-entry/);
    assert.match(tpl![1], /data-terms-title/);
    assert.match(tpl![1], /data-terms-link/);
  });

  test("RF-5: with no financed place shown there is no block; a pvp never has a label", () => {
    const full = page(noBlock, "mas-baratos");
    assert.equal(places(full).length, 10);
    // the inert place template of the filters (#376) carries every optional part: look outside it
    const html = full.replace(/<template[\s\S]*?<\/template>/g, "");
    // the intro sentence of the page mentions the label, so look at the places and the block only
    assert.doesNotMatch(html, /data-condiciones|Condiciones de las ofertas|data-deal-badge|data-terms-ref|Ver condiciones/);
    assert.doesNotMatch(places(html).join(""), /Precio con oferta/);
  });

  test("RF-3, RF-5: the other four rankings show no price, no label, no block, no template", () => {
    for (const slug of ["mas-autonomia", "mas-bateria", "mas-potencia", "carga-mas-rapida-en-continua"]) {
      // the inert place template of the filters (#376) carries every optional part: look outside it
      const html = page(main, slug).replace(/<template[\s\S]*?<\/template>/g, "");
      assert.doesNotMatch(html, /data-condiciones|Ver condiciones|data-terms-template|data-deal-badge/, slug);
      assert.doesNotMatch(places(html).join(""), /Precio con oferta/, slug);
    }
  });

  test("CA-18, RF-15: 21 on-sale versions, 17 ranked, 3 without the figure and 1 only T3: «4 versiones» fuera", () => {
    const html = page(main, "mas-bateria");
    assert.equal(places(html).length, 10);
    const p = /<p[^>]*data-left-out[^>]*>([\s\S]*?)<\/p>/.exec(html)!;
    assert.equal(
      text(p[1]),
      "4 versiones a la venta se han quedado fuera por no tener publicado la capacidad de batería con fuente verificable.",
    );
    // right below the list, after the section of places
    assert.ok(html.indexOf("data-left-out") > html.indexOf("data-ranking-list"));
  });

  test("RF-15: the singular, and zero left out says so; the sentence is always there", () => {
    const html = page(main, "mas-baratos");
    // price: 3 Mix + Bat none 3 ranked; the 17 other on-sale versions have no price
    assert.match(text(/data-left-out[^>]*>([\s\S]*?)<\/p>/.exec(html)![1]), /^17 versiones a la venta se han quedado fuera por no tener publicado el precio/);
    const noneOut = page(noBlock, "mas-baratos");
    assert.equal(
      text(/data-left-out[^>]*>([\s\S]*?)<\/p>/.exec(noneOut)![1]),
      "Ninguna versión a la venta se ha quedado fuera: todas tienen publicado el precio.",
    );
  });

  test("CA-7 (zero), RF-15: no versions with the figure: no <ol>, text, link to /coches and the left-out note", () => {
    const html = page(main, "mas-potencia");
    assert.doesNotMatch(html, /<ol\b[^>]*data-ranking-list|data-place=/);
    assert.match(html, /<h2[^>]*id="resultados"[^>]*>Puestos<\/h2>/);
    const empty = /data-ranking-empty[\s\S]*?<\/div>/.exec(html)![0];
    assert.match(text(empty), /Todavía no hay ninguna versión a la venta que tenga publicado la potencia\./);
    assert.match(empty, /<a[^>]*href="\/coches"[^>]*>Ver todos los coches<\/a>/);
    assert.match(text(/data-left-out[^>]*>([\s\S]*?)<\/p>/.exec(html)![1]), /^21 versiones a la venta se han quedado fuera/);
  });

  test("RF-15: leftOut leaves out announced, discontinued, needs_review and versions that have a figure", () => {
    const mk = (d: Record<string, unknown>, file: string) => normalize(d, file);
    const models = [
      mk(doc("A", "on_sale", [car("A1", { battery_kwh: battery(50) }), car("A2")]), "acme/A.yaml"),
      mk(doc("B", "announced", [car("B1")]), "acme/B.yaml"),
      mk(doc("C", "discontinued", [car("C1")]), "acme/C.yaml"),
    ];
    assert.deepEqual(leftOut(models, "bateria").map((o) => o.version.name), ["A2"]);
  });
});
