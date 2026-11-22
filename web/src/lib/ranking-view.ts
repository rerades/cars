import { PRICE_BANDS } from "./catalog.ts";
import type { ModelRecord, Price } from "./data.ts";
import { formatDecimal, formatEur, formatNumber, sourceView } from "./format.ts";
import { t, type MessageKey } from "./i18n.ts";
import {
  candidates,
  leftOut,
  rankPlaces,
  rankingById,
  termsAnchorId,
  type RankingDef,
  type RankingId,
} from "./rankings.ts";

/** What one place of a ranking shows (docs/design/rankings.md, "Lista de puestos"). */
export interface PlaceView {
  /** Number with ties: 1, 2, 2, 4. */
  place: number;
  /** True when a neighbour in the list has the same figure, hence the same place. */
  tied: boolean;
  brand: string;
  model: string;
  /** `/marcas/{brand}/{model}/`. */
  href: string;
  version: string;
  /** Translated segment, or "Segmento por confirmar". */
  segment: string;
  hasSegment: boolean;
  /** The figure with its unit and nothing else ("58 kWh"), formatted like the model page. */
  figure: string;
  /** Label of the figure: the field, and for the battery its basis stuck to it ("Batería · útil"). */
  figureLabel: string;
  source: { name: string; date: string; url: string; unofficial: boolean };
  /** `note` of the figure, literal. */
  note: string | null;
  /** Offer data of a `financed` price in the price ranking (RF-5); null for `pvp` and for other rankings. */
  deal: DealView | null;
}

/** One entry of "Condiciones de las ofertas": also the content of the `<template>` entry (#377). */
export interface DealView {
  /** Anchor id, derived from (brand, model slug, version name) and not from the place. */
  id: string;
  /** "{marca} {modelo}, {versión}". */
  title: string;
  /** `price_terms`, literal. */
  terms: string;
  termsUrl: string;
}

/** Splits `price_terms` into paragraphs like the model page does. */
export const termsParagraphs = (text: string) => text.split(/\n\s*\n/).filter((p) => p.trim() !== "");

const FIELD_LABEL: Record<RankingId, MessageKey> = {
  precio: "ficha.campo.precio",
  autonomia: "ficha.campo.autonomia",
  bateria: "ficha.campo.bateria",
  potencia: "ficha.campo.potencia",
  cargaCc: "ficha.campo.cargaCc",
};

/**
 * Value and label of the figure of a place, shared by the build and the filter script so both paint
 * the same. The value never carries the battery basis: it goes in the label (PRD-005, decision 9).
 */
export function figureParts(
  def: RankingDef,
  figure: { value: number; basis?: "usable" | "gross" | "unknown" },
): { text: string; label: string } {
  const n = figure.value;
  const text = ({
    price: () => formatEur(n),
    wltp_km: () => t("ficha.unidad.km", { n: formatNumber(n) }),
    battery_kwh: () => t("ficha.unidad.kwh", { n: formatDecimal(n) }),
    power_kw: () => t("ficha.unidad.kw", { n: formatDecimal(n) }),
    dc_max_kw: () => t("ficha.unidad.kw", { n: formatDecimal(n) }),
  } as Record<string, () => string>)[def.field]?.() ?? String(n);
  const campo = t(FIELD_LABEL[def.id]);
  if (def.field !== "battery_kwh") return { text, label: campo };
  const base = t(`ranking.cifra.base.${figure.basis ?? "unknown"}` as MessageKey);
  return { text, label: t("ranking.cifra.etiqueta", { campo, base }) };
}

/** The places (max 10) of a ranking, ready to paint. Selection and numbering come from rankings.ts. */
export function placeViews(models: readonly ModelRecord[], ranking: RankingId | RankingDef): PlaceView[] {
  const def = typeof ranking === "string" ? rankingById(ranking) : ranking;
  const places = rankPlaces(candidates(models, def), def);
  return places.map(({ place, entry }, i) => {
    const { model, version, figure } = entry;
    const parts = figureParts(def, figure as { value: number; basis?: "usable" | "gross" | "unknown" });
    const sameAs = (j: number) => places[j] !== undefined && places[j].place === place;
    return {
      place,
      tied: sameAs(i - 1) || sameAs(i + 1),
      brand: model.brand_name,
      model: model.model,
      href: `/marcas/${model.file.replace(/\.yaml$/, "")}/`,
      version: version.name,
      segment: model.segment
        ? t(`segmento.${model.segment.value}` as MessageKey)
        : t("tarjeta.segmentoPendiente"),
      hasSegment: model.segment !== null,
      figure: parts.text,
      figureLabel: parts.label,
      source: { ...sourceView(figure), url: figure.url },
      note: figure.note ?? null,
      deal: dealOf(model, version.name, def, figure as Partial<Price>),
    };
  });
}

function dealOf(model: ModelRecord, name: string, def: RankingDef, price: Partial<Price>): DealView | null {
  if (def.field !== "price" || price.price_kind !== "financed") return null;
  return {
    id: termsAnchorId(model.brand, model.file.replace(/\.yaml$/, "").split("/").pop()!, name),
    title: t("comparador.condiciones.entrada", { marca: model.brand_name, modelo: model.model, nombre: name }),
    terms: price.price_terms ?? "",
    termsUrl: price.price_terms_url ?? "",
  };
}

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Options of the two filter selects (docs/design/rankings.md, "Filtros"). Segments: only those some
 * version of this ranking has, alphabetical by label; empty = the control is not painted. Price bands:
 * the three of `PRICE_BANDS`, always.
 */
export function filterOptions(
  models: readonly ModelRecord[],
  ranking: RankingId | RankingDef,
): { segments: FilterOption[]; prices: FilterOption[] } {
  const present = new Set<string>();
  for (const c of candidates(models, ranking)) if (c.model.segment) present.add(c.model.segment.value);
  const segments = [...present]
    .map((value) => ({ value, label: t(`segmento.${value}` as MessageKey) }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  const prices = PRICE_BANDS.map((b) => ({ value: b.slug, label: t(`explorar.precio.${b.key}` as MessageKey) }));
  return { segments, prices };
}

/** What the page shows below the list (RF-15, CA-18): the "data" noun of the ranking and the count. */
export interface LeftOutView {
  count: number;
  text: string;
}

/** Sentence of RF-15 for the `out` set of the ranking (no filters yet: #376 passes a filtered set). */
export function leftOutView(models: readonly ModelRecord[], ranking: RankingId | RankingDef): LeftOutView {
  const def = typeof ranking === "string" ? rankingById(ranking) : ranking;
  const count = leftOut(models, def).length;
  const dato = t(`${def.textKey}.dato` as MessageKey);
  const key = count === 0 ? "ranking.fuera.ninguna" : count === 1 ? "ranking.fuera.uno" : "ranking.fuera.n";
  return { count, text: t(key, { n: count, dato }) };
}
