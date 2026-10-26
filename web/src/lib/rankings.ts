import { PRICE_BANDS } from "./catalog.ts";
import type { ModelRecord, Sourced, Tier, Version } from "./data.ts";
import { SEGMENTS } from "./filter.ts";

/**
 * Rankings (PRD-005). Pure module: no file access. Data comes from `loadModels()` (data.ts).
 * This file holds the table of the five rankings (RF-1) and the selection of the versions that
 * may enter one (RF-4, RF-6, RF-11). Ordering, the limit of 10, ties and pages are other stories.
 */

export type RankingId = "precio" | "autonomia" | "bateria" | "potencia" | "cargaCc";

/** Version field a ranking is about. Always a field of `versions[]`, never of `specs` (RF-6). */
export type RankingField = "price" | "wltp_km" | "battery_kwh" | "power_kw" | "dc_max_kw";

export interface RankingDef {
  id: RankingId;
  /** Version field holding the figure (RF-1). */
  field: RankingField;
  /** Direction of the order (RF-1). Applied by a later story. */
  direction: "asc" | "desc";
  /** Prefix of the text keys: `ranking.<textKey>.titulo`, `.entrada`, `.orden`, `.dato`. */
  textKey: string;
  /** Stable URL, no query string (docs/design/rankings.md). */
  url: string;
}

/** The five rankings of RF-1, and no others. A new one is added to the PRD first. */
export const RANKINGS: readonly RankingDef[] = [
  { id: "precio", field: "price", direction: "asc", textKey: "ranking.precio", url: "/rankings/mas-baratos" },
  { id: "autonomia", field: "wltp_km", direction: "desc", textKey: "ranking.autonomia", url: "/rankings/mas-autonomia" },
  { id: "bateria", field: "battery_kwh", direction: "desc", textKey: "ranking.bateria", url: "/rankings/mas-bateria" },
  { id: "potencia", field: "power_kw", direction: "desc", textKey: "ranking.potencia", url: "/rankings/mas-potencia" },
  {
    id: "cargaCc",
    field: "dc_max_kw",
    direction: "desc",
    textKey: "ranking.cargaCc",
    url: "/rankings/carga-mas-rapida-en-continua",
  },
];

export function rankingById(id: RankingId): RankingDef {
  const def = RANKINGS.find((r) => r.id === id);
  if (!def) throw new Error(`unknown ranking: ${id}`);
  return def;
}

/** A version that may take a place in a ranking, with the model it belongs to and its figure. */
export interface Candidate {
  model: ModelRecord;
  version: Version;
  /** The figure of the ranking, exactly as in the file (with its source). */
  figure: Sourced<number>;
}

/** Tiers that give a place (RF-4): T3 only confirms, it never ranks. */
const RANKING_TIERS: readonly Tier[] = ["T1", "T2"];

/**
 * Versions that may enter `ranking` (RF-11, RF-6, RF-4): models not under review and `on_sale`;
 * with the figure present, not null and of tier T1 or T2. A version without it is left out: it is
 * never set to 0 nor deduced from another field, another version or `specs`.
 * Keeps the order of the input; does not sort or limit.
 */
export function candidates(models: readonly ModelRecord[], ranking: RankingId | RankingDef): Candidate[] {
  const { field } = typeof ranking === "string" ? rankingById(ranking) : ranking;
  const out: Candidate[] = [];
  for (const model of models) {
    if (model.needs_review || model.status.value !== "on_sale") continue;
    for (const version of model.versions) {
      const figure: Sourced<number> | null | undefined = version[field];
      if (!figure || typeof figure.value !== "number") continue;
      if (!RANKING_TIERS.includes(figure.tier)) continue;
      out.push({ model, version, figure });
    }
  }
  return out;
}

/** A published, on-sale version that has no place because its figure is missing, `null` or only T3 (RF-15). */
export interface LeftOut {
  model: ModelRecord;
  version: Version;
}

/**
 * The `out` set of a ranking (RF-15, ADR-0015): versions of on-sale models not under review that
 * `candidates()` rejects (no figure, `null` or tier T3). Versions with a figure that do not fit in
 * the 10 places are not here; `announced`, `discontinued` and `needs_review` models neither.
 * Built from `candidates()` so both sets always agree. The count is the length of the result.
 */
export function leftOut(models: readonly ModelRecord[], ranking: RankingId | RankingDef): LeftOut[] {
  const ranked = new Set(candidates(models, ranking).map((c) => c.version));
  const out: LeftOut[] = [];
  for (const model of models) {
    if (model.needs_review || model.status.value !== "on_sale") continue;
    for (const version of model.versions) if (!ranked.has(version)) out.push({ model, version });
  }
  return out;
}

const ascii = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Anchor id of the offer-terms entry of a version (ADR-0015): derived from (brand, model slug, version
 * name), never from the place, so it does not point to another version when the list is filtered.
 * Shared by the build and the browser script of #377.
 */
export function termsAnchorId(brand: string, modelSlug: string, name: string): string {
  return `condiciones-${ascii(brand)}-${ascii(modelSlug)}-${ascii(name)}`;
}

/** Maximum number of places of a ranking (RF-7). */
export const MAX_PLACES = 10;

