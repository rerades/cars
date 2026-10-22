import { formatLaunch } from "./card.ts";
import type { ModelRecord, Sourced, Tier, Version } from "./data.ts";
import { formatDecimal, formatEur, formatNumber, sourceView } from "./format.ts";
import { t, type MessageKey } from "./i18n.ts";
import { groupNotes, type NoteSource, type SourceNote } from "./notes.ts";

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

const PLURAL = new Intl.PluralRules("es");

/**
 * RF-11: the paragraphs of the URL notice, after the «Aviso:» prefix. One for ignored values (only
 * their count, never the URL's text), one for too many; empty when the URL was fully usable.
 */
export function noticeParagraphs(sel: Pick<Selection, "ignored" | "tooMany">): string[] {
  const out: string[] = [];
  if (sel.ignored > 0) {
    const form = PLURAL.select(sel.ignored) === "one" ? "one" : "other";
    out.push(t(`comparador.aviso.ignoradas.${form}`, { n: sel.ignored }));
  }
  if (sel.tooMany) out.push(t("comparador.aviso.maximo"));
  return out;
}

/**
 * RF-12: the text of «Coches comparados» when fewer than 2 versions are valid, else null (the table
 * is shown). With one valid version it asks for one more.
 */
export function emptyText(validCount: number): string | null {
  if (validCount >= 2) return null;
  return validCount === 1 ? t("comparador.vacio.unoMas") : t("comparador.vacio.texto");
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

/** One entry of `/comparar/datos/indice.json` (names only, no figures). */
export interface IndexEntry {
  brand: string;
  slug: string;
  brand_name: string;
  model: string;
  status: string;
  versions: string[];
  default_version: string | null;
}

/** RF-9: whether the «Añadir» form is offered (else the maximum text). */
export function canAdd(count: number): boolean {
  return count < MAX_COLUMNS;
}

/** RF-12: the list of columns is replaced, never mutated; these return the new list. */
export function withVersion(columns: readonly ColumnKey[], index: number, name: string): ColumnKey[] {
  const col = columns[index];
  if (!col || columns.some((c, i) => i !== index && c.brand === col.brand && c.slug === col.slug && c.name === name)) {
    return [...columns]; // RF-9: the same version never twice
  }
  return columns.map((c, i) => (i === index ? { ...c, name } : c));
}

export function withoutColumn(columns: readonly ColumnKey[], index: number): ColumnKey[] {
  return columns.filter((_, i) => i !== index);
}

/**
 * RF-8, RF-9: adds a model at the end with {@link versionToAdd}. Unchanged if the list is full, the
 * model is unknown or all its versions are taken.
 */
export function withAdded(
  columns: readonly ColumnKey[],
  model: Pick<IndexEntry, "brand" | "slug"> & { versions: readonly { name: string; price?: { value: number } | null }[] },
): ColumnKey[] {
  if (!canAdd(columns.length)) return [...columns];
  const taken = columns.filter((c) => c.brand === model.brand && c.slug === model.slug).map((c) => c.name);
  const name = versionToAdd(model, taken);
  return name == null ? [...columns] : [...columns, { brand: model.brand, slug: model.slug, name }];
}

/** Focus target after removing the column at `removed`: same position, else the previous, else «Añadir». */
export function focusAfterRemove(removed: number, remaining: number): { kind: "remove"; index: number } | { kind: "add" } {
  if (remaining === 0) return { kind: "add" };
  return { kind: "remove", index: Math.min(removed, remaining - 1) };
}

export interface VersionOption {
  name: string;
  /** Text of the option: the name, plus «(ya está en la comparación)» when taken by another column. */
  label: string;
  disabled: boolean;
}

/** RF-8, RF-9: the options of a column's version `<select>`, in sheet order; others' versions disabled. */
export function versionOptions(
  model: { brand: string; slug: string; versions: readonly { name: string; price?: { value: number } | null }[] },
  columns: readonly ColumnKey[],
  index: number,
): VersionOption[] {
  return sheetOrder(model.versions).map((v) => {
    const taken = columns.some(
      (c, i) => i !== index && c.brand === model.brand && c.slug === model.slug && c.name === v.name,
    );
    return { name: v.name, label: taken ? `${v.name} ${t("comparador.version.yaIncluida")}` : v.name, disabled: taken };
  });
}

export interface AddGroup {
  label: string;
  options: { value: string; label: string; disabled: boolean }[];
}

/**
 * RF-9, RF-11: the groups of the «Añadir» `<select>`: a group per brand and models, both in
 * alphabetical order. Announced models carry «(Próximamente)»; a model with all versions taken is
 * disabled with its suffix. Models that are not comparable are left out. `value` is `brand/slug`.
 */
export function addGroups(index: readonly IndexEntry[], columns: readonly ColumnKey[]): AddGroup[] {
  const collator = new Intl.Collator("es");
  const byBrand = new Map<string, { label: string; entries: IndexEntry[] }>();
  for (const e of index) {
    if (!isComparable({ status: { value: e.status }, versions: e.versions })) continue;
    const g = byBrand.get(e.brand) ?? { label: e.brand_name, entries: [] };
    g.entries.push(e);
    byBrand.set(e.brand, g);
  }
  return [...byBrand.values()]
    .sort((a, b) => collator.compare(a.label, b.label))
    .map((g) => ({
      label: g.label,
      options: g.entries
        .sort((a, b) => collator.compare(a.model, b.model))
        .map((e) => {
          const taken = columns.filter((c) => c.brand === e.brand && c.slug === e.slug).map((c) => c.name);
          const full = e.versions.every((n) => taken.includes(n));
          const parts = [e.model];
          if (e.status === "announced") parts.push(t("comparador.anadir.proximamente"));
          if (full) parts.push(t("comparador.anadir.completo"));
          return { value: `${e.brand}/${e.slug}`, label: parts.join(" "), disabled: full };
        }),
    }));
}

/** Announcements of the status region (one message per action). */
export function announce(
  kind: "anadido" | "quitado" | "cambio",
  m: { brand_name: string; model: string },
  name: string,
  n: number,
): string {
  return t(`comparador.anuncio.${kind}` as MessageKey, { marca: m.brand_name, modelo: m.model, nombre: name, n });
}

/** A sourced datum as published: always the six keys, `note` null when absent (RF-3). */
export interface PublishedDatum<T = unknown> {
  value: T;
  source_id: string;
  url: string;
  retrieved: string;
  tier: Tier;
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

/** The sourced datum behind a row of a version, or null. */
function fieldDatum(field: FieldId, v: PublishedVersion): PublishedDatum<unknown> | null {
  return {
    precio: v.price, autonomia: v.wltp_km, bateria: v.battery_kwh, potencia: v.power_kw,
    traccion: v.drivetrain, cargaCc: v.dc_max_kw, cargaCa: v.ac_max_kw,
  }[field];
}

/**
 * Cell of one version for one row (RF-2, RF-3, RF-5). A missing datum gives the placeholder and no
 * figure (CA-4). Values are formatted, never computed (RNF-5).
 */
export function cellView(field: FieldId, v: PublishedVersion): CellView {
  const datum = fieldDatum(field, v);
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

/** Source marks of one column: the header's (status, launch) and one per row that has a datum. */
export interface ColumnNotes {
  /** Note numbers of the header, deduplicated, in order (empty if the model is not announced). */
  header: number[];
  /** Note number of each row; absent for the price (it shows its source) and for «por confirmar». */
  cells: Partial<Record<FieldId, number>>;
}

/**
 * RF-4, CA-5: numbers the source notes of a comparison in reading order of the table: header
 * (columns left to right: status, then launch), then each row top to bottom and, within it, the
 * columns left to right. Grouping and wording are those of the model page (lib/notes.ts). The price
 * carries its source beside the figure and has no note; «por confirmar» has nothing to cite.
 * Pure: call it again whenever the selection changes.
 */
export function numberNotes(columns: readonly { model: PublishedModel; version: PublishedVersion }[]): {
  notes: SourceNote[];
  columns: ColumnNotes[];
} {
  type Slot = { col: number; field: FieldId | "status" | "launch"; datum: NoteSource };
  const walk: Slot[] = [];
  columns.forEach(({ model }, col) => {
    if (model.status.value !== "announced") return; // only announced models show a badge (RF-2)
    walk.push({ col, field: "status", datum: model.status });
    if (model.launch && formatLaunch(model.launch.value)) walk.push({ col, field: "launch", datum: model.launch });
  });
  for (const field of FIELDS) {
    if (field === "precio") continue;
    columns.forEach(({ version }, col) => {
      const datum = fieldDatum(field, version);
      if (datum && datum.value != null) walk.push({ col, field, datum });
    });
  }
  const { notes, numberOf } = groupNotes(walk.map((s) => s.datum));
  const out: ColumnNotes[] = columns.map(() => ({ header: [], cells: {} }));
  for (const s of walk) {
    const n = numberOf(s.datum);
    const target = out[s.col]!;
    if (s.field === "status" || s.field === "launch") {
      if (!target.header.includes(n)) target.header.push(n);
    } else target.cells[s.field] = n;
  }
  return { notes, columns: out };
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
