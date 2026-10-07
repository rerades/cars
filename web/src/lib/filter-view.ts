import type { ModelRecord } from "./data.ts";
import { DRIVETRAINS, RANGE_OPTIONS, SEGMENTS, STATUSES, DRIVETRAIN_PARAM, STATUS_PARAM } from "./filter.ts";
import { t, type MessageKey } from "./i18n.ts";

/** Everything the filter panel shows, already in Spanish (RNF-4): the component only lays it out. */
export interface Option {
  /** Value written in the query string. */
  value: string;
  label: string;
  /** Text of the active-filter chip. */
  chip: string;
  count?: number;
}

export interface FilterPanelView {
  title: string;
  brands: Option[];
  /** Empty when no model has a segment: the group is not shown (filtros-catalogo.md). */
  segments: Option[];
  drivetrains: Option[];
  statuses: Option[];
  ranges: { value: string; label: string; chip: string }[];
  /** Options of the order selector; `value` is the `orden` query value (sort.ts). */
  sorts: { value: string; label: string }[];
  labels: Record<
    "sort" | "brand" | "segment" | "price" | "range" | "drivetrain" | "status" | "priceFrom" | "priceTo" | "clear" |
    "open" | "drivetrainHelp" | "rangeError" | "active" | "all" | "anyRange" | "emptyTitle" | "emptyText",
    string
  >;
  /** Message templates the browser fills in ({n}, {filtro}, {precio}). */
  messages: Record<string, string>;
}

export function filterPanelView(models: ModelRecord[]): FilterPanelView {
  const brands = new Map<string, { name: string; count: number }>();
  const segments = new Map<string, number>();
  for (const m of models) {
    const b = brands.get(m.brand) ?? { name: m.brand_name, count: 0 };
    b.count++;
    brands.set(m.brand, b);
    if (m.segment) segments.set(m.segment.value, (segments.get(m.segment.value) ?? 0) + 1);
  }
  return {
    title: t("filtros.titulo"),
    brands: [...brands.entries()]
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([value, { name, count }]) => ({ value, label: name, chip: name, count })),
    segments: SEGMENTS.filter((s) => segments.has(s)).map((s) => {
      const label = t(`segmento.${s}` as MessageKey);
      return { value: s, label, chip: label, count: segments.get(s) };
    }),
    drivetrains: DRIVETRAINS.map((d) => {
      const label = t(`traccion.${d}` as MessageKey);
      return { value: DRIVETRAIN_PARAM[d], label, chip: label };
    }),
    statuses: STATUSES.map((s) => {
      const label = t(`estado.${STATUS_PARAM[s]}` as MessageKey);
      return { value: STATUS_PARAM[s], label, chip: label };
    }),
    ranges: RANGE_OPTIONS.map((km) => ({
      value: String(km),
      label: t("filtros.autonomiaMin", { km }),
      chip: t("filtros.chipAutonomia", { km }),
    })),
    sorts: [
      { value: "novedad", label: t("orden.novedad") },
      { value: "precio-asc", label: t("orden.precioAsc") },
      { value: "precio-desc", label: t("orden.precioDesc") },
      { value: "autonomia-desc", label: t("orden.autonomiaDesc") },
    ],
    labels: {
      sort: t("orden.etiqueta"),
      brand: t("filtros.marca"),
      segment: t("filtros.segmento"),
      price: t("filtros.precio"),
      range: t("filtros.autonomia"),
      drivetrain: t("filtros.traccion"),
      status: t("filtros.estado"),
      priceFrom: t("filtros.precioDesde"),
      priceTo: t("filtros.precioHasta"),
      clear: t("filtros.limpiar"),
      open: t("filtros.abrir", { n: "{n}" }),
      drivetrainHelp: t("filtros.traccionAyuda"),
      rangeError: t("filtros.errorRango"),
      active: t("filtros.activos"),
      all: t("estado.todos"),
      anyRange: t("filtros.autonomiaCualquiera"),
      emptyTitle: t("vacio.titulo"),
      emptyText: t("vacio.texto"),
    },
    messages: {
      zero: t("resumen.cero"),
      one: t("resumen.uno"),
      many: t("resumen.n", { n: "{n}" }),
      show: t("filtros.verModelos", { n: "{n}" }),
      open: t("filtros.abrir", { n: "{n}" }),
      remove: t("filtros.quitar", { filtro: "{filtro}" }),
      chipFrom: t("filtros.chipDesde", { precio: "{precio}" }),
      chipTo: t("filtros.chipHasta", { precio: "{precio}" }),
    },
  };
}
