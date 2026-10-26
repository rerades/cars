import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  parseRankingFilters,
  passesFilters,
  rankPlaces,
  rankingSearch,
  type RankingEntry,
  type RankingFilters,
} from "../src/lib/rankings.ts";

/**
 * Story #376 (PRD-005, ADR-0015 detail 3): segment and price filters in the pure function.
 * Covers RF-8, RF-9, RF-10, RF-13 (query string); CA-8, CA-9, CA-12 (round trip of the query string).
 * Entries have the shape of `entries[]` of the ranking JSON (#447).
 */
type E = RankingEntry & { segment: string | null; price_band: string | null };

const band = (price: number | null) =>
  price === null ? null : price <= 30000 ? "hasta-30000-euros" : price <= 45000 ? "de-30000-a-45000-euros" : "mas-de-45000-euros";

const entry = (name: string, km: number, segment: string | null, price: number | null): E => ({
  brand: "acme",
  brand_name: "Acme",
  model: "M",
  name,
  segment,
  price_band: band(price),
  figure: { value: km },
});

const none: RankingFilters = { segment: null, priceBand: null };
const names = (items: E[], f: RankingFilters) => rankPlaces(items, "autonomia", f).map((p) => `${p.place}:${(p.entry as E).name}`);

describe("segment filter (RF-8, CA-8)", () => {
  const items = [
    entry("no-segment", 900, null, 20000), // longest range, but the model has no segment
    entry("suv-a", 500, "suv_compacto", 20000),
    entry("suv-b", 400, "suv_compacto", 20000),
    entry("urban", 450, "urbano", 20000),
  ];

  test("only models of that segment, numbered 1..n inside the result", () => {
    assert.deepEqual(names(items, { segment: "suv_compacto", priceBand: null }), ["1:suv-a", "2:suv-b"]);
  });

  test("a model without segment is not in the filtered ranking even with the best figure", () => {
    assert.ok(!names(items, { segment: "suv_compacto", priceBand: null }).some((n) => n.includes("no-segment")));
    assert.equal(names(items, none)[0], "1:no-segment");
  });

  test("more than 10 in the segment: still 10 places, renumbered", () => {
    const many = Array.from({ length: 14 }, (_, i) => entry(`s${i}`, 300 + i, "suv_compacto", 20000));
    const places = rankPlaces([...many, entry("other", 999, "urbano", 20000)], "autonomia", {
      segment: "suv_compacto",
      priceBand: null,
    });
    assert.deepEqual(places.map((p) => p.place), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("price band filter (RF-9, RF-10, CA-9)", () => {
  const items = [
    entry("p30000", 400, "suv_compacto", 30000),
    entry("p30001", 401, "suv_compacto", 30001),
    entry("p45000", 402, "suv_compacto", 45000),
    entry("no-price", 999, "suv_compacto", null),
  ];
  const by = (priceBand: string) => names(items, { segment: null, priceBand }).map((n) => n.split(":")[1]);

  test("up to 30,000 € has the 30,000 version only", () => {
    assert.deepEqual(by("hasta-30000-euros"), ["p30000"]);
  });
  test("from 30,000 to 45,000 € has 30,001 and 45,000", () => {
    assert.deepEqual(by("de-30000-a-45000-euros"), ["p45000", "p30001"]);
  });
  test("more than 45,000 € has none of the three", () => {
    assert.deepEqual(by("mas-de-45000-euros"), []);
  });
  test("a version without price is in no filtered band, and is in the unfiltered ranking", () => {
    for (const b of ["hasta-30000-euros", "de-30000-a-45000-euros", "mas-de-45000-euros"]) {
      assert.ok(!by(b).includes("no-price"), b);
    }
    assert.ok(names(items, none).some((n) => n.endsWith("no-price")));
  });
  test("works on candidates too: band computed from the version price", () => {
    const c = (price: number | undefined) =>
      ({
        model: { brand: "a", brand_name: "A", model: "m", segment: { value: "urbano" } },
        version: { name: "v", price: price === undefined ? undefined : { value: price } },
        figure: { value: 1 },
      }) as never;
    assert.equal(passesFilters(c(30000), { segment: null, priceBand: "hasta-30000-euros" }), true);
    assert.equal(passesFilters(c(30001), { segment: null, priceBand: "hasta-30000-euros" }), false);
    assert.equal(passesFilters(c(undefined), { segment: null, priceBand: "mas-de-45000-euros" }), false);
  });
});

describe("combined filters and no filters", () => {
  const items = [
    entry("a", 500, "suv_compacto", 25000),
    entry("b", 480, "suv_compacto", 50000),
    entry("c", 470, "urbano", 25000),
  ];
  test("both must hold", () => {
    assert.deepEqual(names(items, { segment: "suv_compacto", priceBand: "hasta-30000-euros" }), ["1:a"]);
  });
  test("no filters keeps the unfiltered numbering", () => {
    assert.deepEqual(names(items, none), ["1:a", "2:b", "3:c"]);
    assert.deepEqual(names(items, undefined as never), ["1:a", "2:b", "3:c"]);
  });
});

describe("query string (RF-13, CA-12)", () => {
  test("round trip", () => {
    const f = { segment: "suv_compacto", priceBand: "hasta-30000-euros" };
    assert.equal(rankingSearch(f), "?segmento=suv_compacto&precio=hasta-30000-euros");
    assert.deepEqual(parseRankingFilters(rankingSearch(f)), f);
    for (const band of ["de-30000-a-45000-euros", "mas-de-45000-euros"]) {
      const g = { segment: null, priceBand: band };
      assert.deepEqual(parseRankingFilters(rankingSearch(g)), g);
    }
    assert.equal(rankingSearch(none), "");
  });
  test("invalid values are ignored without error", () => {
    assert.deepEqual(parseRankingFilters("?segmento=nave&precio=gratis"), none);
    assert.deepEqual(parseRankingFilters("?segmento=urbano&precio=gratis"), { segment: "urbano", priceBand: null });
    assert.deepEqual(parseRankingFilters(""), none);
  });
});
