import type { Version } from "./data.ts";

/** Most version columns in one table of the model page (ficha-modelo.md, «Pantallas anchas»). */
export const MAX_TABLE_COLUMNS = 5;

/**
 * Order of the versions on the model page (RF-3, CA-3): by `price.value` ascending, `financed`
 * included. Equal prices and versions without price keep the file order (the sort is stable);
 * those without price go last. Names are not deduplicated: the schema already forbids repeats.
 */
export function sortVersions<T extends Pick<Version, "price">>(versions: readonly T[]): T[] {
  const priced = versions.filter((v) => v.price);
  const unpriced = versions.filter((v) => !v.price);
  // Array#sort is stable, so equal prices stay in file order.
  priced.sort((a, b) => a.price!.value - b.price!.value);
  return [...priced, ...unpriced];
}

/** One table per `size` versions (1-based inclusive ranges for the part captions). */
export interface VersionChunk<T> {
  items: T[];
  from: number;
  to: number;
}

export function chunkVersions<T>(versions: readonly T[], size = MAX_TABLE_COLUMNS): VersionChunk<T>[] {
  const chunks: VersionChunk<T>[] = [];
  for (let i = 0; i < versions.length; i += size) {
    const items = versions.slice(i, i + size);
    chunks.push({ items, from: i + 1, to: i + items.length });
  }
  return chunks;
}
