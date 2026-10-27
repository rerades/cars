import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { es } from "../src/lib/i18n.ts";
import type { RankingJson, RankingJsonEntry } from "../src/lib/ranking-data.ts";
import { dealOfEntry, filteredState, leftOutCount, leftOutKey, summaryKey } from "../src/lib/ranking-state.ts";
import { RANKINGS, rankingById, termsAnchorId } from "../src/lib/rankings.ts";

/**
 * Story #377 (PRD-005, ADR-0015 detail 3): states when filtering. Covers RF-8, RF-9, RF-15 and RF-5
 * with filters, CA-18 over the filtered set, and the texts of the empty-filtered and error states.
 * The behaviour in a browser (focus, live region, fetch failure) is story #378.
 */
const entry = (name: string, value: number, segment: string | null, band: string | null, financed = false): RankingJsonEntry => ({
  brand: "acme",
  slug: "uno",
  brand_name: "Acme",
  model: "Uno",
  name,
  segment,
  price_band: band,
  figure: {
    value,
    source_id: "s",
    url: "https://example.com/x",
    retrieved: "2026-10-01",
    tier: "T1",
    note: null,
    price_kind: financed ? "financed" : "pvp",
    price_terms: financed ? "Cuota\n\nEntrada" : null,
    price_terms_url: financed ? "https://example.com/t" : null,
  },
});

const json: RankingJson = {
  entries: [
    entry("A", 20000, "suv_compacto", "hasta-30000-euros", true),
    entry("B", 35000, "suv_compacto", "de-30000-a-45000-euros"),
    entry("C", 50000, null, "mas-de-45000-euros", true),
  ],
  out: [
    { segment: "suv_compacto", price_band: "hasta-30000-euros" },
    { segment: "suv_compacto", price_band: null },
    { segment: null, price_band: "mas-de-45000-euros" },
  ],
};
const none = { segment: null, priceBand: null };
const title = (e: RankingJsonEntry) => `${e.brand_name} ${e.model}, ${e.name}`;

describe("state after filtering (#377)", () => {
  test("CA-18: the left-out count is over the same set, without and with filters", () => {
    assert.equal(leftOutCount(json.out, none), 3);
    assert.equal(leftOutCount(json.out, { segment: "suv_compacto", priceBand: null }), 2);
    assert.equal(leftOutCount(json.out, { segment: null, priceBand: "mas-de-45000-euros" }), 1);
    // a version without price does not pass a price filter, one without segment does not pass a segment filter
    assert.equal(leftOutCount(json.out, { segment: "suv_compacto", priceBand: "hasta-30000-euros" }), 1);
    assert.equal(leftOutCount(json.out, { segment: "suv_urbano", priceBand: null }), 0);
  });

  test("the summary and the note pick singular, plural and none", () => {
    assert.equal(summaryKey(0), "ranking.resumen.ninguna");
    assert.equal(summaryKey(1), "ranking.resumen.uno");
    assert.equal(summaryKey(10), "ranking.resumen.n");
    assert.equal(leftOutKey(0), "ranking.fuera.ninguna");
    assert.equal(leftOutKey(1), "ranking.fuera.uno");
    assert.equal(leftOutKey(2), "ranking.fuera.n");
  });

  test("RF-8: places are renumbered inside the result and the summary counts them", () => {
    const s = filteredState(json, rankingById("precio"), { segment: "suv_compacto", priceBand: null }, title);
    assert.deepEqual(s.places.map((p) => [p.place, p.entry.name]), [[1, "A"], [2, "B"]]);
    assert.equal(s.summary, "ranking.resumen.n");
    assert.equal(s.leftOut, 2);
    const one = filteredState(json, rankingById("precio"), { segment: "suv_compacto", priceBand: "de-30000-a-45000-euros" }, title);
    assert.deepEqual(one.places.map((p) => p.place), [1]);
    assert.equal(one.summary, "ranking.resumen.uno");
  });

  test("RF-8/RF-9: zero results gives the empty summary, no offers and the note over the filtered out[]", () => {
    const s = filteredState(json, rankingById("precio"), { segment: "suv_urbano", priceBand: null }, title);
    assert.equal(s.places.length, 0);
    assert.equal(s.summary, "ranking.resumen.ninguna");
    assert.deepEqual(s.deals, []);
    assert.equal(leftOutKey(s.leftOut), "ranking.fuera.ninguna");
  });

  test("RF-5: offers are rebuilt for the places shown, with ids from (brand, slug, name)", () => {
    const all = filteredState(json, rankingById("precio"), none, title);
    assert.deepEqual(all.deals.map((d) => d.id), [
      termsAnchorId("acme", "uno", "A"),
      termsAnchorId("acme", "uno", "C"),
    ]);
    const filtered = filteredState(json, rankingById("precio"), { segment: null, priceBand: "mas-de-45000-euros" }, title);
    // same id for C whether or not the list is filtered: it never depends on the place
    assert.deepEqual(filtered.deals.map((d) => d.id), [termsAnchorId("acme", "uno", "C")]);
    assert.equal(filtered.deals[0].title, "Acme Uno, C");
    assert.equal(filtered.deals[0].terms, "Cuota\n\nEntrada");
    const none2 = filteredState(json, rankingById("precio"), { segment: null, priceBand: "de-30000-a-45000-euros" }, title);
    assert.deepEqual(none2.deals, []);
  });

  test("RF-5: only the price ranking has offers", () => {
    assert.equal(dealOfEntry(json.entries[0], rankingById("autonomia"), title), null);
    assert.equal(dealOfEntry(json.entries[1], rankingById("precio"), title), null);
  });
});

