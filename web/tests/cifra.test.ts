import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";

// Story #1034: the Cifra component. Built once inside a throwaway prototype page (design-proto/ pages
// are only published with DESIGN_PROTO=1), so no screen of the site is touched.
const WEB = resolve(import.meta.dirname, "..");
const SLUG = "prueba-cifra";
const PROTO = join(WEB, "design-proto", `${SLUG}.astro`);

let html = "";
let css = "";
let out = "";

describe("Cifra component", () => {
  before(() => {
    writeFileSync(
      PROTO,
      `---
import Cifra from "../src/components/Cifra.astro";
---
<link rel="stylesheet" href="/x.css" />
<dl id="with-value">
  <Cifra label="autonomía WLTP" text="446 km" size="xl" figure="range"><sup slot="marca" data-mark>1</sup></Cifra>
  <Cifra label="precio" text="32.800 €" size="l" figure="price" />
  <Cifra label="batería" text="75 kWh" size="m" figure="battery"><span slot="detalle">útil</span></Cifra>
</dl>
<dl id="missing"><Cifra label="autonomía WLTP" text={null} size="xl" figure="range" /></dl>`,
    );
    out = mkdtempSync(join(tmpdir(), "cars-cifra-"));
    execFileSync("pnpm", ["exec", "astro", "build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, DESIGN_PROTO: "1" },
      stdio: "pipe",
    });
    html = readFileSync(join(out, "proto", SLUG, "index.html"), "utf8");
    const files = readdirSync(out, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".css"));
    // Astro inlines the small stylesheets of a page; read both places.
    const inline = [...html.matchAll(/<style[^>]*>([^<]*)<\/style>/g)].map((m) => m[1]).join("\n");
    css = inline + "\n" + files.map((f) => readFileSync(join(out, f), "utf8")).join("\n");
  });
  after(() => {
    rmSync(PROTO, { force: true });
    rmSync(out, { recursive: true, force: true });
  });

  // PRD-002 CA-22: the value is in the served HTML, not put there by a script.
  test("the value and its unit are in the served HTML, with no script", () => {
    assert.match(html, /446\s*<span[^>]*class="[^"]*cifra__unidad[^"]*"[^>]*>km<\/span>/);
    assert.match(html, /32\.800\s*<span[^>]*class="[^"]*cifra__unidad[^"]*"[^>]*>€<\/span>/);
    assert.match(html, /75\s*<span[^>]*cifra__unidad[^>]*>kWh<\/span>/);
    assert.doesNotMatch(html, /<script\b/);
  });

  test("dt comes before dd in the DOM, and the mark goes with the label", () => {
    const first = html.slice(html.indexOf('data-figure="range"'));
    assert.ok(first.indexOf("<dt") < first.indexOf("<dd"));
    assert.match(html, /<dt[^>]*>autonomía WLTP<sup[^>]*data-mark[^>]*>1<\/sup><\/dt>/);
    assert.match(html, /<dd[^>]*class="[^"]*cifra__detalle[^"]*"[^>]*>\s*<span>útil<\/span>/);
  });

  test("the three sizes use the figure tokens", () => {
    for (const s of ["xl", "l", "m"]) {
      assert.match(html, new RegExp(`cifra--${s}`));
      assert.match(css, new RegExp(`--cifra-size:\\s*var\\(--text-figure-${s}\\)`));
    }
  });

  // PRD-001 RF-12 / tokens.md: narrow number, tabular figures, wide unit.
  test("number is narrow and tabular; unit is wide", () => {
    assert.match(css, /\.cifra__valor[^{]*\{[^}]*font-stretch:\s*var\(--font-stretch-narrow\)/);
    assert.match(css, /\.cifra__valor[^{]*\{[^}]*tabular-nums/);
    assert.match(css, /\.cifra__unidad[^{]*\{[^}]*font-stretch:\s*var\(--font-stretch-wide\)/);
  });

  test("«por confirmar» is two narrow lines where the number goes, with the label in the DOM", () => {
    const missing = html.slice(html.indexOf('id="missing"'));
    assert.match(missing, /<dt[^>]*>autonomía WLTP<\/dt>/);
    assert.match(missing, /class="[^"]*cifra__falta[^"]*"[^>]*><span[^>]*>por<\/span><span[^>]*>confirmar<\/span>/);
    assert.doesNotMatch(missing, /cifra__valor/);
    assert.match(css, /\.cifra__falta[^{]*\{[^}]*font-stretch:\s*var\(--font-stretch-narrow\)/);
    assert.match(css, /\.cifra__falta[^{]*first-child[^{]*first-letter\s*\{[^}]*uppercase/);
  });

  // Measure: figure box 0.82 em; «por confirmar» = 2 lines × 0.46 em × line-height; unit >= 14 px.
  test("«por confirmar» adds up to the height of the number, and the unit never drops below 14 px", () => {
    const rule = (sel: RegExp) => css.match(sel)?.[1] ?? assert.fail(`rule ${sel} is missing`);
    const figure = rule(/dd:first-of-type[^{]*\{([^}]*)\}/);
    const numberHeight = Number(figure.match(/line-height:\s*([\d.]+)/)?.[1]);
    assert.equal(numberHeight, 0.82);
    const falta = rule(/\.cifra__falta[^{>]*\{([^}]*)\}/);
    const size = Number(falta.match(/font-size:\s*([\d.]+)em/)?.[1]);
    const lineHeight = Number(falta.match(/line-height:\s*([\d.]+)/)?.[1]);
    assert.equal(size, 0.46);
    assert.ok(Math.abs(2 * size * lineHeight - numberHeight) < 0.005, `${2 * size * lineHeight} != ${numberHeight}`);
    // The row keeps a floor of its own height in both states.
    assert.match(figure, /min-height:\s*0?\.82em/);
    // max(0.26em, var(--text-small)) with --text-small at 0.875 rem = 14 px at the default root.
    assert.match(css, /\.cifra__unidad[^{]*\{[^}]*font-size:\s*max\(0?\.26em,\s*\s*var\(--text-small\)\)/);
    assert.match(readFileSync(join(WEB, "src/styles/global.css"), "utf8"), /--text-small:\s*0\.875rem/);
  });
});
