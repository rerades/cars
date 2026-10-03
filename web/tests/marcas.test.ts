import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { brandPages, sortByNovelty } from "../src/lib/catalog.ts";
import { normalize } from "../src/lib/data.ts";
import { acme, sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");

function writeModel(dir: string, brand: string, model: string, doc: Record<string, any>) {
  mkdirSync(join(dir, brand), { recursive: true });
  writeFileSync(join(dir, brand, `${model}.yaml`), stringify(doc));
}

const bare = (brand: string, brandName: string, model: string, extra: Record<string, any> = {}) => ({
  brand,
  brand_name: brandName,
  model,
  status: sourced("on_sale"),
  versions: [],
  ...extra,
});

const text = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("brandPages and sortByNovelty", () => {
  test("novelty order: newest first, no launch date last (RF-3)", () => {
    const mk = (model: string, launch?: string) => {
      const doc = bare("x", "X", model, launch ? { launch: sourced(launch) } : {});
      return normalize(doc, `x/${model}.yaml`);
    };
    const order = sortByNovelty([mk("None"), mk("Old", "2024-03"), mk("New", "2026-10-15")]).map((m) => m.model);
    assert.deepEqual(order, ["New", "Old", "None"]);
  });

  test("groups by brand slug; empty input gives no pages", () => {
    assert.deepEqual(brandPages([]), []);
  });
});

describe("/marcas/{marca} built pages", () => {
  let out: string;
  let root: string;
  const page = (slug: string) => readFileSync(join(out, "marcas", slug, "index.html"), "utf8");
  const brandDirs = () =>
    readdirSync(join(out, "marcas"), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(out, "marcas", d.name, "index.html")))
      .map((d) => d.name)
      .sort();
  const h1 = (html: string) => text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1]);
  const intro = (html: string) => text(/<p[^>]*data-intro[^>]*>([\s\S]*?)<\/p>/.exec(html)![1]);
  const cards = (html: string) => [...html.slice(html.indexOf('id="resultados"')).matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]);

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-brands-"));
    const data = join(root, "data");
    writeModel(data, "acme", "Volta", acme());
    writeModel(data, "acme", "Soon", {
      ...bare("acme", "Acme", "Soon"),
      status: sourced("announced"),
      launch: sourced("2026-10-15"),
    });
    writeModel(data, "beta", "Solo", bare("beta", "Beta", "Solo"));
    writeModel(data, "gamma", "Hidden", bare("gamma", "Gamma", "Hidden", { needs_review: true }));
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", join(root, "out")], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
    out = join(root, "out");
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-4: /marcas/acme shows only Acme models", () => {
    const html = page("acme");
    const list = cards(html);
    assert.equal(list.length, 2);
    for (const li of list) assert.match(text(li), /^Acme /);
    assert.doesNotMatch(list.join(""), /Solo|Beta/);
    assert.deepEqual(
      list.map((li) => /href="([^"]*)"/.exec(li)![1]).sort(),
      ["/marcas/acme/Soon/", "/marcas/acme/Volta/"],
    );
  });

  test("CA-12a: exactly one page per brand with published models (needs_review brand has none)", () => {
    assert.deepEqual(brandDirs(), ["acme", "beta"]);
    assert.equal(existsSync(join(out, "marcas", "gamma")), false);
  });

  test("CA-12b: h1, title and intro are different on every brand page, and use the design texts", () => {
    const slugs = brandDirs();
    const h1s = slugs.map((s) => h1(page(s)));
    const intros = slugs.map((s) => intro(page(s)));
    assert.equal(new Set(h1s).size, slugs.length);
    assert.equal(new Set(intros).size, slugs.length);
    assert.equal(new Set(slugs.map((s) => /<title>([^<]*)<\/title>/.exec(page(s))![1])).size, slugs.length);
    assert.equal(h1(page("acme")), "Coches eléctricos Acme");
    assert.equal(
      intro(page("beta")),
      "Los modelos eléctricos de Beta en España, a la venta, anunciados y descatalogados, con su precio desde sin ayudas y su autonomía WLTP.",
    );
  });

  test("CA-12c: served HTML has the cards and the counter, with no JavaScript", () => {
    const html = page("acme");
    assert.doesNotMatch(html, /<script\b/i);
    assert.match(html, /<p[^>]*data-count[^>]*>\s*2 modelos\s*<\/p>/);
    assert.match(text(html), /Volta/);
    assert.match(text(html), /Próximamente · oct 2026/);
    assert.match(page("beta"), /<p[^>]*data-count[^>]*>\s*1 modelo\s*<\/p>/);
    assert.match(page("acme"), /<h2 id="resultados"[^>]*>Modelos<\/h2>/);
  });

  test("order: Novedad, the announced model with a launch date before one without", () => {
    const names = cards(page("acme")).map((li) => /<h3[\s\S]*?>([^<]+)<\/a>/.exec(li)![1].trim());
    assert.deepEqual(names, ["Soon", "Volta"]);
  });
});