/**
 * What ordering and tie-breaking need of a version (ADR-0015, detail 2). It is the minimum of an
 * `entries[]` item of the ranking JSON (#447), which carries more fields: those are kept as they are.
 */
export interface RankingEntry {
  /** Brand slug. */
  brand: string;
  /** Presentation name of the brand; the alphabetical tie-break uses it. */
  brand_name: string;
  /** Model name. */
  model: string;
  /** Version name. */
  name: string;
  /** The figure of the ranking. */
  figure: { value: number };
}

/** Anything `rankPlaces` takes: an entry of the JSON, or a `Candidate` straight from `candidates()`. */
export type Rankable = RankingEntry | Candidate;

/**
 * Filters of a ranking (RF-8, RF-9, RF-10; ADR-0015, detail 3). `segment` is a model segment (same
 * values as `/coches`); `priceBand` is the slug of a `PRICE_BANDS` band. null = no filter.
 */
export interface RankingFilters {
  segment: string | null;
  priceBand: string | null;
}

export const NO_RANKING_FILTERS: RankingFilters = { segment: null, priceBand: null };

/** Slug of the price band of a price, or null (also for no price). */
export function bandOf(price: number | null | undefined): string | null {
  if (typeof price !== "number") return null;
  return PRICE_BANDS.find((b) => b.accepts(price))?.slug ?? null;
}

/** Segment and price band of a version, from a `Candidate` or from an item of the JSON `entries[]`/`out[]`. */
function facetsOf(item: Rankable | { segment: string | null; price_band: string | null }) {
  if ("price_band" in item) return { segment: item.segment, band: item.price_band };
  const c = item as Candidate;
  return { segment: c.model.segment?.value ?? null, band: bandOf(c.version.price?.value) };
}

/**
 * Whether a version passes the filters. A model without segment does not pass a segment filter, and a
 * version without price does not pass a price filter (RF-8, RF-9): the datum is never assumed.
 * Works on `entries[]`/`out[]` of the JSON (#447) and on a `Candidate`.
 */
export function passesFilters(
  item: Rankable | { segment: string | null; price_band: string | null },
  filters: RankingFilters,
): boolean {
  if (filters.segment === null && filters.priceBand === null) return true;
  const { segment, band } = facetsOf(item);
  if (filters.segment !== null && segment !== filters.segment) return false;
  if (filters.priceBand !== null && band !== filters.priceBand) return false;
  return true;
}

/** Valid values only: anything else in the query string is ignored without a warning. */
export function parseRankingFilters(search: string): RankingFilters {
  const q = new URLSearchParams(search);
  const segment = q.get("segmento");
  const band = q.get("precio");
  return {
    segment: segment !== null && (SEGMENTS as readonly string[]).includes(segment) ? segment : null,
    priceBand: band !== null && PRICE_BANDS.some((b) => b.slug === band) ? band : null,
  };
}

/** Query string with the leading "?" (or ""). Round-trips with `parseRankingFilters`. */
export function rankingSearch(filters: RankingFilters): string {
  const q = new URLSearchParams();
  if (filters.segment !== null) q.set("segmento", filters.segment);
  if (filters.priceBand !== null) q.set("precio", filters.priceBand);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export interface Place<T extends Rankable = Rankable> {
  /** Position with ties: 1, 2, 2, 4 (RF-7). */
  place: number;
  entry: T;
}

function keyOf(item: Rankable): RankingEntry {
  if (typeof item.model === "string") return item as RankingEntry;
  const c = item as Candidate;
  return {
    brand: c.model.brand,
    brand_name: c.model.brand_name,
    model: c.model.model,
    name: c.version.name,
    figure: c.figure,
  };
}

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

/**
 * Orders by the figure and direction of RF-1, numbers with ties (same figure, same place; the next
 * one skips: 1, 2, 2, 4), and cuts at 10 (RF-7). Equal figures go in alphabetical order of brand,
 * model and `name`. If a tie crosses the tenth place, the first ones in that order get in, silently.
 * Fewer than 10 candidates: no padding. All battery bases are ordered together (RF-10); the price
 * ranking takes every priced version, `financed` included. Pure: no input is modified.
 * The one function that numbers, for the build (no filters) and the browser script (#376).
 */
export function rankPlaces<T extends Rankable>(
  items: readonly T[],
  ranking: RankingId | RankingDef,
  filters: RankingFilters = NO_RANKING_FILTERS,
): Place<T>[] {
  const { direction } = typeof ranking === "string" ? rankingById(ranking) : ranking;
  const sign = direction === "asc" ? 1 : -1;
  // Filtered before numbering: places are 1..10 inside the result (RF-8).
  const keyed = items.filter((item) => passesFilters(item, filters)).map((item) => ({ item, key: keyOf(item) }));
  keyed.sort(
    (a, b) =>
      sign * (a.key.figure.value - b.key.figure.value) ||
      collator.compare(a.key.brand_name, b.key.brand_name) ||
      collator.compare(a.key.model, b.key.model) ||
      collator.compare(a.key.name, b.key.name),
  );
  const places: Place<T>[] = [];
  let place = 0;
  for (const [i, { item, key }] of keyed.entries()) {
    if (i === 0 || key.figure.value !== keyed[i - 1].key.figure.value) place = i + 1;
    places.push({ place, entry: item });
  }
  return places.slice(0, MAX_PLACES);
}
