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
      review({ version: "Volta 80 AWD" }),
      review({ title: "Acme Volta, primera prueba", url: "https://videos.motor.example/acme-volta" }),
    ];
    write("Volta", withReviews);
    write("Plain", base("Plain", {}));
    // Another brand in Volta's segment, so Volta gets «Otros modelos del segmento».
    mkdirSync(join(root, "data", "beta"), { recursive: true });
    writeFileSync(
      join(root, "data", "beta", "Rival.yaml"),
      stringify({ ...base("Rival", { segment: sourced("suv_compacto") }), brand: "beta", brand_name: "Beta" }),
    );
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
    const html = page("Volta");
    const related = html.indexOf("data-related");
    assert.ok(related > 0, "Volta has «Otros modelos del segmento» (Rival)");
    assert.ok(html.indexOf("<section aria-labelledby=\"reviews\"") > related);
  });

  test("only `reviews`: h2, entry line and a ul with one li per review, no h3; links go to the url", () => {
    const html = page("Volta");
    const section = /<section[^>]*data-reviews[\s\S]*?<\/section>/.exec(html)![0];
    assert.doesNotMatch(section, /<h3/);
    assert.match(section, /Enlaces a pruebas de este modelo publicadas por otros medios/);
    assert.doesNotMatch(section, /Resultados de pruebas|Resultados publicados por organismos/);
    assert.equal((section.match(/<ul/g) ?? []).length, 1);
    assert.equal((section.match(/<li/g) ?? []).length, 2);
    assert.match(section, /<a href="https:\/\/www\.motor\.example\/pruebas\/acme-volta-80-awd"[^>]*>Acme Volta 80 AWD: probamos el SUV eléctrico de 520 km<span class="sr-only">/);
    assert.match(section, /<a href="https:\/\/videos\.motor\.example\/acme-volta"/);
    assert.doesNotMatch(section, /target="_blank"/);
  });

  const entries = () =>
    [...(/<section[^>]*data-reviews[\s\S]*?<\/section>/.exec(page("Volta"))![0].matchAll(/<li[\s\S]*?<\/li>/g))].map((m) => m[0]);

  test("CA-1, CA-6: each entry has the title as link text, outlet, domain and retrieval date", () => {
    const [first, second] = entries();
    assert.match(first, /<a href="https:\/\/www\.motor\.example\/pruebas\/acme-volta-80-awd"[^>]*>Acme Volta 80 AWD: probamos el SUV eléctrico de 520 km<span/);
    assert.match(first, /Motor Ejemplo · motor\.example · consultado el 20 sep 2026/);
    assert.match(second, /Motor Ejemplo · videos\.motor\.example · consultado el 20 sep 2026/);
    for (const e of [first, second]) assert.doesNotMatch(e.replace(/href="[^"]*"/, ""), /www\./, "domain shown without www.");
  });

  test("RF-7: «Sobre la versión» only when the review has a version, as plain text", () => {
    const [first, second] = entries();
    assert.match(first, /<p[^>]*>Sobre la versión Volta 80 AWD<\/p>/);
    assert.doesNotMatch(second, /Sobre la versión/);
  });

  test("CA-6: nothing but link, source line and version: no details, img, extract, rating, button, lang", () => {
    for (const e of entries()) {
      assert.doesNotMatch(e, /<details|<img|<svg|<button|<blockquote|lang=|target=|★|estrella|puntuaci/i);
      assert.equal((e.match(/<a /g) ?? []).length, 1);
      const text = e.replace(/<[^>]+>/g, "|").split("|").map((s) => s.trim()).filter(Boolean);
      assert.ok(text.length <= 4, `title, sr text, source line, optional version: ${JSON.stringify(text)}`);
    }
  });

  test("accessible name includes the hidden text with outlet, brand and model", () => {
    const [first] = entries();
    assert.match(first, /<span class="sr-only"> \(review de Motor Ejemplo sobre Acme Volta, en otra web\)<\/span><\/a>/);
  });

  test("CA-5: no link in the block has affiliate parameters or leaves the source's domain", () => {
    const section = /<section[^>]*data-reviews[\s\S]*?<\/section>/.exec(page("Volta"))![0];
    const hrefs = [...section.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    assert.equal(hrefs.length, 2);
    for (const h of hrefs) {
      assert.doesNotMatch(h, /[?&](utm_|aff|ref)|\?/i);
      assert.match(new URL(h).hostname, /(^|\.)motor\.example$/);
    }
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
