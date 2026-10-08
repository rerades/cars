/**
 * CI entry point of ADR-0010: validates all of data/raw/ and the source registry with the factory
 * checks (evals.ts). Errors print as ::error and exit 1; warnings print as ::warning and, in
 * GitHub Actions, go to the step summary grouped by brand. Run: node factory/validate-data.ts
 */
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { validateData, type DataReport } from "./evals.ts";

/** ADR-0010, point 3: the Researcher writes local dates, so "today" is Madrid's, not UTC's. */
export const madridToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(now);

/** The brand a file belongs to; sources are the registry. */
export const brandOf = (file: string) => /^data\/(?:raw|images)\/([^/]+)\//.exec(file)?.[1] ?? "registro";

/** Markdown summary: counts, overdue brands (age warnings) and the warnings grouped by brand. */
export function summary(r: DataReport): string {
  const lines = [`## Datos (ADR-0010)`, "", `${r.checked} ficheros · ${r.errors.length} errores · ${r.warnings.length} avisos`];
  const overdue = [...new Set(r.warnings.filter((w) => w.stale).map((w) => brandOf(w.file)))].sort();
  if (overdue.length) lines.push("", `**Marcas vencidas** (refresco mensual): ${overdue.join(", ")}`);
  if (r.errors.length) lines.push("", "### Errores", ...r.errors.map((e) => `- ${e}`));
  const byBrand = new Map<string, string[]>();
  for (const w of r.warnings) byBrand.set(brandOf(w.file), [...(byBrand.get(brandOf(w.file)) ?? []), w.message]);
  for (const [brand, msgs] of [...byBrand].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push("", `### ${brand}`, ...msgs.map((m) => `- ${m}`));
  }
  return lines.join("\n") + "\n";
}

if (import.meta.main) {
  const report = validateData(join(import.meta.dirname, ".."), madridToday());
  for (const e of report.errors) console.log(`::error file=${e.slice(0, e.indexOf(":"))}::${e}`);
  for (const w of report.warnings) console.log(`::warning file=${w.file}::${w.message}`);
  console.log(`${report.checked} ficheros, ${report.errors.length} errores, ${report.warnings.length} avisos`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(report));
  process.exitCode = report.errors.length ? 1 : 0;
}
