import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { FIELDS, FIGURE_FIELDS } from "../src/lib/compare.ts";
import { splitFigure } from "../src/lib/figure.ts";
import { loadModels } from "../src/lib/data.ts";
import { cellView, defaultVersion, projectModel } from "../src/lib/compare.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const table = read("../src/components/ComparisonTable.astro");
const page = read("../src/pages/comparar.astro");
const css = read("../src/styles/global.css");
const style = table.slice(table.indexOf("<style is:global>"));
const rule = (selector: string) => {
  const i = style.indexOf(`${selector} {`);
  assert.notEqual(i, -1, `rule ${selector} not found`);
  return style.slice(i, style.indexOf("}", i));
};

describe("table, visual direction (PRD-003, comparador.md «Dirección visual»)", () => {
  test("token --text-figure-s is defined as in tokens.md", () => {
    assert.match(css, /--text-figure-s:\s*clamp\(2rem, 3\.2vw, 3rem\);/);
  });

  test("bands: white for «Comparación» and conditions, light for «Fuentes»; no wrapper left in the page", () => {
    assert.match(table, /<section aria-labelledby="cmp-tabla" class="band-white cmp-block"/);
    assert.match(table, /<section aria-labelledby="cmp-fuentes" class="band-light cmp-block"/);
    assert.doesNotMatch(page, /cmp-rest/);
    assert.match(page, /<ComparisonTable \/>/);
  });

  test("headings: h2 --text-block wide, h3 --text-version wide, 2 px rule above the conditions", () => {
    assert.match(style, /\n {2}\.cmp-h2 \{ font-size: var\(--text-block\)/);
    assert.match(style, /\n {2}\.cmp-h3 \{ font-size: var\(--text-version\)/);
    assert.match(style, /\.cmp-h2, \.cmp-h3 \{[^}]*font-stretch: var\(--font-stretch-wide\)/);
    assert.match(rule(".cmp-terms"), /border-top: 2px solid var\(--color-ink-900\)/);
  });

  test("header row is a dark band with hyphens, the model is a link and the badge uses soon colours", () => {
    assert.match(table, /<thead class="band-dark">/);
    assert.match(style, /\.cmp-table thead th \{[^}]*hyphens: auto/);
    assert.match(table, /data-slot="link" class="cmp-head-link"/);
    assert.match(rule(".cmp-badge--soon"), /--color-soon-bg[\s\S]*--color-soon-fg/);
    assert.match(style, /\.cmp-head-link:hover \{ color: var\(--color-brand-800\)/);
  });

  test("label rows have no surface-muted fill and carry a line-soft hairline", () => {
    assert.doesNotMatch(table, /surface-muted/);
    assert.match(rule(".cmp-row-label"), /border-top: 1px solid var\(--color-line-soft\)/);
  });

  test("price and range are figures with the Cifra classes and --text-figure-s, without dl/dt/dd", () => {
    assert.deepEqual([...FIGURE_FIELDS], ["precio", "autonomia"]);
    assert.match(table, /className = "cifra__valor"/);
    assert.match(table, /className = "cifra__unidad"/);
    assert.match(rule(".cmp-fig"), /font-size: var\(--text-figure-s\)/);
    assert.match(rule(".cmp-fig"), /display: flex; flex-wrap: wrap/);
    assert.doesNotMatch(table, /<(dl|dt|dd)[\s>]/);
    assert.match(rule(".cmp-fig-missing"), /max\(calc\(var\(--text-figure-s\) \* 0\.46\), var\(--text-small\)\)/);
  });

  test("the style of a cell depends on its row, never on its value (RF-13, CA-15)", () => {
    // The only branch on the value is `missing`, and it keeps the text: no mark, score or highlight.
    assert.doesNotMatch(table, /best|worst|mejor|peor|highlight|diff/i);
    assert.match(table, /FIGURE_FIELDS\.includes\(field\)/);
    assert.doesNotMatch(style, /tr:has|:nth-child\(\d\)[^{]*\{[^}]*background/);
    assert.ok(FIELDS.length === 7);
  });

  test("«por confirmar» stays text (CA-17: distinguishable without colour) and the labels are unchanged", () => {
    assert.match(table, /text\.textContent = c\.text/);
    assert.match(table, /ficha\.precio\.verCondiciones/);
    assert.match(table, /ficha\.nota\.noOficial/);
  });

  test("the prototype is gone and its shared files stay", () => {
    assert.throws(() => readFileSync(new URL("../design-proto/comparador-a.astro", import.meta.url)));
    assert.ok(readFileSync(new URL("../design-proto/a/Cifra.astro", import.meta.url), "utf8").length > 0);
    assert.ok(readFileSync(new URL("../design-proto/pantalla.css", import.meta.url), "utf8").length > 0);
  });
});

describe("splitFigure (CA-18: only splits the text it is given)", () => {
  test("number and unit", () => {
    assert.deepEqual(splitFigure("21.974 €"), { number: "21.974", unit: "€" });
    assert.deepEqual(splitFigure("315 km"), { number: "315", unit: "km" });
    assert.deepEqual(splitFigure("315\u00a0km"), { number: "315", unit: "km" });
  });
  test("a single word has no unit", () => {
    assert.deepEqual(splitFigure("por"), { number: "por", unit: null });
  });
  test("number + unit joined give back the real values of data/raw", () => {
    const rec = loadModels().models.find((m) => m.file === "renault/r5-e-tech-electrico.yaml")!;
    const model = projectModel(rec, "r5-e-tech-electrico");
    const v = defaultVersion(model.versions)!;
    for (const field of FIGURE_FIELDS) {
      const c = cellView(field, v);
      if (c.missing) continue;
      const { number, unit } = splitFigure(c.text);
      assert.equal(`${number} ${unit}`.replace(/\s/g, ""), c.text.replace(/\s/g, ""));
    }
  });
});
