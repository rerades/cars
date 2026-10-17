import type { ModelRecord, Sourced, Version } from "./data.ts";

/**
 * Comparator logic (PRD-003, ADR-0014). Pure and browser-safe: it must not import `node:fs` or
 * anything from Node. Type-only imports from data.ts are erased, so nothing of the loader ships.
 */

/** RF-11: published, on sale or announced, and with at least one version. */
export function isComparable(m: {
  needs_review?: boolean;
  status: { value: string };
  versions: readonly unknown[];
}): boolean {
  return (
    m.needs_review !== true &&
    (m.status.value === "on_sale" || m.status.value === "announced") &&
    m.versions.length > 0
  );
}

/**
 * RF-8: the version with the lowest price (`financed` included); on a tie, the first in the file.
 * With no prices at all, the first version. Null only for an empty list.
 */
export function defaultVersion<V extends { price?: { value: number } | null }>(versions: readonly V[]): V | null {
  let best: V | null = null;
  for (const v of versions) if (v.price && (!best || v.price.value < best.price!.value)) best = v;
  return best ?? versions[0] ?? null;
}

/** RF-9: a comparison never has more than this many columns. */
export const MAX_COLUMNS = 3;

/** One column's key (PRD-003, section 6): versions have no id, so brand + model slug + name. */
export interface ColumnKey {
  brand: string;
  slug: string;
  name: string;
}

/** A `v` parameter as read: `name` is null in the short form (`brand/model`, default version). */
export interface RawEntry {
  brand: string;
  slug: string;
  name: string | null;
}

/** Just what the selection logic needs from a model; the published and loaded shapes both fit. */
export interface SelectableModel {
  brand: string;
  slug: string;
  needs_review?: boolean;
  status: { value: string };
  versions: readonly { name: string; price?: { value: number } | null }[];
}

/**
 * Reads the repeated `v` parameters (design: «Forma de la URL»). Each decoded value is split at the
 * first two `/` only, so the rest is the `name` even if it contains `/`. `brand/model` is the short
 * form. A value that has neither shape becomes `null`, to be counted as ignored.
 */
export function parseEntries(search: string | URLSearchParams): (RawEntry | null)[] {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return params.getAll("v").map((value) => {
    const first = value.indexOf("/");
    if (first <= 0) return null;
    const second = value.indexOf("/", first + 1);
    const brand = value.slice(0, first);
    if (second === -1) {
      const slug = value.slice(first + 1);
      return slug ? { brand, slug, name: null } : null;
    }
    const slug = value.slice(first + 1, second);
    return slug ? { brand, slug, name: value.slice(second + 1) } : null;
  });
}

/** Query string (no leading `?`) with the full form of every column, in column order. */
export function writeSearch(columns: readonly ColumnKey[]): string {
  const params = new URLSearchParams();
  for (const c of columns) params.append("v", `${c.brand}/${c.slug}/${c.name}`);
  return params.toString();
}

export interface Selection {
  /** The valid columns, at most {@link MAX_COLUMNS}, in URL order. */
  columns: ColumnKey[];
  /** RF-11: values that are malformed, unknown, of an excluded model, or repeated. */
  ignored: number;
  /** RF-11, CA-2: there were more valid values than fit; only the first ones are kept. */
  tooMany: boolean;
}

/**
 * RF-11: validates entries against the models. Unknown, excluded (see {@link isComparable}) and
 * repeated values are ignored and counted; the first {@link MAX_COLUMNS} valid ones are kept. The
 * extra valid ones are not counted as ignored: they set `tooMany`. Never throws.
 */
export function validateSelection(
  entries: readonly (RawEntry | null)[],
  models: readonly SelectableModel[],
): Selection {
  const byKey = new Map(models.map((m) => [`${m.brand}/${m.slug}`, m]));
  const columns: ColumnKey[] = [];
  const seen = new Set<string>();
  let ignored = 0;
  let tooMany = false;
  for (const e of entries) {
    const model = e && byKey.get(`${e.brand}/${e.slug}`);
    if (!e || !model || !isComparable(model)) {
      ignored++;
      continue;
    }
    const name = e.name ?? defaultVersion(model.versions)?.name;
    if (name == null || !model.versions.some((v) => v.name === name)) {
      ignored++;
      continue;
    }
    const id = JSON.stringify([e.brand, e.slug, name]);
    if (seen.has(id)) {
      ignored++;
      continue;
    }
    seen.add(id);
    if (columns.length >= MAX_COLUMNS) tooMany = true;
    else columns.push({ brand: e.brand, slug: e.slug, name });
  }
  return { columns, ignored, tooMany };
}

