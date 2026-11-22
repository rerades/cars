import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";
import { figureParts } from "../src/lib/ranking-view.ts";
import { rankingById } from "../src/lib/rankings.ts";

const web = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(web, p), "utf8");

describe("places as a screen with the Cifra component (#1192)", () => {
  test("figureParts: the value never carries the battery basis; the label does (PRD-005, decision 9)", () => {
    const bat = rankingById("bateria");
    assert.deepEqual(figureParts(bat, { value: 58, basis: "usable" }), { text: "58 kWh", label: "Batería · útil" });
    assert.equal(figureParts(bat, { value: 58, basis: "gross" }).label, "Batería · bruta");
    assert.equal(figureParts(bat, { value: 58.5, basis: "unknown" }).label, "Batería · sin especificar si es útil o bruta");
    assert.equal(figureParts(bat, { value: 58, basis: "unknown" }).text, "58 kWh");
    assert.deepEqual(figureParts(rankingById("autonomia"), { value: 446 }), { text: "446 km", label: "Autonomía WLTP" });
    assert.equal(figureParts(rankingById("potencia"), { value: 150 }).label, "Potencia");
    assert.equal(figureParts(rankingById("cargaCc"), { value: 150 }).text, "150 kW");
    assert.match(figureParts(rankingById("precio"), { value: 32800 }).text, /^32\.800\s€$/);
  });

  test("RankingPlace uses the Cifra of the model page, size l, in its own <dl>; the template clones the same markup", () => {
    const place = read("src/components/RankingPlace.astro");
    assert.match(place, /import Cifra from "\.\/Cifra\.astro"/);
    assert.match(place, /<Cifra size="l"/);
    assert.match(place, /<dl class="rank-place__figure">/);
    assert.doesNotMatch(place, /text-price|data-figure-value/);
    // One component paints the HTML and the <template> (place = null): the list cannot diverge.
    assert.match(read("src/pages/rankings/[ranking].astro"), /<template data-place-template>\s*<RankingPlace place=\{null\} \/>/);
    // The script fills the Cifra with textContent: label, number and unit.
    const filters = read("src/components/RankingFilters.astro");
    assert.match(filters, /\[data-figure\] > dt"\)\.textContent/);
    assert.match(filters, /\.cifra__unidad"\)\.textContent/);
    assert.match(filters, /figureParts\(def, entry\.figure\)/);
  });

  test("tokens: rank number clamp, 6 rem number column from lg, 22 rem figure column; --width-ranking is gone", () => {
    const css = read("src/styles/global.css");
    assert.match(css, /--text-rank-number:\s*clamp\(2\.75rem,\s*4\.4vw,\s*4rem\)/);
    assert.match(css, /--width-rank-figure:\s*22rem/);
    assert.match(css, /@media \(min-width: 64rem\)\s*\{\s*:root\s*\{\s*--width-rank-number:\s*6rem/);
    assert.doesNotMatch(css, /--width-ranking/);
  });

  test("the ranking prototype is deleted; the shared files of the others stay (ADR-0024)", () => {
    assert.equal(existsSync(join(web, "design-proto/ranking-a.astro")), false);
    for (const f of ["a/Cifra.astro", "pantalla.css", "fonts"]) assert.ok(existsSync(join(web, "design-proto", f)), f);
  });
});
