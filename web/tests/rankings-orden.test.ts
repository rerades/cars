import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { normalize } from "../src/lib/data.ts";
import { MAX_PLACES, candidates, rankPlaces, type RankingEntry } from "../src/lib/rankings.ts";
import { sourced } from "./fixtures.ts";

const entry = (brand: string, model: string, name: string, value: number): RankingEntry => ({
  brand: brand.toLowerCase(), brand_name: brand, model, name, figure: { value },
});
const view = (places: { place: number; entry: RankingEntry }[]) => places.map((p) => [p.place, p.entry.name]);

describe("rankPlaces: order (CA-1) and direction (RF-1)", () => {
  const items = [entry("A", "m", "b", 300), entry("A", "m", "a", 500), entry("A", "m", "c", 400)];

  test("autonomia (desc): each figure >= the next", () => {
    const f = rankPlaces(items, "autonomia").map((p) => p.entry.figure.value);
    assert.deepEqual(f, [500, 400, 300]);
  });

  test("precio (asc): each figure <= the next", () => {
    const f = rankPlaces(items, "precio").map((p) => p.entry.figure.value);
    assert.deepEqual(f, [300, 400, 500]);
  });

  test("does not modify its input", () => {
    const copy = structuredClone(items);
    rankPlaces(items, "autonomia");
    assert.deepEqual(items, copy);
  });
});

describe("rankPlaces: ties (CA-7)", () => {
  test("tie in 1st: 1, 1, 3, in alphabetical order of brand, model and name", () => {
    const r = rankPlaces(
      [entry("B", "x", "z", 500), entry("A", "y", "k", 400), entry("A", "x", "z", 500), entry("A", "x", "a", 500)],
      "autonomia",
    );
    assert.deepEqual(
      r.map((p) => [p.place, p.entry.brand_name, p.entry.model, p.entry.name]),
      [[1, "A", "x", "a"], [1, "A", "x", "z"], [1, "B", "x", "z"], [4, "A", "y", "k"]],
    );
  });

  test("tie in 2nd: both 2, in alphabetical order, the next one is 4", () => {
    const r = rankPlaces(
      [entry("A", "m", "d", 300), entry("A", "m", "c", 400), entry("A", "m", "b", 400), entry("A", "m", "a", 500)],
      "autonomia",
    );
    assert.deepEqual(view(r), [[1, "a"], [2, "b"], [2, "c"], [4, "d"]]);
  });

  test("tie in 1st in a price ranking (asc)", () => {
    const r = rankPlaces([entry("A", "m", "b", 20000), entry("A", "m", "a", 20000), entry("A", "m", "c", 25000)], "precio");
    assert.deepEqual(view(r), [[1, "a"], [1, "b"], [3, "c"]]);
  });

  test("numbers in names are compared as numbers", () => {
    const r = rankPlaces([entry("A", "m", "v10", 1), entry("A", "m", "v2", 1)], "autonomia");
    assert.deepEqual(view(r), [[1, "v2"], [1, "v10"]]);
  });
});

describe("rankPlaces: limit of 10 (CA-7)", () => {
  test("more than 10 without ties: exactly 10, numbered 1 to 10", () => {
    const items = Array.from({ length: 14 }, (_, i) => entry("A", "m", `v${String(i).padStart(2, "0")}`, 100 + i));
    const r = rankPlaces(items, "autonomia");
    assert.equal(r.length, MAX_PLACES);
    assert.deepEqual(r.map((p) => p.place), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(r[0].entry.figure.value, 113);
  });

  test("a tie crossing the tenth: the first ones in alphabetical order get in, the rest do not", () => {
    // 8 distinct figures, then 4 tied at the 9th place: only two fit.
    const items = [
      ...Array.from({ length: 8 }, (_, i) => entry("A", "m", `top${i}`, 900 - i)),
      entry("A", "m", "t-d", 500), entry("A", "m", "t-b", 500), entry("A", "m", "t-a", 500), entry("A", "m", "t-c", 500),
    ];
    const r = rankPlaces(items, "autonomia");
    assert.equal(r.length, 10);
    assert.deepEqual(view(r).slice(8), [[9, "t-a"], [9, "t-b"]]);
  });

  test("3 versions: 3 places, no filler", () => {
    const r = rankPlaces([entry("A", "m", "a", 3), entry("A", "m", "b", 2), entry("A", "m", "c", 1)], "autonomia");
    assert.deepEqual(view(r), [[1, "a"], [2, "b"], [3, "c"]]);
  });

  test("0 versions: no places", () => {
    assert.deepEqual(rankPlaces([], "autonomia"), []);
  });
});

describe("rankPlaces over candidates()", () => {
  const batt = (value: number, basis: string) => ({ ...sourced(value), basis });
  const doc = (brand: string, model: string, versions: Record<string, unknown>[]) =>
    normalize({ brand, brand_name: brand, model, status: sourced("on_sale"), versions }, `${brand}/${model}.yaml`);

  test("battery: all bases are ordered together", () => {
    const models = [
      doc("acme", "A", [{ name: "usable 70", battery_kwh: batt(70, "usable") }]),
      doc("acme", "B", [{ name: "gross 90", battery_kwh: batt(90, "gross") }]),
      doc("acme", "C", [{ name: "unknown 80", battery_kwh: batt(80, "unknown") }]),
    ];
    const r = rankPlaces(candidates(models, "bateria"), "bateria");
    assert.deepEqual(r.map((p) => [p.place, p.entry.version.name]), [[1, "gross 90"], [2, "unknown 80"], [3, "usable 70"]]);
  });

  test("price: financed versions rank with the pvp ones, and a version without price is not in", () => {
    const price = (value: number, extra: Record<string, unknown>) => ({ ...sourced(value), unit: "EUR", ...extra });
    const models = [
      doc("acme", "A", [
        { name: "pvp 30000", price: price(30000, { price_kind: "pvp" }) },
        {
          name: "financed 25000",
          price: price(25000, { price_kind: "financed", price_terms: "48 months", price_terms_url: "https://x.example/t" }),
        },
        { name: "no price", wltp_km: sourced(400) },
      ]),
    ];
    const r = rankPlaces(candidates(models, "precio"), "precio");
    assert.deepEqual(r.map((p) => [p.place, p.entry.version.name]), [[1, "financed 25000"], [2, "pvp 30000"]]);
  });

  test("a version without price does appear in a ranking by another figure (CA-9, no filters)", () => {
    const models = [doc("acme", "A", [{ name: "no price", wltp_km: sourced(400) }])];
    assert.deepEqual(rankPlaces(candidates(models, "autonomia"), "autonomia").map((p) => p.entry.version.name), ["no price"]);
  });

  test("tie-break uses the model's brand_name, model and the version name", () => {
    const models = [
      doc("zz", "M", [{ name: "v", wltp_km: sourced(400) }]),
      doc("aa", "M", [{ name: "w", wltp_km: sourced(400) }, { name: "v", wltp_km: sourced(400) }]),
    ];
    const r = rankPlaces(candidates(models, "autonomia"), "autonomia");
    assert.deepEqual(r.map((p) => [p.place, p.entry.model.brand, p.entry.version.name]), [[1, "aa", "v"], [1, "aa", "w"], [1, "zz", "v"]]);
  });
});

test("the module stays pure: no Node imports (ADR-0015, detail 2)", () => {
  const src = readFileSync(new URL("../src/lib/rankings.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /from\s+["']node:|require\(|process\./);
});
