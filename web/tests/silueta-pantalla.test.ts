import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

// Story #1246: the segment silhouette sits in the photo's slot, thin and muted, never under the text
// (docs/design/siluetas-segmento.md, "la silueta en la pantalla"). CA-17 (PRD-001) and CA-12 (PRD-002) keep their
// checks in imagen.test.ts and ficha-imagenes.test.ts; here the placement rules. Geometry cannot be measured without
// a browser, so these tests read the rules that produce it and fail if a rule is lost or the old "behind" one returns.

const WEB = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(WEB, p), "utf8");
const card = read("src/components/ModelCard.astro");
const page = read("src/pages/marcas/[marca]/[modelo].astro");
const svg = read("src/components/SegmentSilhouette.astro");
const css = read("src/styles/global.css");
const rule = (src: string, selector: string) => {
  const i = src.indexOf(`${selector} {`);
  assert.ok(i >= 0, `rule ${selector} exists`);
  return src.slice(i, src.indexOf("}", i));
};

describe("silhouette tokens", () => {
  test("sizes, stroke and the two band colours are defined", () => {
    for (const [name, value] of [
      ["--size-silhouette-stroke", "2px"],
      ["--size-silhouette-card", "15rem"],
      ["--size-silhouette-card-lg", "28rem"],
      ["--size-silhouette-hero", "18rem"],
      ["--size-silhouette-hero-lg", "34rem"],
    ]) {
      assert.match(css, new RegExp(`${name}: ${value};`), name);
    }
    assert.match(css, /--color-silhouette: #a3ada7;/);
    assert.match(rule(css, ".band-dark"), /--color-silhouette: #45525b;/);
  });
});

describe("SegmentSilhouette", () => {
  test("writes only the width inline; the height follows from aspect-ratio", () => {
    assert.match(svg, /style=\{`width: \$\{side\}`\}/);
    assert.doesNotMatch(svg, /height: \$\{side\}/);
    assert.match(svg, /aspect-ratio: 1;/);
  });
});

describe("catalogue card silhouette", () => {
  const r = rule(card, "  .silhouette");
  test("sits in the photo's slot (inset, 10 rem high), with the muted colour and 15 rem side", () => {
    assert.match(r, /inset: 1\.5rem 1\.25rem auto;/);
    assert.match(r, /height: calc\(var\(--size-silhouette-card\) \* 32 \/ 48\);/);
    assert.match(r, /color: var\(--color-silhouette\);/);
    assert.match(r, /--size-segment-icon-lg: min\(var\(--size-silhouette-card\), 100%\);/);
    assert.match(r, /align-items: flex-end;/);
  });
  test("is not pulled above the card nor drawn at the old huge sizes", () => {
    assert.doesNotMatch(card, /top: -6\.5rem|top: -7rem|24rem|42rem|ink-950\);\s*display: flex/);
    assert.doesNotMatch(card, /stroke-width: 0\.(3|22)/);
  });
  test("stands on the slot's bottom, with a constant 2 px stroke", () => {
    assert.match(card, /margin-bottom: calc\(var\(--size-segment-icon-lg\) \* -10 \/ 48\);/);
    assert.match(card, /stroke-width: var\(--size-silhouette-stroke\);/);
    assert.match(card, /vector-effect: non-scaling-stroke;/);
  });
  test("lg: the half opposite the text, alternating, 28 rem", () => {
    assert.match(card, /--size-segment-icon-lg: min\(var\(--size-silhouette-card-lg\), 100%\);/);
    assert.match(card, /inset: 2\.5rem 2\.5rem 2\.5rem 50%;/);
    assert.match(card, /\.screen:nth-child\(even\) \.silhouette \{\s*inset: 2\.5rem 50% 2\.5rem 2\.5rem;/);
  });
});

describe("model page first-screen silhouette", () => {
  const r = rule(page, "  .hero-silhouette");
  test("takes the retouched car's slot in the flow on mobile (flex 1, min 12 rem, order 1), 18 rem side", () => {
    assert.match(r, /flex: 1;/);
    assert.match(r, /min-height: var\(--size-cutout-mobile\);/);
    assert.match(r, /order: 1;/);
    assert.match(r, /--size-segment-icon-lg: min\(var\(--size-silhouette-hero\), 100%\);/);
    assert.match(r, /color: var\(--color-silhouette\);/);
    assert.doesNotMatch(r, /inset: 0;|on-dark-muted/);
  });
  test("lg: the right half above the key figures, 34 rem", () => {
    assert.match(page, /--size-segment-icon-lg: min\(var\(--size-silhouette-hero-lg\), 100%\);\s*inset: 6\.5rem 2\.5rem 12rem 50%;/);
  });
  test("the name goes after the silhouette on mobile and keeps its half on lg", () => {
    assert.match(page, /\.hero-screen:has\(\.hero-silhouette\) \.hero-foot \{\s*order: 2;/);
    assert.match(page, /\.hero-screen:has\(\.hero-silhouette\) \.hero-text > \*/);
  });
  test("the stroke is the shared 2 px one", () => {
    assert.match(page, /\.hero-silhouette svg \{[^}]*stroke-width: var\(--size-silhouette-stroke\);/);
    assert.doesNotMatch(page, /stroke-width: 0\.3/);
  });
});

test("the prototype is gone and the shared files stay (ADR-0024)", () => {
  assert.throws(() => readFileSync(join(WEB, "design-proto/siluetas-a.astro")));
  readFileSync(join(WEB, "design-proto/a/Cifra.astro"));
  readFileSync(join(WEB, "design-proto/pantalla.css"));
});