describe("ranking states in the built HTML (#377)", () => {
  let out: string;
  const page = (url: string) => readFileSync(join(out, url, "index.html"), "utf8");

  before(() => {
    out = mkdtempSync(join(tmpdir(), "cars-rankings-estados-"));
    const env = { ...process.env };
    delete env.CARS_DATA_DIR;
    execFileSync("pnpm", ["exec", "astro", "build", "--outDir", out], {
      cwd: resolve(import.meta.dirname, ".."),
      env,
      stdio: "pipe",
    });
  });
  after(() => rmSync(out, { recursive: true, force: true }));

  test("the summary is a plain paragraph without JS, between the h2 and the list", () => {
    for (const r of RANKINGS) {
      const html = page(r.url);
      const p = /<p[^>]*data-ranking-summary[^>]*>([^<]*)<\/p>/.exec(html);
      assert.ok(p, r.url);
      assert.match(p[1].trim(), /^(\d+ versiones|1 versión)$/, r.url);
      assert.doesNotMatch(p[0], /role=|aria-live/, "the live region is set by the script");
      assert.ok(html.indexOf('id="resultados"') < html.indexOf("data-ranking-summary"));
      assert.ok(html.indexOf("data-ranking-summary") < html.indexOf("data-ranking-list"));
    }
  });

  test("the empty-filtered and the error texts travel with the filters, from the i18n keys", () => {
    const html = page("/rankings/mas-autonomia");
    const tpl = /<template data-filtered-empty-template>([\s\S]*?)<\/template>/.exec(html)![1];
    assert.ok(tpl.includes(es["ranking.vacioFiltros.texto"]));
    assert.ok(tpl.includes(es["ranking.filtros.quitar"]));
    assert.match(tpl, /<button[^>]*type="button"/);
    assert.ok(html.includes("No se ha podido filtrar."), "error text in data-messages");
  });

  test("the price ranking keeps the offer-terms templates the script clones", () => {
    const html = page("/rankings/mas-baratos");
    assert.match(html, /<template data-terms-template>/);
    assert.match(html, /<template data-terms-section-template>/);
    assert.doesNotMatch(page("/rankings/mas-autonomia"), /data-terms-section-template/);
  });
});
