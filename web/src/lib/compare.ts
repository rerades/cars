import { formatLaunch } from "./card.ts";
import type { ModelRecord, Sourced, Version } from "./data.ts";
import { formatDecimal, formatEur, formatNumber, sourceView } from "./format.ts";
import { t, type MessageKey } from "./i18n.ts";

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

/** The seven rows of the table, in the order of the design (comparador.md, «Filas y formato»). */
export const FIELDS = ["precio", "autonomia", "bateria", "potencia", "traccion", "cargaCc", "cargaCa"] as const;
export type FieldId = (typeof FIELDS)[number];

/** Label of a row (`ficha.campo.*`, shared with the model page). */
export function fieldLabel(field: FieldId): string {
  return t(`ficha.campo.${field}` as MessageKey);
}

/** What one cell shows. Everything is already formatted: the DOM code only copies it. */
export interface CellView {
  /** The value, or «por confirmar» / «Precio por confirmar»: never a figure when `missing`. */
  text: string;
  missing: boolean;
  /** «Precio con oferta» for a `financed` price (RF-5), else null. */
  deal: string | null;
  /** The datum's `note`, verbatim (RF-5), else null. */
  note: string | null;
  /** True when the datum's `tier` is not T1: «fuente no oficial» goes with it (RF-4, CA-17). */
  unofficial: boolean;
  /** Price only: parts of the source line. */
  source: { name: string; date: string; url: string } | null;
  /** Price only, `financed`: literal conditions and their link (RF-5). */
  terms: { text: string | null; url: string | null } | null;
}

/** The drivetrain label (`traccion.*`); an unknown code is shown as it comes, never invented. */
function drivetrainLabel(code: string): string {
  return code === "fwd" || code === "rwd" || code === "awd" ? t(`traccion.${code}` as MessageKey) : code;
}

/**
 * Cell of one version for one row (RF-2, RF-3, RF-5). A missing datum gives the placeholder and no
 * figure (CA-4). Values are formatted, never computed (RNF-5).
 */
export function cellView(field: FieldId, v: PublishedVersion): CellView {
  const datum: PublishedDatum<unknown> | null = {
    precio: v.price, autonomia: v.wltp_km, bateria: v.battery_kwh, potencia: v.power_kw,
    traccion: v.drivetrain, cargaCc: v.dc_max_kw, cargaCa: v.ac_max_kw,
  }[field];
  if (datum == null || datum.value == null) {
    const text = field === "precio" ? t("ficha.precio.porConfirmar") : t("ficha.porConfirmar");
    return { text, missing: true, unofficial: false, deal: null, note: null, source: null, terms: null };
  }
  const base = { missing: false, unofficial: datum.tier !== "T1", deal: null, note: datum.note ?? null, source: null, terms: null };
  const n = datum.value as number;
  switch (field) {
    case "precio": {
      const p = v.price!;
      const s = sourceView(p);
      const financed = p.price_kind === "financed";
      return {
        ...base,
        // Plain space, not the card's non-breaking one: a 80 px column may break before «€» (design).
        text: formatEur(n).replace(/ /g, " "),
        deal: financed ? t("ficha.precio.oferta") : null,
        source: { name: s.name, date: s.date, url: p.url },
        terms: financed ? { text: p.price_terms, url: p.price_terms_url } : null,
      };
    }
    case "autonomia":
      return { ...base, text: t("ficha.unidad.km", { n: formatNumber(n) }) };
    case "bateria": {
      const basis = v.battery_kwh!.basis;
      const key = basis === "usable" || basis === "gross" ? basis : "unknown";
      return { ...base, text: t(`ficha.bateria.${key}` as MessageKey, { kwh: formatDecimal(n) }) };
    }
    case "potencia":
    case "cargaCc":
    case "cargaCa":
      return { ...base, text: t("ficha.unidad.kw", { n: formatDecimal(n) }) };
    case "traccion":
      return { ...base, text: drivetrainLabel(String(datum.value)) };
  }
}

/** Column header (RF-1, RF-2): link to the model page and the «Próximamente» badge if announced. */
export function headerView(m: PublishedModel, v: PublishedVersion) {
  const when = m.launch ? formatLaunch(m.launch.value) : null;
  return {
    brand: m.brand_name,
    model: m.model,
    name: v.name,
    href: `/marcas/${m.brand}/${m.slug}/`,
    srSuffix: t("comparador.fichaSr"),
    badge:
      m.status.value === "announced"
        ? when ? t("ficha.estado.proximamenteFecha", { fecha: when }) : t("ficha.estado.proximamente")
        : null,
  };
}

/** Title of a column's entry in «Condiciones de las ofertas»: «{marca} {modelo}, {nombre}». */
export function conditionTitle(m: PublishedModel, v: PublishedVersion): string {
  return t("comparador.condiciones.entrada", { marca: m.brand_name, modelo: m.model, nombre: v.name });
}

/**
 * The distinct models named by the URL, in order of appearance, which the script has to fetch.
 * Capped so a hand-written URL cannot trigger a flood of requests; 404s are ignored later (RF-11).
 */
export const MAX_FETCHED_MODELS = 12;
export function modelsToFetch(entries: readonly (RawEntry | null)[]): { brand: string; slug: string }[] {
  const out = new Map<string, { brand: string; slug: string }>();
  for (const e of entries) {
    if (e && out.size < MAX_FETCHED_MODELS) out.set(`${e.brand}/${e.slug}`, { brand: e.brand, slug: e.slug });
  }
  return [...out.values()];
}
