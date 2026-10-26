import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { es } from "../src/lib/i18n.ts";
import { RANKINGS } from "../src/lib/rankings.ts";

/**
 * Story #376: what the built page serves around the filters. Covers RNF-1 (no controls without
 * JavaScript), RNF-5 (no storage in the script), CA-11 (nothing is submitted), CA-12 (canonical
 * without query string). The behaviour in a browser is story #378.
 */
describe("ranking filters in the built HTML (#376)", () => {
  let out: string;
  const page = (url: string) => readFileSync(join(out, url, "index.html"), "utf8");
  const withoutTemplates = (html: string) => html.replace(/<template[\s\S]*?<\/template>/g, "");

  before(() => {
    out = mkdtempSync(join(tmpdir(), "cars-rankings-filtros-"));
    const env = { ...process.env };
    delete env.CARS_DATA_DIR;
    execFileSync("pnpm", ["exec", "astro", "build", "--outDir", out], {
      cwd: resolve(import.meta.dirname, ".."),
      env,
      stdio: "pipe",
    });
  });
  after(() => rmSync(out, { recursive: true, force: true }));

  test("RNF-1: no select in the served HTML; the sinJs text is in a noscript", () => {
    for (const r of RANKINGS) {
      const html = page(r.url);
      assert.doesNotMatch(withoutTemplates(html), /<select\b/, r.url);
      const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html);
      assert.ok(noscript, r.url);
      assert.ok(noscript[1].includes(es["ranking.filtros.sinJs"]), r.url);
    }
  });

  test("the controls travel in a template: segment (optional) and the three price bands", () => {
    const html = page("/rankings/mas-autonomia");
    const tpl = /<template data-filters-template>([\s\S]*?)<\/template>/.exec(html)![1];
    assert.match(tpl, /<select[^>]*name="precio"/);
    for (const slug of ["hasta-30000-euros", "de-30000-a-45000-euros", "mas-de-45000-euros"]) {
      assert.ok(tpl.includes(`value="${slug}"`), slug);
    }
    assert.match(tpl, /<option value="">Cualquiera<\/option>/);
    assert.match(tpl, /<select[^>]*name="segmento"/);
    assert.match(tpl, /<option value="">Todos<\/option>/);
    // labels are visible and tied to the control by wrapping
    assert.equal((tpl.match(/<label\b/g) ?? []).length, 2);
  });

  test("CA-11: no form and nothing is submitted", () => {
    for (const r of RANKINGS) assert.doesNotMatch(page(r.url), /<form\b|\baction=/i, r.url);
  });

  test("CA-12 (query string): the canonical has no query string and the page is not noindex", () => {
    for (const r of RANKINGS) {
      const html = page(r.url);
      const href = /<link rel="canonical" href="([^"]*)"/.exec(html)![1];
      assert.equal(href, `https://siete3.com${r.url}/`);
      assert.ok(!href.includes("?"));
      assert.doesNotMatch(html, /noindex/);
    }
  });

  test("the place template exists once, next to the list, and the list keeps its 10 places", () => {
    const html = page("/rankings/mas-autonomia");
    assert.equal((html.match(/<template data-place-template>/g) ?? []).length, 1);
    assert.equal((withoutTemplates(html).match(/data-place="/g) ?? []).length, 10);
  });

  test("RNF-5: the scripts of the build use no storage, cookies, cache nor service workers", () => {
    const dir = join(out, "_astro");
    const scripts = readdirSync(dir).filter((f) => f.endsWith(".js"));
    const mine = scripts.filter((f) => readFileSync(join(dir, f), "utf8").includes("data-ranking-filters"));
    assert.ok(mine.length > 0, "the filter script is in the build");
    for (const f of mine) {
      assert.doesNotMatch(
        readFileSync(join(dir, f), "utf8"),
        /localStorage|sessionStorage|indexedDB|document\.cookie|serviceWorker|caches\./,
        f,
      );
    }
  });
});
