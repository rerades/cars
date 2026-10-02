import type { ModelRecord } from "./data.ts";
import { t } from "./i18n.ts";

/** "Ningún modelo" / "1 modelo" / "{n} modelos" (resumen.*). */
export function countLabel(n: number): string {
  return n === 0 ? t("resumen.cero") : n === 1 ? t("resumen.uno") : t("resumen.n", { n });
}

/** "2026-10-15" -> 202610; models without a launch date sort last (RF-3). */
function launchKey(m: ModelRecord): number {
  const match = m.launch ? /^(\d{4})-(\d{2})/.exec(m.launch.value) : null;
  return match ? Number(match[1]) * 100 + Number(match[2]) : -1;
}

/** Default order of the pregenerated pages ("Novedad", RF-3): newest launch first, no date last, then by name. */
export function sortByNovelty(models: ModelRecord[]): ModelRecord[] {
  return [...models].sort((a, b) => launchKey(b) - launchKey(a) || a.model.localeCompare(b.model));
}

export interface BrandPage {
  /** URL slug: the brand folder name, as in the card links (/marcas/{slug}/...). */
  slug: string;
  /** Presentation name (`brand_name`). */
  name: string;
  models: ModelRecord[];
}

/**
 * One entry per brand that has published models (CA-12a). `models` must come from loadModels(),
 * which already excludes needs_review (RF-13), so a brand without published models has no page.
 */
export function brandPages(models: ModelRecord[]): BrandPage[] {
  const bySlug = new Map<string, BrandPage>();
  for (const m of models) {
    const page = bySlug.get(m.brand) ?? { slug: m.brand, name: m.brand_name, models: [] };
    page.models.push(m);
    bySlug.set(m.brand, page);
  }
  return [...bySlug.values()]
    .map((p) => ({ ...p, models: sortByNovelty(p.models) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
