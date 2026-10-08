import type { Drivetrain, Segment, Status } from "./data.ts";
import type { ModelSummary } from "./derived.ts";
import { DEFAULT_SORT, parseSort, type SortKey } from "./sort.ts";

/**
 * Catalog filters of /coches (docs/design/filtros-catalogo.md). Pure: no DOM, no texts. The same
 * module runs at build time (to render the data attributes) and in the browser (to filter).
 * The state lives in the query string (RF-5); nothing is stored (RNF-5).
 */

/** What the filters read from the derived model (derived.ts). */
export type Filterable = Pick<ModelSummary, "brand" | "segment" | "maxRangeKm" | "drivetrains" | "status"> & {
  priceFrom: { value: number } | null;
};

export interface Filters {
  /** Brand slugs (folder names). OR between them. */
  brands: string[];
  segments: Segment[];
  priceMin: number | null;
  priceMax: number | null;
  /** Minimum WLTP range in km. */
  minRangeKm: number | null;
  drivetrains: Drivetrain[];
  /** null = "Todos". */
  status: Status | null;
  /** Order of the results (RF-3). Not a filter: it does not count as active. */
  sort: SortKey;
}

export const SEGMENTS: readonly Segment[] = [
  "urbano", "compacto", "berlina", "familiar", "suv_pequeno",
  "suv_compacto", "suv_grande", "monovolumen", "furgoneta", "deportivo",
];
export const RANGE_OPTIONS = [300, 400, 500, 600] as const;

/** Readable Spanish query values <-> schema values. */
export const DRIVETRAIN_PARAM: Record<Drivetrain, string> = { fwd: "delantera", rwd: "trasera", awd: "total" };
export const STATUS_PARAM: Record<Status, string> = {
  on_sale: "venta",
  announced: "proximamente",
  discontinued: "descatalogado",
};
export const DRIVETRAINS: readonly Drivetrain[] = ["fwd", "rwd", "awd"];
export const STATUSES: readonly Status[] = ["on_sale", "announced", "discontinued"];

export const NO_FILTERS: Filters = {
  brands: [],
  segments: [],
  priceMin: null,
  priceMax: null,
  minRangeKm: null,
  drivetrains: [],
  status: null,
  sort: DEFAULT_SORT,
};

const list = (v: string | null): string[] => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const uniq = <T>(a: T[]): T[] => [...new Set(a)];
const euros = (v: string | null): number | null => (v !== null && /^\d{1,9}$/.test(v) ? Number(v) : null);

/** Parses a query string. Invalid values are ignored, never an error (filtros-catalogo.md, "Estados y errores"). */
export function parseFilters(search: string): Filters {
  const q = new URLSearchParams(search);
  const range = euros(q.get("autonomia"));
  const status = [...Object.entries(STATUS_PARAM)].find(([, p]) => p === q.get("estado"))?.[0] as Status | undefined;
  return {
    brands: uniq(list(q.get("marca")).filter((b) => /^[a-z0-9][a-z0-9-]*$/.test(b))),
    segments: uniq(list(q.get("segmento")).filter((s): s is Segment => (SEGMENTS as readonly string[]).includes(s))),
    priceMin: euros(q.get("precio_min")),
    priceMax: euros(q.get("precio_max")),
    minRangeKm: range !== null && (RANGE_OPTIONS as readonly number[]).includes(range) ? range : null,
    drivetrains: uniq(
      list(q.get("traccion")).flatMap((p) => DRIVETRAINS.filter((d) => DRIVETRAIN_PARAM[d] === p)),
    ),
    status: status ?? null,
    sort: parseSort(q.get("orden")),
  };
}

