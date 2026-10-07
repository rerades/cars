import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { normalize } from "../src/lib/data.ts";
import { summarize } from "../src/lib/derived.ts";
import { NO_FILTERS, factAttrs, parseFilters, readFacts, toSearch } from "../src/lib/filter.ts";
import { parseSort, readSortable, sortAttrs, sortModels, type SortKey } from "../src/lib/sort.ts";
import { sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");

const price = (value: number, kind = "pvp") => ({
  ...sourced(value),
  unit: "EUR",
  price_kind: kind,
  // A financed price must say its conditions (data-model.md), or it is dropped.
  ...(kind === "financed" ? { price_terms: "Financiando.", price_terms_url: "https://www.acme.example/es/ofertas" } : {}),
});

/** brand acme; every field optional so each model misses exactly what its name says. */
function doc(
  model: string,
  o: { status?: string; launch?: string; price?: number; kind?: string; km?: number } = {},
): Record<string, any> {
  const version: Record<string, any> = { name: `${model} 1` };
  if (o.price !== undefined) version.price = price(o.price, o.kind);
  if (o.km !== undefined) version.wltp_km = sourced(o.km);
  return {
    brand: "acme",
    brand_name: "Acme",
    model,
    status: sourced(o.status ?? "on_sale"),
    ...(o.launch ? { launch: sourced(o.launch) } : {}),
    versions: [version],
  };
}

const catalog = () => [
  doc("Volta", { launch: "2025-03", price: 39990, km: 520 }),
  doc("Soon", { status: "announced", launch: "2026-10-15" }),
  doc("Deal", { launch: "2024-01", price: 24990, kind: "financed", km: 300 }),
  doc("Plain", { price: 19990, km: 600 }),
  doc("Zzz"),
];

const summaries = catalog().map((d) => summarize(normalize(d, `acme/${d.model}.yaml`)));
const order = (key: SortKey) => sortModels(summaries, key).map((m) => m.model);

describe("sort (sort.ts)", () => {
  test("CA-16: newest launch first, an announced model uses its expected date, no launch last", () => {
    assert.deepEqual(order("novedad"), ["Soon", "Volta", "Deal", "Plain", "Zzz"]);
  });

  test("CA-3: price ascending and descending, by 'price from'; an offer price sorts like the rest", () => {
    // Deal's price is financed (RF-9): it sorts by its value (24.990) between the others.
    assert.deepEqual(order("precio-asc").slice(0, 3), ["Plain", "Deal", "Volta"]);
    assert.deepEqual(order("precio-desc").slice(0, 3), ["Volta", "Deal", "Plain"]);
  });

  test("CA-3: range descending, models without range last", () => {
    assert.deepEqual(order("autonomia-desc"), ["Plain", "Volta", "Deal", "Soon", "Zzz"]);
  });

  test("CA-9: models without a price go last in both price orders", () => {
    assert.deepEqual(order("precio-asc").slice(3), ["Soon", "Zzz"]);
    assert.deepEqual(order("precio-desc").slice(3), ["Soon", "Zzz"]);
  });

  test("RF-5: the order travels in the query string, next to the filters, and round-trips", () => {
    assert.equal(parseFilters("").sort, "novedad");
    assert.equal(toSearch(NO_FILTERS), "", "the default order is not written");
    const url = "?marca=acme&estado=venta&orden=precio-asc";
    assert.equal(parseFilters(url).sort, "precio-asc");
    assert.equal(toSearch(parseFilters(url)), url);
    assert.equal(parseSort("nope"), "novedad", "an invalid value is ignored");
    assert.equal(parseFilters("?orden=raro").sort, "novedad");
  });

  test("the data attributes of the cards read back to the same order (build and browser agree)", () => {
    const back = summaries.map((m) => {
      const a = { ...factAttrs(m), ...sortAttrs(m) };
      const get = (n: string) => a[n] ?? null;
      return { ...readSortable(get), facts: readFacts(get) };
    });
    for (const key of ["novedad", "precio-asc", "precio-desc", "autonomia-desc"] as const) {
      assert.deepEqual(sortModels(back, key).map((m) => m.model), order(key));
    }
  });
});

describe("/coches built page: order", () => {
  let root: string;
  let html: string;
  let js: string;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-web-sort-"));
    const data = join(root, "data");
    for (const d of catalog()) {
      mkdirSync(join(data, d.brand), { recursive: true });
      writeFileSync(join(data, d.brand, `${d.model}.yaml`), stringify(d));
    }
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", join(root, "out")], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
    html = readFileSync(join(root, "out/coches/index.html"), "utf8");
    const dir = join(root, "out/_astro");
    js = readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-16: the served HTML is already ordered by novelty", () => {
    const names = [...html.matchAll(/<li\b[^>]*data-model[^>]*data-name="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(names, ["Soon", "Volta", "Deal", "Plain", "Zzz"]);
  });

  test("CA-3: the order selector has a visible label and the four options, 'Novedad' first", () => {
    assert.match(html, /<label[^>]*for="orden"[^>]*>Ordenar por<\/label>/);
    const select = /<select[^>]*id="orden"[\s\S]*?<\/select>/.exec(html)?.[0] ?? "";
    const options = [...select.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(options, [
      ["novedad", "Novedad"],
      ["precio-asc", "Precio: de menor a mayor"],
      ["precio-desc", "Precio: de mayor a menor"],
      ["autonomia-desc", "Autonomía: de mayor a menor"],
    ]);
  });

  test("CA-9: a model without price keeps 'Precio por confirmar' on its card", () => {
    const zzz = [...html.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]).find((s) => s.includes(">Zzz</a>"));
    assert.match(zzz ?? "", /Precio por confirmar/);
    assert.match(zzz ?? "", /data-price(?=[\s>])/, "empty data-price: the sort puts it last");
    assert.doesNotMatch(zzz ?? "", /data-price="/);
  });

  test("the shipped script reorders the cards and writes the order to the URL", () => {
    assert.match(js, /orden/);
    assert.match(js, /append/);
    assert.match(js, /replaceState/);
  });
});
