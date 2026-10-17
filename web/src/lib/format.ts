import { t, type MessageKey } from "./i18n.ts";

const eur = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" });

/** Number in es-ES, no decimals, always grouped: 36273 -> "36.273". Display rounding only. */
export function formatNumber(n: number): string {
  return eur.format(n);
}

const decimal = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, useGrouping: "always" });

/** Number in es-ES keeping the datum's own decimals (up to 2): 77.5 -> "77,5". Display only. */
export function formatDecimal(n: number): string {
  return decimal.format(n);
}

/** Amount in euros as shown on cards and model pages: "36.273 €" (key `ficha.unidad.eur`). */
export function formatEur(n: number): string {
  // Non-breaking space: the amount and the symbol never split across lines (as the card has always shown it).
  return t("ficha.unidad.eur", { n: eur.format(n) }).replace(/ /g, " ");
}

/** `YYYY-MM-DD` to "24 sep 2026". Null if it does not parse. */
export function formatDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return t("fecha.diaMesAno", {
    dia: Number(m[3]),
    mes: t(`fecha.mes.${month}` as MessageKey),
    ano: m[1],
  });
}

/** What the inline source indication shows for a datum (RF-9, CA-9): name, date, and whether it is non-official (not T1). */
export function sourceView(source: { url: string; retrieved: string; tier: string }) {
  return {
    name: sourceName(source.url) ?? source.url,
    date: formatDate(source.retrieved) ?? source.retrieved,
    unofficial: source.tier !== "T1",
  };
}

/**
 * Short source name shown to the visitor: the domain of the datum's url without "www."
 * (decision of Producto, 2026-10-06). Null if the url does not parse.
 */
export function sourceName(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}
