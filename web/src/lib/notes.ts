import type { Sourced } from "./data.ts";
import { sourceView } from "./format.ts";

/** The part of a datum that identifies its source note (ficha-modelo.md, «Agrupación y numeración»). */
export type NoteSource = Pick<Sourced, "source_id" | "url" | "retrieved" | "tier">;

/** One entry of the «Fuentes» block. */
export interface SourceNote {
  /** 1-based number, by order of first appearance. */
  n: number;
  source_id: string;
  url: string;
  retrieved: string;
  tier: string;
  /** Domain of `url` without "www.", shown as the source name. */
  name: string;
  /** `retrieved` as "24 sep 2026". */
  date: string;
  /** Not T1: shown as «fuente no oficial». */
  unofficial: boolean;
}

/** Grouping key: same source_id + url + retrieved + tier, same note. */
export function noteKey(s: NoteSource): string {
  return JSON.stringify([s.source_id, s.url, s.retrieved, s.tier]);
}

/**
 * Groups data into numbered source notes. `data` must come in the fixed walk order of the page
 * (header, versions, model data); the numbers follow first appearance. Pure: no I/O.
 * Null entries (missing data, «por confirmar») are skipped: there is nothing to cite.
 */
export function groupNotes(data: readonly (NoteSource | null | undefined)[]): {
  notes: SourceNote[];
  numberOf: (s: NoteSource) => number;
} {
  const byKey = new Map<string, SourceNote>();
  for (const s of data) {
    if (!s) continue;
    const key = noteKey(s);
    if (byKey.has(key)) continue;
    const { name, date, unofficial } = sourceView(s);
    byKey.set(key, {
      n: byKey.size + 1,
      source_id: s.source_id,
      url: s.url,
      retrieved: s.retrieved,
      tier: s.tier,
      name,
      date,
      unofficial,
    });
  }
  return {
    notes: [...byKey.values()],
    numberOf: (s) => {
      const note = byKey.get(noteKey(s));
      if (!note) throw new Error(`datum without note: ${noteKey(s)}`);
      return note.n;
    },
  };
}
