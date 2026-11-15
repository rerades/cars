/**
 * Band colours of the model page (docs/design/ficha-modelo.md, "Estructura y orden de lectura").
 * The first screen is dark. After it: white («Versiones»), dark, then light, white, dark... by position, so a missing
 * section hands its colour to the next one. Two bands in a row never share a colour, and «Fuentes» is always light.
 */
export type Band = "dark" | "white" | "light";

const CYCLE: Band[] = ["white", "dark", "light"];
const ALL: Band[] = ["white", "dark", "light"];

/** Colour of each section after the first screen, in page order. `ids` must include "versiones" first. */
export function assignBands(ids: string[]): Band[] {
  const colors: Band[] = ids.map((id, i) => (id === "fuentes" ? "light" : CYCLE[i % CYCLE.length]!));
  const pick = (avoid: (Band | undefined)[]): Band => ALL.find((c) => !avoid.includes(c))!;
  for (let i = 0; i < colors.length; i++) {
    const before = i === 0 ? "dark" : colors[i - 1]; // the first screen is dark
    if (colors[i] !== before) continue;
    if (ids[i] === "fuentes") {
      // «Fuentes» stays light: the section before it changes.
      colors[i - 1] = pick([i - 2 < 0 ? "dark" : colors[i - 2], colors[i]]);
    } else {
      colors[i] = pick([before, ids[i + 1] === "fuentes" ? "light" : undefined]);
    }
  }
  return colors;
}

/** Tailwind-free class for a band (global.css: .band-dark, .band-white, .band-light). */
export const bandClass = (b: Band): string => `band-${b}`;
