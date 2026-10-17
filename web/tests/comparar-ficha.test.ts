import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { acme, sourced } from "./fixtures.ts";

/**
 * Story #324 (PRD-003): the "Comparar" action in the model sheet header. RF-7, RF-11 (sheet);
 * CA-8, CA-13 (sheet part). Same criterion as the card (`isComparable`).
 */
const WEB = join(import.meta.dirname, "..");

function writeModel(dir: string, brand: string, model: string, doc: Record<string, any>) {
  mkdirSync(join(dir, brand), { recursive: true });
  writeFileSync(join(dir, brand, `${model}.yaml`), stringify(doc));
}

const make = (model: string, status: string, versions: unknown[]) => ({
  brand: "acme",
  brand_name: "acme",
  model,
  status: sourced(status),
  segment: sourced("suv_compacto"),
  versions,
});
const version = (name: string) => ({ name, wltp_km: sourced(400), price: { ...sourced(30000), unit: "EUR", price_kind: "pvp" } });

describe("sheet «Comparar» action", () => {
  let root: string;
  const out = () => join(root, "out");
  const sheet = (model: string) => readFileSync(join(out(), "marcas/acme", model, "index.html"), "utf8");
  const header = (html: string) => html.slice(html.indexOf("<h1"), html.indexOf("data-main-image"));
  const compareLinks = (s: string) => [...s.matchAll(/<a\b[^>]*href="\/comparar\/[^"]*"[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]);

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-web-"));
    const data = join(root, "data");
    writeModel(data, "acme", "Volta", acme());
    writeModel(data, "acme", "Soon", make("Soon", "announced", [version("Soon 1")]));
    writeModel(data, "acme", "Empty", make("Empty", "announced", []));
    writeModel(data, "acme", "Old", make("Old", "discontinued", [version("Old 1")]));
    writeModel(data, "acme", "Hidden", { ...make("Hidden", "on_sale", [version("Hidden 1")]), needs_review: true });
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out()], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-8: comparable sheet links to /comparar/ with the model, after the brand link, not a purchase link", () => {
    const h = header(sheet("Volta"));
    const links = compareLinks(h);
    assert.equal(links.length, 1);
    assert.match(links[0], /href="\/comparar\/\?v=acme\/Volta"/);
    assert.match(
      links[0],
      new RegExp(`^<a[^>]*>\\s*Comparar\\s*<span class="sr-only"> ${acme().brand_name} Volta con otros coches</span>\\s*</a>$`),
    );
    assert.doesNotMatch(links[0], /rel=|data-web-marca/);
    assert.ok(h.indexOf("data-web-marca") < h.indexOf("/comparar/"), "after «Ver en la web de la marca»");
    // Own line: wrapped in its own block, outside the brand link.
    assert.match(h, /<\/a>\s*<p>\s*<a[^>]*href="\/comparar\//);
    assert.match(links[0], /\bunderline\b/);
    assert.doesNotMatch(links[0], /\bbg-|\bborder\b/);
  });

  test("announced model with versions is comparable", () => {
    assert.equal(compareLinks(header(sheet("Soon"))).length, 1);
  });

  test("CA-13: announced without versions and discontinued have no action; needs_review has no sheet", () => {
    for (const m of ["Empty", "Old"]) {
      const html = sheet(m);
      assert.equal(compareLinks(html).length, 0, m);
      assert.doesNotMatch(header(html), /Comparar/, m);
    }
    assert.equal(existsSync(join(out(), "marcas/acme/Hidden/index.html")), false);
  });
});
