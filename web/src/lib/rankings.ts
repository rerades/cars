import type { ModelRecord, Sourced, Tier, Version } from "./data.ts";

/**
 * Rankings (PRD-005). Pure module: no file access. Data comes from `loadModels()` (data.ts).
 * This file holds the table of the five rankings (RF-1) and the selection of the versions that
 * may enter one (RF-4, RF-6, RF-11). Ordering, the limit of 10, ties and pages are other stories.
 */

export type RankingId = "precio" | "autonomia" | "bateria" | "potencia" | "cargaCc";

/** Version field a ranking is about. Always a field of `versions[]`, never of `specs` (RF-6). */
export type RankingField = "price" | "wltp_km" | "battery_kwh" | "power_kw" | "dc_max_kw";

export interface RankingDef {
  id: RankingId;
  /** Version field holding the figure (RF-1). */
  field: RankingField;
  /** Direction of the order (RF-1). Applied by a later story. */
  direction: "asc" | "desc";
  /** Prefix of the text keys: `ranking.<textKey>.titulo`, `.entrada`, `.orden`, `.dato`. */
  textKey: string;
  /** Stable URL, no query string (docs/design/rankings.md). */
  url: string;
}

/** The five rankings of RF-1, and no others. A new one is added to the PRD first. */
export const RANKINGS: readonly RankingDef[] = [
  { id: "precio", field: "price", direction: "asc", textKey: "ranking.precio", url: "/rankings/mas-baratos" },
  { id: "autonomia", field: "wltp_km", direction: "desc", textKey: "ranking.autonomia", url: "/rankings/mas-autonomia" },
  { id: "bateria", field: "battery_kwh", direction: "desc", textKey: "ranking.bateria", url: "/rankings/mas-bateria" },
  { id: "potencia", field: "power_kw", direction: "desc", textKey: "ranking.potencia", url: "/rankings/mas-potencia" },
  {
    id: "cargaCc",
    field: "dc_max_kw",
    direction: "desc",
    textKey: "ranking.cargaCc",
    url: "/rankings/carga-mas-rapida-en-continua",
  },
];

export function rankingById(id: RankingId): RankingDef {
  const def = RANKINGS.find((r) => r.id === id);
  if (!def) throw new Error(`unknown ranking: ${id}`);
  return def;
}

/** A version that may take a place in a ranking, with the model it belongs to and its figure. */
export interface Candidate {
  model: ModelRecord;
  version: Version;
  /** The figure of the ranking, exactly as in the file (with its source). */
  figure: Sourced<number>;
}

/** Tiers that give a place (RF-4): T3 only confirms, it never ranks. */
const RANKING_TIERS: readonly Tier[] = ["T1", "T2"];

/**
 * Versions that may enter `ranking` (RF-11, RF-6, RF-4): models not under review and `on_sale`;
 * with the figure present, not null and of tier T1 or T2. A version without it is left out: it is
 * never set to 0 nor deduced from another field, another version or `specs`.
 * Keeps the order of the input; does not sort or limit.
 */
export function candidates(models: readonly ModelRecord[], ranking: RankingId | RankingDef): Candidate[] {
  const { field } = typeof ranking === "string" ? rankingById(ranking) : ranking;
  const out: Candidate[] = [];
  for (const model of models) {
    if (model.needs_review || model.status.value !== "on_sale") continue;
    for (const version of model.versions) {
      const figure: Sourced<number> | null | undefined = version[field];
      if (!figure || typeof figure.value !== "number") continue;
      if (!RANKING_TIERS.includes(figure.tier)) continue;
      out.push({ model, version, figure });
    }
  }
  return out;
}
