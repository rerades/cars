import type { ModelRecord } from "./data.ts";
import { formatEur, sourceView } from "./format.ts";
import { t, type MessageKey } from "./i18n.ts";
import { candidates, rankPlaces, rankingById, type RankingDef, type RankingId } from "./rankings.ts";
import { versionFields } from "./version-fields.ts";

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
  /** The figure with its unit (battery with its basis), formatted like the model page. */
  figure: string;
  source: { name: string; date: string; url: string; unofficial: boolean };
  /** `note` of the figure, literal. */
  note: string | null;
}

/** The places (max 10) of a ranking, ready to paint. Selection and numbering come from rankings.ts. */
export function placeViews(models: readonly ModelRecord[], ranking: RankingId | RankingDef): PlaceView[] {
  const def = typeof ranking === "string" ? rankingById(ranking) : ranking;
  const places = rankPlaces(candidates(models, def), def);
  return places.map(({ place, entry }, i) => {
    const { model, version, figure } = entry;
    const text =
      def.field === "price"
        ? formatEur(figure.value)
        : versionFields(version).find((f) => f.key === def.field)?.text ?? String(figure.value);
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
      figure: text,
      source: { ...sourceView(figure), url: figure.url },
      note: figure.note ?? null,
    };
  });
}
