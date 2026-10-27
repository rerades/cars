const collator = new Intl.Collator("es");

/**
 * Order of the entries of the «Reviews» block (PRD-006 RF-5, RF-7; ficha-modelo.md, «Orden de las
 * entradas»). Pure and without a cap:
 * 1. Entries without `version` (the whole model) first; then those of each version, in the order of
 *    `versionNames` (the «Versiones» block order). A version name the block does not know goes after
 *    the known ones, groups in order of first appearance in the file.
 * 2. Inside a group, by `label` (outlet or body) in Spanish alphabetical order; equal labels keep the
 *    file order (Array#sort is stable).
 * `retrieved` is never used: it is the consultation date, not the publication date.
 */
export function sortReviews<T extends { version?: string }>(
  entries: readonly T[],
  versionNames: readonly string[],
  label: (entry: T) => string,
): T[] {
  const groups: string[] = [];
  const rank = (e: T): number => {
    if (e.version === undefined) return 0;
    const known = versionNames.indexOf(e.version);
    if (known >= 0) return 1 + known;
    let g = groups.indexOf(e.version);
    if (g < 0) g = groups.push(e.version) - 1;
    return 1 + versionNames.length + g;
  };
  // Rank once per entry, in file order, so unknown groups are numbered by first appearance.
  return entries
    .map((entry, index) => ({ entry, index, group: rank(entry) }))
    .sort((a, b) => a.group - b.group || collator.compare(label(a.entry), label(b.entry)) || a.index - b.index)
    .map((x) => x.entry);
}
