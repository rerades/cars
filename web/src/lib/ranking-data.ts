import { PRICE_BANDS } from "./catalog.ts";
import type { Battery, ModelRecord, Price, Sourced } from "./data.ts";
import { candidates, leftOut, rankingById, type RankingDef, type RankingId } from "./rankings.ts";

/**
 * Data a ranking JSON publishes so the browser can filter (ADR-0015, detail 1; PRD-005 RF-4, RF-6,
 * RF-11, RF-15). Pure: the selection comes from `candidates()` and `leftOut()` of rankings.ts, so the
 * HTML list and the JSON without filters cannot diverge. White-list only; absent becomes `null`.
 */

/** The figure of the ranking with its source. Fields beyond the common ones depend on the ranking. */
export interface RankingFigure {
  value: number;
  source_id: string;
  url: string;
  retrieved: string;
  tier: string;
  note: string | null;
  /** Battery ranking only. */
  basis?: Battery["basis"];
  /** Price ranking only. */
  price_kind?: Price["price_kind"];
  price_terms?: string | null;
  price_terms_url?: string | null;
}

/** An item of `entries[]`: a version that may take a place. Shape-compatible with `rankPlaces()`. */
export interface RankingJsonEntry {
  brand: string;
  slug: string;
  brand_name: string;
  model: string;
  name: string;
  segment: string | null;
  /** Slug of the version's price band (`PRICE_BANDS`), or null without price. Never the price itself. */
  price_band: string | null;
  figure: RankingFigure;
}

/** An item of `out[]`: only the keys the filters need, nothing that identifies the version (RF-15). */
export interface RankingJsonOut {
  segment: string | null;
  price_band: string | null;
}

export interface RankingJson {
  entries: RankingJsonEntry[];
  out: RankingJsonOut[];
}

/** Slug of the price band of `price` (PRD-001 RF-10 edges, kept in `PRICE_BANDS`), or null. */
export function priceBandSlug(price: number | null | undefined): string | null {
  if (typeof price !== "number") return null;
  return PRICE_BANDS.find((b) => b.accepts(price))?.slug ?? null;
}

const slugOf = (m: ModelRecord) => m.file.replace(/\.yaml$/, "").split("/").pop()!;

function figureOf(def: RankingDef, figure: Sourced<number>): RankingFigure {
  const out: RankingFigure = {
    value: figure.value,
    source_id: figure.source_id,
    url: figure.url,
    retrieved: figure.retrieved,
    tier: figure.tier,
    note: figure.note ?? null,
  };
  if (def.field === "battery_kwh") out.basis = (figure as Battery).basis;
  if (def.field === "price") {
    const p = figure as Price;
    out.price_kind = p.price_kind;
    out.price_terms = p.price_terms ?? null;
    out.price_terms_url = p.price_terms_url ?? null;
  }
  return out;
}

/** Builds the `{ entries, out }` of a ranking (ADR-0015, detail 1). */
export function rankingJson(models: readonly ModelRecord[], ranking: RankingId | RankingDef): RankingJson {
  const def = typeof ranking === "string" ? rankingById(ranking) : ranking;
  return {
    entries: candidates(models, def).map(({ model, version, figure }) => ({
      brand: model.brand,
      slug: slugOf(model),
      brand_name: model.brand_name,
      model: model.model,
      name: version.name,
      segment: model.segment?.value ?? null,
      price_band: priceBandSlug(version.price?.value),
      figure: figureOf(def, figure),
    })),
    out: leftOut(models, def).map(({ model, version }) => ({
      segment: model.segment?.value ?? null,
      price_band: priceBandSlug(version.price?.value),
    })),
  };
}
