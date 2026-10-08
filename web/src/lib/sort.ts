/**
 * Catalog order of /coches (RF-3, docs/design/filtros-catalogo.md). Pure: no DOM, no texts. The same
 * module sorts at build time (served HTML, pregenerated pages) and in the browser, so both orders
 * cannot diverge. The state lives in the query string (RF-5).
 */

export type SortKey = "novedad" | "precio-asc" | "precio-desc" | "autonomia-desc";

export const SORT_KEYS: readonly SortKey[] = ["novedad", "precio-asc", "precio-desc", "autonomia-desc"];
/** Default order: omitted from the query string. */
export const DEFAULT_SORT: SortKey = "novedad";

/** What sorting reads: the derived model (derived.ts) or the data attributes of a card. */
export interface Sortable {
  model: string;
  /** "YYYY-MM" or "YYYY-MM-DD"; the expected date if announced. */
  launch: string | null;
  priceFrom: { value: number } | null;
  maxRangeKm: number | null;
}

/** Invalid values fall back to the default order (never an error). */
export function parseSort(value: string | null): SortKey {
  return (SORT_KEYS as readonly string[]).includes(value ?? "") ? (value as SortKey) : DEFAULT_SORT;
}

/** "2026-10-15" -> 202610; null when there is no usable date (sorts last, CA-16). */
export function launchKey(launch: string | null): number | null {
  const m = launch ? /^(\d{4})-(\d{2})/.exec(launch) : null;
  return m ? Number(m[1]) * 100 + Number(m[2]) : null;
}

/** Compares numbers where null always goes last, whatever the direction. */
function nullsLast(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return (a - b) * dir;
}

const byNovelty = (a: Sortable, b: Sortable): number =>
  nullsLast(launchKey(a.launch), launchKey(b.launch), -1) || a.model.localeCompare(b.model);

/** Comparator of a sort key. Ties fall back to novelty, then to name: the order is total and stable. */
export function comparator(key: SortKey): (a: Sortable, b: Sortable) => number {
  switch (key) {
    case "precio-asc":
      return (a, b) => nullsLast(a.priceFrom?.value ?? null, b.priceFrom?.value ?? null, 1) || byNovelty(a, b);
    case "precio-desc":
      return (a, b) => nullsLast(a.priceFrom?.value ?? null, b.priceFrom?.value ?? null, -1) || byNovelty(a, b);
    case "autonomia-desc":
      return (a, b) => nullsLast(a.maxRangeKm, b.maxRangeKm, -1) || byNovelty(a, b);
    default:
      return byNovelty;
  }
}

export const sortModels = <T extends Sortable>(models: T[], key: SortKey): T[] =>
  [...models].sort(comparator(key));

/** Data attributes written on each card so the browser can sort without a second copy of the data. */
export function sortAttrs(m: Sortable): Record<string, string> {
  return { "data-name": m.model, "data-launch": m.launch ?? "" };
}

/** Inverse of sortAttrs + factAttrs (data-price, data-range). Empty attributes mean "datum missing". */
export function readSortable(get: (name: string) => string | null): Sortable {
  const num = (v: string | null) => (v ? Number(v) : null);
  const price = num(get("data-price"));
  return {
    model: get("data-name") ?? "",
    launch: get("data-launch") || null,
    priceFrom: price === null ? null : { value: price },
    maxRangeKm: num(get("data-range")),
  };
}
