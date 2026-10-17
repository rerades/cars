import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { cardView } from "../src/lib/card.ts";
import { normalize } from "../src/lib/data.ts";
import { acme, sourced } from "./fixtures.ts";

/**
 * Story #323 (PRD-003): the "Comparar" action on the catalog card. RF-6, RF-11 (cards only),
 * RNF-6; CA-7, CA-13 (card part). Same component on /coches, brand, segment pages and related models.
 */
const WEB = join(import.meta.dirname, "..");

function writeModel(dir: string, brand: string, model: string, doc: Record<string, any>) {
  mkdirSync(join(dir, brand), { recursive: true });
  writeFileSync(join(dir, brand, `${model}.yaml`), stringify(doc));
}

const make = (model: string, status: string, versions: unknown[], brand = "acme") => ({
  brand,
  brand_name: brand,
  model,
  status: sourced(status),
  segment: sourced("suv_compacto"),
  versions,
});
const version = (name: string) => ({ name, wltp_km: sourced(400), price: { ...sourced(30000), unit: "EUR", price_kind: "pvp" } });

describe("cardView.compare", () => {
  const view = (patch: (d: Record<string, any>) => void = () => {}) => {
    const doc = acme();
    patch(doc);
    return cardView(normalize(doc, "acme/volta.yaml"));
  };

  test("comparable model: short-form link and texts", () => {
    assert.deepEqual(view().compare, {
      href: "/comparar/?v=acme/volta",
      label: "Comparar",
      srLabel: `${acme().brand_name} ${acme().model} con otros coches`,
    });
  });

  test("CA-13: discontinued, no versions or needs_review give no action", () => {
    assert.equal(view((d) => (d.status.value = "discontinued")).compare, null);
    assert.equal(view((d) => (d.versions = [])).compare, null);
    assert.equal(view((d) => (d.needs_review = true)).compare, null);
    assert.notEqual(view((d) => (d.status.value = "announced")).compare, null);
  });
});

describe("built pages", () => {
  let root: string;
  const out = () => join(root, "out");
  const page = (p: string) => readFileSync(join(out(), p, "index.html"), "utf8");
  const cards = (html: string) => [...html.slice(html.indexOf('id="resultados"')).matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]);
  const cardOf = (html: string, name: string) => {
    const li = cards(html).find((s) => s.includes(`>${name}</a>`));
    assert.ok(li, `no card for ${name}`);
    return li;
  };
  const compareLinks = (s: string) => [...s.matchAll(/<a\b[^>]*href="\/comparar\/[^"]*"[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]);

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-web-"));
    const data = join(root, "data");
    writeModel(data, "acme", "Volta", acme());
    writeModel(data, "acme", "Soon", { ...make("Soon", "announced", [version("Soon 1")]), launch: sourced("2026-12") });
    writeModel(data, "acme", "Old", make("Old", "discontinued", [version("Old 1")]));
    writeModel(data, "acme", "Bare", make("Bare", "on_sale", []));
    writeModel(data, "acme", "Hidden", { ...make("Hidden", "on_sale", [version("Hidden 1")]), needs_review: true });
    writeModel(data, "beta", "Near", make("Near", "on_sale", [version("Near 1")], "beta"));
    writeModel(data, "beta", "Gone", make("Gone", "discontinued", [version("Gone 1")], "beta"));
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out()], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-7: /coches card links to /comparar/ with the model, and keeps the sheet link first", () => {
    const html = page("coches");
    const volta = cardOf(html, "Volta");
    const links = compareLinks(volta);
    assert.equal(links.length, 1);
    assert.match(links[0], /href="\/comparar\/\?v=acme\/Volta"/);
    assert.match(links[0], /^<a[^>]*>\s*Comparar\s*<span class="sr-only"> Acme Volta con otros coches<\/span>\s*<\/a>$/);
    // Same link target as before, first in DOM order, still stretched over the card.
    const all = [...volta.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(all, ["/marcas/acme/Volta/", "/comparar/?v=acme/Volta"]);
    assert.match(volta, /<a[^>]*enlace-ficha[^>]*after:absolute|<a[^>]*after:absolute[^>]*enlace-ficha/);
  });

  test("RF-6/RNF-6: a plain underlined text link, above the stretched link, last line of the card", () => {
    const volta = cardOf(page("coches"), "Volta");
    const a = compareLinks(volta)[0];
    assert.match(a, /\bunderline\b/);
    assert.match(a, /\brelative\b/);
    assert.match(a, /\bz-10\b/);
    assert.match(a, /\bmin-h-touch\b/);
    assert.doesNotMatch(a, /\bbg-|\bborder\b|<svg/);
    assert.ok(volta.indexOf("</dl>") < volta.indexOf("/comparar/"), "after the segment");
    assert.ok(volta.trimEnd().endsWith("</li>") && !/<a\b/.test(volta.slice(volta.indexOf("/comparar/") + 1).replace(/^[\s\S]*?<\/a>/, "")));
    // The action needs no script: the card has none of its own.
    assert.doesNotMatch(volta, /<script|onclick/i);
  });

  test("announced models are comparable", () => {
    assert.equal(compareLinks(cardOf(page("coches"), "Soon")).length, 1);
  });

  test("CA-13: discontinued, versionless and needs_review models have no way to be chosen", () => {
    const html = page("coches");
    for (const name of ["Old", "Bare"]) {
      const c = cardOf(html, name);
      assert.equal(compareLinks(c).length, 0, name);
      assert.doesNotMatch(c, /Comparar/);
      assert.equal([...c.matchAll(/<a\b/g)].length, 1, `${name}: only the sheet link`);
    }
    assert.doesNotMatch(html, /Hidden/);
    assert.doesNotMatch(html, /v=acme\/(Old|Bare|Hidden)/);
  });

  test("the same card on brand and segment pages, and in related models", () => {
    for (const p of ["marcas/acme", "segmentos/suv-compacto"]) {
      const html = page(p);
      assert.equal(compareLinks(cardOf(html, "Volta")).length, 1, p);
      assert.equal(compareLinks(cardOf(html, "Old")).length, 0, p);
    }
    const ficha = page("marcas/acme/Volta");
    const related = ficha.slice(ficha.indexOf("data-related"));
    assert.match(related, /href="\/marcas\/beta\/Near\/"/);
    assert.match(related, /href="\/marcas\/beta\/Gone\/"/);
    assert.match(related, /href="\/comparar\/\?v=beta\/Near"/);
    assert.doesNotMatch(related, /v=beta\/Gone/);
  });
});
