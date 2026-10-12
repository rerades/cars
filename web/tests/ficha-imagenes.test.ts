import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { imageEntry, pngBytes, sourced } from "./fixtures.ts";

// RF-12 / CA-12: main image and «Más imágenes» of the model page, on a build over test data.

const WEB = join(import.meta.dirname, "..");

function writeModel(dir: string, model: string, doc: Record<string, any>) {
  mkdirSync(join(dir, "acme"), { recursive: true });
  writeFileSync(
    join(dir, "acme", `${model}.yaml`),
    stringify({ brand: "acme", brand_name: "Acme", model, status: sourced("on_sale"), versions: [], ...doc }),
  );
}

describe("model page images (built HTML)", () => {
  let root: string;
  let out: string;
  const page = (model: string) => readFileSync(join(out, "marcas", "acme", model, "index.html"), "utf8");
  const imgs = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-img-"));
    const data = join(root, "data");
    const images = join(root, "images");
    mkdirSync(join(images, "acme/many"), { recursive: true });
    for (let i = 1; i <= 8; i++) writeFileSync(join(images, `acme/many/p${i}.png`), pngBytes());
    const entry = (i: number, extra: Record<string, unknown> = {}) =>
      imageEntry({ file: `data/images/acme/many/p${i}.png`, attribution: `Author ${i}`, ...extra });

    writeModel(data, "Many", {
      segment: sourced("suv_compacto"),
      images: Array.from({ length: 8 }, (_, k) => entry(k + 1, k === 1 ? { attribution: null } : {})),
    });
    writeModel(data, "One", { segment: sourced("urbano"), images: [entry(1)] });
    const noLicense = entry(1);
    delete (noLicense as any).license;
    const noSource = entry(2);
    delete (noSource as any).source_id;
    writeModel(data, "Bare", { segment: sourced("berlina"), images: [noLicense, noSource] });
    writeModel(data, "NoSeg", { images: [] });
    // Unlicensed first, licensed second: the main image is the first licensed one.
    writeModel(data, "Skip", { images: [noLicense, entry(3)] });

    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data, CARS_IMAGES_DIR: images },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("RF-12: main image is eager, high priority, sized, with its alt", () => {
    const main = imgs(page("Many"))[0];
    assert.doesNotMatch(main, /loading="lazy"/);
    assert.equal(attr(main, "fetchpriority"), "high");
    assert.equal(attr(main, "width"), "1280");
    assert.equal(attr(main, "height"), "720");
    assert.equal(attr(main, "alt"), "Acme Many, imagen 1 de 6");
  });

  test("CA-12: with 8 licensed images, 6 are in the HTML, in file order", () => {
    const html = page("Many");
    const tags = imgs(html);
    assert.equal(tags.length, 6);
    assert.deepEqual(tags.map((t) => attr(t, "alt")), [1, 2, 3, 4, 5, 6].map((i) => `Acme Many, imagen ${i} de 6`));
    for (const t of tags.slice(1)) assert.equal(attr(t, "loading"), "lazy");
    const captions = [...html.matchAll(/<figcaption[^>]*>([^<]*)<\/figcaption>/g)].map((m) => m[1]);
    assert.deepEqual(captions, ["Foto: Author 1", "Foto: Author 3", "Foto: Author 4", "Foto: Author 5", "Foto: Author 6"]);
    assert.doesNotMatch(html, /Author 7|Author 8/);
  });

  test("RF-12: «Más imágenes» is a list of figures with 1/2/3 columns, no links, no JavaScript", () => {
    const html = page("Many");
    const sec = /<section[^>]*data-more-images[\s\S]*?<\/section>/.exec(html)![0];
    assert.match(sec, /<h2[^>]*>Más imágenes<\/h2>/);
    assert.equal([...sec.matchAll(/<li>\s*<figure/g)].length, 5);
    assert.match(sec, /grid-cols-1/);
    assert.match(sec, /md:grid-cols-2/);
    assert.match(sec, /lg:grid-cols-3/);
    assert.doesNotMatch(sec, /<a\b|tabindex|<button/);
    assert.doesNotMatch(html, /<script\b/i);
  });

  test("CA-12: attribution sits under the image; no figcaption when attribution is null", () => {
    const html = page("Many");
    assert.ok(html.indexOf("<img") < html.indexOf("Foto: Author 1"));
    const second = /<figure[\s\S]*?<\/figure>/g;
    const figs = [...html.matchAll(second)].map((m) => m[0]);
    assert.equal(figs.length, 6);
    assert.doesNotMatch(figs[1], /figcaption/);
  });

  test("RF-12: one licensed image gives the main image and no «Más imágenes» section", () => {
    const html = page("One");
    assert.equal(imgs(html).length, 1);
    assert.doesNotMatch(html, /Más imágenes/);
    assert.match(html, /imagen 1 de 1/);
    assert.match(html, /Foto: Author 1/);
  });

  test("CA-12: without a licensed image, the large segment silhouette and no <img>, no caption", () => {
    for (const [model, sil] of [["Bare", "berlina"], ["NoSeg", "generica"]]) {
      const html = page(model);
      assert.equal(imgs(html).length, 0, `${model} shows an image`);
      assert.doesNotMatch(html, /<figure|<figcaption|Más imágenes|background-image/);
      const svg = /<svg\b[^>]*>/.exec(html)![0];
      assert.match(svg, new RegExp(`data-silhouette="${sil}"`));
      assert.match(svg, /aria-hidden="true"/);
      assert.match(svg, /var\(--size-segment-icon-lg\)/);
    }
  });

  test("CA-10: an image without license or source_id is never painted; the first licensed one leads", () => {
    assert.equal(imgs(page("Bare")).length, 0);
    const skip = page("Skip");
    assert.equal(imgs(skip).length, 1);
    assert.match(skip, /Foto: Author 3/);
    assert.match(skip, /imagen 1 de 1/);
  });
});
