import { FIXTURE_METRIC_LABELS, type TestResult } from "./data.ts";
import { es, t, type MessageKey } from "./i18n.ts";

/** Metric-name suffix -> `ficha.unidad.*` key (docs/design/ficha-modelo.md, «Cada resultado de prueba»). */
const UNIT_BY_SUFFIX: Record<string, MessageKey> = {
  _km: "ficha.unidad.km",
  _kw: "ficha.unidad.kw",
  _kwh: "ficha.unidad.kwh",
  _eur: "ficha.unidad.eur",
};

/** The label of a metric, or null: a metric without a label is not shown (never its `snake_case` id). */
export function metricLabel(metric: string): string | null {
  const key = `ficha.pruebas.metrica.${metric}`;
  if (Object.hasOwn(es, key)) return es[key as MessageKey];
  return Object.hasOwn(FIXTURE_METRIC_LABELS, metric) ? FIXTURE_METRIC_LABELS[metric] : null;
}

/** Decimals the number carries as written: 4.5 -> 1, 412 -> 0. */
function decimalsOf(n: number): number {
  const s = String(n);
  if (s.includes("e")) return 0;
  return s.split(".")[1]?.length ?? 0;
}

/** Value in es-ES with the decimals of the datum (no rounding, no padding) and the unit of the metric suffix. */
export function formatMetricValue(metric: string, value: number): string {
  const d = decimalsOf(value);
  const n = new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" }).format(value);
  const suffix = Object.keys(UNIT_BY_SUFFIX).find((s) => metric.endsWith(s));
  return suffix ? t(UNIT_BY_SUFFIX[suffix], { n }) : n;
}

export interface TestResultView {
  result: TestResult;
  label: string;
  value: string;
  organism: string;
}

/** Results that can be shown: with a label, a numeric value and an organism name. Order of the file. */
export function publishableResults(results: TestResult[]): TestResultView[] {
  return results.flatMap((result) => {
    const label = metricLabel(result.metric);
    if (label === null || typeof result.value !== "number" || !result.organism) return [];
    return [{ result, label, value: formatMetricValue(result.metric, result.value), organism: result.organism }];
  });
}
