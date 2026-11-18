/**
 * Count-up of the key figures (PRD-002 RF-18). Pure helpers; the DOM part is the script of the model page.
 * The served HTML always carries the final value: this only decorates it.
 */

export interface ParsedNumber {
  value: number;
  /** Decimals shown in the final text. */
  decimals: number;
  /** Whether the final text uses the thousands separator ("." in es). */
  grouped: boolean;
}

/** Parses a number formatted the Spanish way ("32.800", "77,4", "446"). Returns null if it is not one. */
export function parseEsNumber(text: string): ParsedNumber | null {
  const s = text.trim();
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(s)) return null;
  const [int, dec = ""] = s.split(",");
  const value = Number(`${int.replaceAll(".", "")}${dec ? `.${dec}` : ""}`);
  if (!Number.isFinite(value)) return null;
  return { value, decimals: dec.length, grouped: int.includes(".") };
}

/** Formats like `parseEsNumber` reads: "." for thousands (if `grouped`), "," for decimals. */
export function formatEsNumber(value: number, decimals: number, grouped: boolean): string {
  const [int, dec] = value.toFixed(decimals).split(".");
  const withGroups = grouped ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : int;
  return dec ? `${withGroups},${dec}` : withGroups;
}

/** Ease-out cubic; `progress` is clamped to 0..1. Reaches exactly 1 at the end. */
export function easeOut(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return 1 - (1 - p) ** 3;
}

/** Text to show `elapsed` ms into a count of `duration` ms; the last frame is exactly `final`. */
export function frameText(final: string, elapsed: number, duration: number): string {
  const parsed = parseEsNumber(final);
  if (!parsed || elapsed >= duration) return final;
  return formatEsNumber(parsed.value * easeOut(elapsed / duration), parsed.decimals, parsed.grouped);
}
