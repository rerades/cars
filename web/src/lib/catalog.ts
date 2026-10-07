import type { ModelRecord, Segment } from "./data.ts";
import { summarize } from "./derived.ts";
import { t, type MessageKey } from "./i18n.ts";
import { sortModels } from "./sort.ts";

/** "Ningún modelo" / "1 modelo" / "{n} modelos" (resumen.*). */
export function countLabel(n: number): string {
  return n === 0 ? t("resumen.cero") : n === 1 ? t("resumen.uno") : t("resumen.n", { n });
}

/**
 * Default order of the pregenerated pages and of the served /coches ("Novedad", RF-3, CA-16): newest
 * launch first, no date last, then by name. The rule lives in sort.ts, shared with the browser.
 */
export function sortByNovelty(models: ModelRecord[]): ModelRecord[] {
  return sortModels(
    models.map((m) => ({ m, ...summarize(m) })),
    "novedad",
  ).map(({ m }) => m);
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

/** A pregenerated page at `/{section}/{slug}/`, whose texts live under `pagina.<section>.<key>.*`. */
export interface CriterionPage {
  slug: string;
  /** Key fragment of the page texts and of the Explorar label. */
  key: string;
  models: ModelRecord[];
}

/** RF-10: segment URL value, lowercase with hyphens (`suv_compacto` -> `suv-compacto`). */
export const segmentSlug = (s: Segment): string => s.replaceAll("_", "-");

/** One entry per segment that has models (CA-12a). A model without segment is on none (RF-12). */
export function segmentPages(models: ModelRecord[]): CriterionPage[] {
  const bySegment = new Map<Segment, ModelRecord[]>();
  for (const m of models) {
    if (!m.segment) continue;
    bySegment.set(m.segment.value, [...(bySegment.get(m.segment.value) ?? []), m]);
  }
  return [...bySegment.entries()]
    .map(([segment, list]) => ({ slug: segmentSlug(segment), key: segment, models: sortByNovelty(list) }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

interface Band {
  slug: string;
  key: string;
  /** Receives the model's "price from" or max WLTP range; models without the value never reach it (RF-12). */
  accepts: (value: number) => boolean;
}

/** RF-10 price bands, on "price from" (RF-9 offers included). Edges: <= 30000 · (30000, 45000] · > 45000. */
export const PRICE_BANDS: Band[] = [
  { slug: "hasta-30000-euros", key: "hasta30000", accepts: (v) => v <= 30000 },
  { slug: "de-30000-a-45000-euros", key: "de30000a45000", accepts: (v) => v > 30000 && v <= 45000 },
  { slug: "mas-de-45000-euros", key: "masDe45000", accepts: (v) => v > 45000 },
];

/** RF-10 range bands (CA-2 rule: some version >= the edge, i.e. max range >= edge). They overlap on purpose. */
export const RANGE_BANDS: Band[] = [
  { slug: "mas-de-400-km", key: "masDe400", accepts: (v) => v >= 400 },
  { slug: "mas-de-500-km", key: "masDe500", accepts: (v) => v >= 500 },
];

function bandPages(models: ModelRecord[], bands: Band[], value: (m: ModelRecord) => number | null): CriterionPage[] {
  return bands.map((b) => ({
    slug: b.slug,
    key: b.key,
    models: sortByNovelty(
      models.filter((m) => {
        const v = value(m);
        return v !== null && b.accepts(v);
      }),
    ),
  }));
}

/** Always one page per band, even empty (CA-12a). */
export const pricePages = (models: ModelRecord[]): CriterionPage[] =>
  bandPages(models, PRICE_BANDS, (m) => m.price_from?.value ?? null);

export const rangePages = (models: ModelRecord[]): CriterionPage[] =>
  bandPages(models, RANGE_BANDS, (m) => m.max_range_km?.value ?? null);

export interface ExploreGroup {
  label: string;
  links: { label: string; href: string; current: boolean }[];
}

/**
 * "Explorar" strip (paginas-catalogo.md): only links to pages that exist (CA-12a); a group without
 * links is dropped. `currentHref` is the page being rendered, e.g. "/marcas/cupra/".
 */
export function exploreGroups(models: ModelRecord[], currentHref: string): ExploreGroup[] {
  const link = (label: string, href: string) => ({ label, href, current: href === currentHref });
  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "es");
  const groups: ExploreGroup[] = [
    {
      label: t("explorar.marcas"),
      links: brandPages(models).map((b) => link(b.name, `/marcas/${b.slug}/`)).sort(byLabel),
    },
    {
      label: t("explorar.segmentos"),
      links: segmentPages(models)
        .map((s) => link(t(`segmento.${s.key}` as MessageKey), `/segmentos/${s.slug}/`))
        .sort(byLabel),
    },
    {
      label: t("explorar.precio"),
      links: PRICE_BANDS.map((b) => link(t(`explorar.precio.${b.key}` as MessageKey), `/precio/${b.slug}/`)),
    },
    {
      label: t("explorar.autonomia"),
      links: RANGE_BANDS.map((b) =>
        link(t(`explorar.autonomia.${b.key}` as MessageKey), `/autonomia/${b.slug}/`),
      ),
    },
  ];
  return groups.filter((g) => g.links.length > 0);
}

/** Title and intro of a criterion page (+ its common tail), composed from the `pagina.*` keys (RNF-4). */
export function criterionTexts(section: "segmento" | "precio" | "autonomia", key: string): { title: string; intro: string } {
  const k = (suffix: string) => `pagina.${section}.${suffix}` as MessageKey;
  return {
    title: t(k(`${key}.titulo`)),
    intro: `${t(k(`${key}.entrada`))} ${t(k("coletilla"))}`,
  };
}
