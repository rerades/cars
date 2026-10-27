import type { RankingJson, RankingJsonEntry } from "./ranking-data.ts";
import { passesFilters, rankPlaces, termsAnchorId, type RankingDef, type RankingFilters } from "./rankings.ts";

/**
 * Pure pieces of what the browser shows after filtering a ranking (#377, ADR-0015 detail 3): the
 * summary key, the left-out count over the filtered set, and the offer terms of the places shown.
 * No DOM here, so `node --test` covers it; the script of RankingFilters.astro only paints.
 */

/** Key of the summary line (`ranking.resumen.*`) for `n` places. */
export function summaryKey(n: number): "ranking.resumen.ninguna" | "ranking.resumen.uno" | "ranking.resumen.n" {
  return n === 0 ? "ranking.resumen.ninguna" : n === 1 ? "ranking.resumen.uno" : "ranking.resumen.n";
}

/** Key of the left-out note (RF-15) for `n` versions. */
export function leftOutKey(n: number): "ranking.fuera.ninguna" | "ranking.fuera.uno" | "ranking.fuera.n" {
  return n === 0 ? "ranking.fuera.ninguna" : n === 1 ? "ranking.fuera.uno" : "ranking.fuera.n";
}

/**
 * RF-15 / CA-18 with filters: the versions without a usable figure that pass the same filters as
 * the places. Counted on `out[]` of the JSON (segment and band only), with the same `passesFilters`.
 */
export function leftOutCount(out: RankingJson["out"], filters: RankingFilters): number {
  return out.filter((o) => passesFilters(o, filters)).length;
}

/** One entry of "Condiciones de las ofertas" (same shape as `DealView` of ranking-view.ts). */
export interface DealEntry {
  id: string;
  title: string;
  terms: string;
  termsUrl: string;
}

/** The deal of an entry of the price ranking, or null (`pvp`, or another ranking). Id from (brand, slug, name). */
export function dealOfEntry(
  entry: RankingJsonEntry,
  def: RankingDef,
  title: (e: RankingJsonEntry) => string,
): DealEntry | null {
  if (def.field !== "price" || entry.figure.price_kind !== "financed") return null;
  return {
    id: termsAnchorId(entry.brand, entry.slug, entry.name),
    title: title(entry),
    terms: entry.figure.price_terms ?? "",
    termsUrl: entry.figure.price_terms_url ?? "",
  };
}

/** Everything the page repaints for a set of filters: places, summary, note count and offers, in list order. */
export function filteredState(json: RankingJson, def: RankingDef, filters: RankingFilters, title: (e: RankingJsonEntry) => string) {
  const places = rankPlaces(json.entries, def, filters);
  return {
    places,
    summary: summaryKey(places.length),
    leftOut: leftOutCount(json.out, filters),
    deals: places.flatMap((p) => {
      const d = dealOfEntry(p.entry, def, title);
      return d ? [d] : [];
    }),
  };
}
