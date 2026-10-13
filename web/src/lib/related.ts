import { sortByNovelty } from "./catalog.ts";
import type { ModelRecord } from "./data.ts";

/** Most related models shown on a model page (RF-15). */
export const MAX_RELATED = 3;

/**
 * RF-15: published models of the same segment and another brand, closest "price from" first.
 * Models without a price go last. Ties, and every order when `model` has no price (no reference
 * for closeness), follow the catalog default order, "Novedad" (sortByNovelty). Returns [] when the
 * model has no segment or there are no candidates. `all` must come from loadModels() (published only).
 */
export function relatedModels(model: ModelRecord, all: ModelRecord[], max: number = MAX_RELATED): ModelRecord[] {
  const segment = model.segment?.value;
  if (!segment) return [];
  const candidates = sortByNovelty(
    all.filter((m) => m.brand !== model.brand && m.segment?.value === segment),
  );
  const reference = model.price_from?.value ?? null;
  const distance = (m: ModelRecord): number => {
    const price = m.price_from?.value;
    if (price === undefined || reference === null) return price === undefined ? Infinity : 0;
    return Math.abs(price - reference);
  };
  // Array.prototype.sort is stable: equal distances keep the "Novedad" order above.
  return candidates
    .map((m) => ({ m, d: distance(m) }))
    .sort((a, b) => (a.d === b.d ? 0 : a.d < b.d ? -1 : 1))
    .slice(0, max)
    .map(({ m }) => m);
}
