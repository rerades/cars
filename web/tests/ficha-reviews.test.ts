import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { acme, sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");

const review = (extra: Record<string, unknown> = {}) => ({
  title: "Acme Volta 80 AWD: probamos el SUV eléctrico de 520 km",
  url: "https://www.motor.example/pruebas/acme-volta-80-awd",
  source_id: "motorejemplo-es",
  retrieved: "2026-09-20",
  tier: "T3",
  ...extra,
});

describe("«Reviews» block on the model page (PRD-006 RF-10, CA-9; PRD-002 RF-16, CA-19)", () => {
  let root: string;
  let out: string;
  const page = (m: string) => readFileSync(join(out, "marcas", "acme", m, "index.html"), "utf8");
  const write = (model: string, doc: Record<string, unknown>) => {
    mkdirSync(join(root, "data", "acme"), { recursive: true });
    writeFileSync(join(root, "data", "acme", `${model}.yaml`), stringify(doc));
  };
  const base = (name: string, extra: Record<string, unknown>) => ({
    brand: "acme",
    brand_name: "Acme",
    model: name,
    status: sourced("on_sale", { url: "https://www.acme.example/status" }),
    versions: [],
    ...extra,
  });

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-reviews-"));
    mkdirSync(join(root, "sources"), { recursive: true });
    const source = (id: string, extra: Record<string, unknown> = {}) =>
      writeFileSync(
        join(root, "sources", `${id}.yaml`),
        stringify({
          id,
          brand: "varias",
          name: "Motor Ejemplo",
          tier: "T3",
          market: "ES",
          kind: ["reviews"],
          urls: { home: "https://www.motor.example/" },
          terms_url: "https://www.motor.example/aviso-legal",
          terms_checked: "2026-09-20",
          ...extra,
        }),
      );
    source("motorejemplo-es");
    const withReviews = acme();
    withReviews.reviews = [
      review(),
      review({ title: "Acme Volta, primera prueba", url: "https://videos.motor.example/acme-volta" }),
    ];
    write("Volta", withReviews);
    write("Plain", base("Plain", {}));
    // Invalid (url off the source's domain): dropped, so the model has no publishable review.
    write("Dropped", base("Dropped", { reviews: [review({ url: "https://other.example/x" })] }));
    // needs_review: no page at all.
    write("Pending", base("Pending", { needs_review: true, reviews: [review()] }));
    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: join(root, "data"), CARS_SOURCES_DIR: join(root, "sources") },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-19: with reviews, the block is the last of main, after «Otros modelos» and «Fuentes»", () => {
    const html = page("Volta");
    assert.equal((html.match(/data-reviews[ >]/g) ?? []).length, 1);
    assert.match(html, /<h2 id="reviews"[^>]*>Reviews<\/h2>/);
    const at = html.indexOf("<section aria-labelledby=\"reviews\"");
    assert.ok(at > html.indexOf("data-fuentes"), "after Fuentes");
    assert.ok(at > html.indexOf("data-ficha-modelo"));
    assert.ok(html.indexOf("</main>") > at);
    assert.equal(html.slice(at).split("<section").length, 2, "no section after Reviews");
  });

  test("CA-19: after the related-models block when the model has one", () => {
    // Real data: every page with both blocks keeps the order. Here, the order in the template.
    const html = readFileSync(join(WEB, "src/pages/marcas/[marca]/[modelo].astro"), "utf8");
    assert.ok(html.indexOf("<ReviewsBlock") > html.indexOf("data-related"));
    assert.ok(html.indexOf("<ReviewsBlock") > html.indexOf("data-fuentes"));
  });

  test("only `reviews`: h2, entry line and a ul with one li per review, no h3; links go to the url", () => {
    const html = page("Volta");
    const section = /<section[^>]*data-reviews[\s\S]*?<\/section>/.exec(html)![0];
    assert.doesNotMatch(section, /<h3/);
    assert.match(section, /Enlaces a pruebas de este modelo publicadas por otros medios/);
    assert.doesNotMatch(section, /Resultados de pruebas|Resultados publicados por organismos/);
    assert.equal((section.match(/<ul/g) ?? []).length, 1);
    assert.equal((section.match(/<li/g) ?? []).length, 2);
    assert.match(section, /<a href="https:\/\/www\.motor\.example\/pruebas\/acme-volta-80-awd"[^>]*>Acme Volta 80 AWD: probamos el SUV eléctrico de 520 km<\/a>/);
    assert.match(section, /<a href="https:\/\/videos\.motor\.example\/acme-volta"/);
    assert.doesNotMatch(section, /target="_blank"/);
  });

  test("without reviews (or only dropped ones) there is no block: no h2, no text", () => {
    for (const m of ["Plain", "Dropped"]) {
      const html = page(m);
      assert.doesNotMatch(html, /data-reviews|id="reviews"|>Reviews</i, m);
      assert.doesNotMatch(html, /Enlaces a pruebas de este modelo/);
    }
  });

  test("CA-4: a model with needs_review has no page, so no block", () => {
    assert.equal(existsSync(join(out, "marcas", "acme", "Pending")), false);
  });

  test("CA-9: no reviews URL in the build, no nav anchor, no «Ver todas»", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)).concat(join(dir, n)) : [join(dir, n)]));
    const paths = walk(out).map((p) => p.slice(out.length));
    assert.deepEqual(paths.filter((p) => /review/i.test(p)), []);
    const html = page("Volta");
    assert.doesNotMatch(html, /href="[^"]*(#reviews|\/reviews)/);
    assert.doesNotMatch(html, /Ver todas/);
  });
});
