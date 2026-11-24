/**
 * Splits a formatted value ("21.974 €", "315 km") into number and unit: the unit is the last word.
 * A value with a single word has no unit. The space between them (normal or no-break; `\s` covers both)
 * is part of neither. The one place this rule lives: Cifra.astro, the comparison table and the
 * ranking filters script all use it.
 */
export function splitFigure(text: string): { number: string; unit: string | null } {
  const parts = text.split(/\s+/).filter(Boolean);
  const unit = parts.length > 1 ? parts.pop()! : null;
  return { number: parts.join(" "), unit };
}