/** Versions in the order of the model page: price ascending, unpriced last in file order. */
export function sheetOrder<V extends { price?: { value: number } | null }>(versions: readonly V[]): V[] {
  const priced = versions.filter((v) => v.price).sort((a, b) => a.price!.value - b.price!.value);
  return [...priced, ...versions.filter((v) => !v.price)];
}

/**
 * RF-8, RF-9: the version that enters when a model is added: the default one; if it is already in
 * the comparison, the next one in sheet order that is not. Null when every version is taken.
 */
export function versionToAdd(
  model: Pick<SelectableModel, "versions">,
  taken: readonly string[],
): string | null {
  const first = defaultVersion(model.versions);
  if (!first) return null;
  if (!taken.includes(first.name)) return first.name;
  return sheetOrder(model.versions).find((v) => !taken.includes(v.name))?.name ?? null;
}

/** A sourced datum as published: always the six keys, `note` null when absent (RF-3). */
export interface PublishedDatum<T = unknown> {
  value: T;
  source_id: string;
  url: string;
  retrieved: string;
  tier: string;
  note: string | null;
}
export interface PublishedBattery extends PublishedDatum<number> {
  basis: string;
}
export interface PublishedPrice extends PublishedDatum<number> {
  price_kind: string;
  price_terms: string | null;
  price_terms_url: string | null;
}
export interface PublishedVersion {
  name: string;
  price: PublishedPrice | null;
  wltp_km: PublishedDatum<number> | null;
  battery_kwh: PublishedBattery | null;
  power_kw: PublishedDatum<number> | null;
  drivetrain: PublishedDatum<string> | null;
  dc_max_kw: PublishedDatum<number> | null;
  ac_max_kw: PublishedDatum<number> | null;
}
export interface PublishedModel {
  brand: string;
  slug: string;
  brand_name: string;
  model: string;
  status: PublishedDatum<string>;
  launch: PublishedDatum<string> | null;
  versions: PublishedVersion[];
}

const datum = <T>(s: Sourced<T> | null | undefined): PublishedDatum<T> | null =>
  s == null
    ? null
    : { value: s.value, source_id: s.source_id, url: s.url, retrieved: s.retrieved, tier: s.tier, note: s.note ?? null };

function projectVersion(v: Version): PublishedVersion {
  const price = v.price
    ? {
        ...datum(v.price)!,
        price_kind: v.price.price_kind,
        price_terms: v.price.price_terms ?? null,
        price_terms_url: v.price.price_terms_url ?? null,
      }
    : null;
  const battery = v.battery_kwh ? { ...datum(v.battery_kwh)!, basis: v.battery_kwh.basis } : null;
  return {
    name: v.name,
    price,
    wltp_km: datum(v.wltp_km),
    battery_kwh: battery,
    power_kw: datum(v.power_kw),
    drivetrain: datum(v.drivetrain),
    dc_max_kw: datum(v.dc_max_kw),
    ac_max_kw: datum(v.ac_max_kw),
  };
}

/**
 * Allow-list projection of a model for `/comparar/datos/{brand}/{model}.json` (PRD-003, section 6).
 * Fields are listed one by one: a new schema field is not published until a PRD asks for it.
 * `slug` is the model's file name, the same `{modelo}` the model page uses.
 */
export function projectModel(
  m: Pick<ModelRecord, "brand" | "brand_name" | "model" | "status" | "launch" | "versions">,
  slug: string,
): PublishedModel {
  return {
    brand: m.brand,
    slug,
    brand_name: m.brand_name,
    model: m.model,
    status: datum(m.status)!,
    launch: datum(m.launch),
    versions: m.versions.map(projectVersion),
  };
}