/** Query string (with the leading "?", or "" when there is no filter). Round-trips with parseFilters. */
export function toSearch(f: Filters): string {
  const q = new URLSearchParams();
  if (f.brands.length) q.set("marca", f.brands.join(","));
  if (f.segments.length) q.set("segmento", f.segments.join(","));
  if (f.priceMin !== null) q.set("precio_min", String(f.priceMin));
  if (f.priceMax !== null) q.set("precio_max", String(f.priceMax));
  if (f.minRangeKm !== null) q.set("autonomia", String(f.minRangeKm));
  if (f.drivetrains.length) q.set("traccion", f.drivetrains.map((d) => DRIVETRAIN_PARAM[d]).join(","));
  if (f.status) q.set("estado", STATUS_PARAM[f.status]);
  if (f.sort !== DEFAULT_SORT) q.set("orden", f.sort);
  const s = q.toString().replace(/%2C/g, ",");
  return s ? `?${s}` : "";
}

/** "Desde" greater than "Hasta": the range is not applied until corrected. */
export const hasRangeError = (f: Filters): boolean =>
  f.priceMin !== null && f.priceMax !== null && f.priceMin > f.priceMax;

/** Number of active filters, as shown in "Filtros (n)". A price range counts once per bound. */
export function activeCount(f: Filters): number {
  return (
    f.brands.length +
    f.segments.length +
    f.drivetrains.length +
    (f.priceMin !== null ? 1 : 0) +
    (f.priceMax !== null ? 1 : 0) +
    (f.minRangeKm !== null ? 1 : 0) +
    (f.status ? 1 : 0)
  );
}

/**
 * Whether the model passes the filters. A model missing the filtered datum (segment, range,
 * drivetrain, price) does not pass: it cannot be claimed to meet the filter (RF-12, CA-15).
 */
export function matches(m: Filterable, f: Filters): boolean {
  if (f.brands.length && !f.brands.includes(m.brand)) return false;
  if (f.segments.length && !(m.segment !== null && f.segments.includes(m.segment))) return false;
  if (f.status && m.status !== f.status) return false;
  if (f.minRangeKm !== null && !(m.maxRangeKm !== null && m.maxRangeKm >= f.minRangeKm)) return false;
  if (f.drivetrains.length && !m.drivetrains.some((d) => f.drivetrains.includes(d))) return false;
  if (!hasRangeError(f) && (f.priceMin !== null || f.priceMax !== null)) {
    const p = m.priceFrom?.value;
    if (p === undefined) return false;
    if (f.priceMin !== null && p < f.priceMin) return false;
    if (f.priceMax !== null && p > f.priceMax) return false;
  }
  return true;
}

export const applyFilters = <T extends Filterable>(models: T[], f: Filters): T[] =>
  models.filter((m) => matches(m, f));

/** Same thing from a raw query string: what the browser does with `location.search`. */
export const filterBySearch = <T extends Filterable>(models: T[], search: string): T[] =>
  applyFilters(models, parseFilters(search));

/** Data attributes written on each card so the browser filters without shipping a second copy of the data. */
export function factAttrs(m: Filterable): Record<string, string> {
  return {
    "data-brand": m.brand,
    "data-segment": m.segment ?? "",
    "data-price": m.priceFrom ? String(m.priceFrom.value) : "",
    "data-range": m.maxRangeKm === null ? "" : String(m.maxRangeKm),
    "data-drivetrains": m.drivetrains.join(" "),
    "data-status": m.status,
  };
}

/** Inverse of factAttrs. Unknown or empty attributes mean "datum missing". */
export function readFacts(get: (name: string) => string | null): Filterable {
  const num = (v: string | null) => (v ? Number(v) : null);
  const seg = get("data-segment");
  const status = get("data-status");
  const price = num(get("data-price"));
  return {
    brand: get("data-brand") ?? "",
    segment: seg && (SEGMENTS as readonly string[]).includes(seg) ? (seg as Segment) : null,
    priceFrom: price === null ? null : { value: price },
    maxRangeKm: num(get("data-range")),
    drivetrains: (get("data-drivetrains") ?? "").split(" ").filter((d): d is Drivetrain =>
      (DRIVETRAINS as readonly string[]).includes(d),
    ),
    status: (STATUSES as readonly string[]).includes(status ?? "") ? (status as Status) : "on_sale",
  };
}
