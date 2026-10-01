import type { ModelRecord } from "./data.ts";
import { t, type MessageKey } from "./i18n.ts";

/**
 * Presentation of a model for its card. Only formats what `ModelRecord` already derived
 * (price_from, max_range_km, status, launch); it computes nothing from the versions.
 */
export interface CardView {
  /** "{brand}/{model}" from the data file name; the model page lives at /marcas/{key}/ (PRD-002, RF-1). */
  key: string;
  brand: string;
  model: string;
  /** "Próximamente · oct 2026", "Descatalogado", or null for a plain on-sale model. */
  statusLabel: string | null;
  statusKind: "soon" | "discontinued" | null;
  priceLabel: string;
  hasPrice: boolean;
  /** "Precio con oferta" when the price is `financed` (not a PVP), else null. */
  dealLabel: string | null;
  rangeLabel: string;
  hasRange: boolean;
  segmentLabel: string;
  hasSegment: boolean;
  labels: { price: string; range: string; segment: string };
}

const eur = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" });
const monthYear = new Intl.DateTimeFormat("es-ES", { month: "short", year: "numeric", timeZone: "UTC" });

/** `YYYY-MM` or `YYYY-MM-DD` to "oct 2026". Null if it does not parse. */
export function formatLaunch(launch: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(launch);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  if (Number.isNaN(date.getTime())) return null;
  return monthYear.format(date).replace(".", "").replace(/ de /, " ");
}

export function cardView(m: ModelRecord): CardView {
  let statusLabel: string | null = null;
  let statusKind: CardView["statusKind"] = null;
  if (m.status.value === "announced") {
    const when = m.launch ? formatLaunch(m.launch.value) : null;
    statusLabel = when
      ? t("tarjeta.estado.proximamenteFecha", { fecha: when })
      : t("tarjeta.estado.proximamente");
    statusKind = "soon";
  } else if (m.status.value === "discontinued") {
    statusLabel = t("tarjeta.estado.descatalogado");
    statusKind = "discontinued";
  }
  const price = m.price_from;
  return {
    key: m.file.replace(/\.yaml$/, ""),
    brand: m.brand_name,
    model: m.model,
    statusLabel,
    statusKind,
    hasPrice: price !== null,
    priceLabel: price
      ? t("tarjeta.precio", { precio: `${eur.format(price.value)} €` })
      : t("tarjeta.precioPendiente"),
    dealLabel: price?.price_kind === "financed" ? t("tarjeta.oferta") : null,
    hasRange: m.max_range_km !== null,
    rangeLabel: m.max_range_km
      ? t("tarjeta.autonomia", { km: eur.format(m.max_range_km.value) })
      : t("tarjeta.autonomiaPendiente"),
    hasSegment: m.segment !== null,
    segmentLabel: m.segment
      ? t(`segmento.${m.segment.value}` as MessageKey)
      : t("tarjeta.segmentoPendiente"),
    labels: {
      price: t("tarjeta.etiqueta.precio"),
      range: t("tarjeta.etiqueta.autonomia"),
      segment: t("tarjeta.etiqueta.segmento"),
    },
  };
}
