import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { sourced } from "./fixtures.ts";

/**
 * Catalog pages (#1036, PRD-001 RF-4, RF-10, RF-14): dark header band, one-column list of screens.
 * Covers CA-4, CA-7, CA-12 (DOM order), CA-19 over the built HTML.
 */
const WEB = join(import.meta.dirname, "..");

const model = (brand: string, name: string, segment: string, price: number, km: number) => ({
  brand,
  brand_name: brand.toUpperCase(),
  model: name,
  status: sourced("on_sale"),
  segment: sourced(segment),
  versions: [
    {
      name: `${name} 1`,
      wltp_km: sourced(km),
      price: sourced(price, { unit: "EUR", price_kind: "pvp" }),
    },
  ],
});

describe("catalog pages: dark header and list of screens", () => {
  let root: string;
  let out: string;
  const page = (path: string) => readFileSync(join(out, path, "index.html"), "utf8");
  const paths = ["coches", "marcas/acme", "marcas/beta", "segmentos/urbano", "precio/hasta-30000-euros", "autonomia/mas-de-400-km"];

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-screens-"));
    const data = join(root, "data");
    for (const [brand, name, seg, price, km] of [
      ["acme", "R5", "urbano", 25000, 410],
      ["acme", "R4", "urbano", 26000, 380],
      ["beta", "EV3", "suv_compacto", 35000, 500],
    ] as const) {
      mkdirSync(join(data, brand), { recursive: true });
      writeFileSync(join(data, brand, `${name}.yaml`), stringify(model(brand, name, seg, price, km)));
    }
    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("every catalog page has the h1 and intro inside a dark band, before «Explorar» and the results", () => {
    for (const p of paths) {
      const html = page(p);
      const header = /<header class="band-dark">([\s\S]*?)<\/header>/.exec(html);
      assert.ok(header, `${p}: no dark header`);
      assert.match(header[1], /<h1\b[^>]*text-display/);
      assert.match(header[1], /data-intro/);
      assert.ok(html.indexOf("</header>") < html.indexOf('id="explorar"'), `${p}: Explorar before header end`);
      assert.ok(html.indexOf('id="explorar"') < html.indexOf('id="resultados"'), `${p}: DOM order`);
    }
  });

  test("the results are a one-column list with no grid, and «Modelos» is hidden only visually", () => {
    for (const p of paths) {
      const html = page(p);
      const ul = /<ul[^>]*data-results[^>]*>/.exec(html);
      assert.ok(ul, `${p}: no list`);
      assert.doesNotMatch(ul[0], /\bgrid|grid-cols|md:|lg:/);
      assert.match(html, /<h2 id="resultados"[^>]*class="[^"]*\bsr-only\b[^"]*"[^>]*>Modelos<\/h2>/);
      assert.match(html, /<a\b[^>]*href="#resultados"/);
    }
  });

  test("CA-4: /marcas/acme shows only Acme models", () => {
    const names = [...page("marcas/acme").matchAll(/data-name="([^"]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(names, ["R4", "R5"]);
  });

  test("CA-19: /coches links every published ranking, and each target exists in the build", () => {
    const html = page("coches");
    const hrefs = [...html.matchAll(/href="(\/rankings\/[^"#?]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length > 0, "no ranking links");
    for (const h of new Set(hrefs)) assert.ok(existsSync(join(out, h, "index.html")), `${h} is not in the build`);
  });

  test("CA-7: no cookies or storage in any catalog page", () => {
    for (const p of paths) {
      assert.doesNotMatch(page(p), /localStorage|sessionStorage|document\.cookie/, p);
    }
  });
});
