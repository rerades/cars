import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { acme, imageEntry, pngBytes, sourced } from "./fixtures.ts";

// RF-8 / RF-1: image or segment silhouette on the card. No real YAML has `file` yet (ADR-0010
// migration), so the image case runs on test data: a temp data dir and a temp images dir.

const WEB = join(import.meta.dirname, "..");
const SEGMENTS = [
  "urbano", "compacto", "berlina", "familiar", "suv_pequeno",
  "suv_compacto", "suv_grande", "monovolumen", "furgoneta", "deportivo",
];

function writeModel(dir: string, model: string, doc: Record<string, any>) {
  mkdirSync(join(dir, "acme"), { recursive: true });
  writeFileSync(join(dir, "acme", `${model}.yaml`), stringify({ brand: "acme", brand_name: "Acme", model, ...doc }));
}

const base = (extra: Record<string, any> = {}) => ({
  status: sourced("on_sale"),
  versions: [{ name: "x", wltp_km: sourced(300) }],
  ...extra,
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("model card image or silhouette (built HTML)", () => {
  let root: string;
  let out: string;
  let html: string;
  const card = (name: string) => {
    const li = [...html.slice(html.indexOf('id="resultados"')).matchAll(/<li\b[\s\S]*?<\/li>/g)]
      .map((m) => m[0])
      .find((s) => s.includes(`>${name}</a>`));
    assert.ok(li, `no card for ${name}`);
    return li;
  };

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-img-"));
    const data = join(root, "data");
    const images = join(root, "images");
    mkdirSync(join(images, "acme/withimage"), { recursive: true });
    writeFileSync(join(images, "acme/withimage/front.png"), pngBytes());
    const withImage = (extra: Record<string, unknown> = {}) =>
      imageEntry({ file: "data/images/acme/withimage/front.png", ...extra });

    writeModel(data, "WithImage", base({ segment: sourced("suv_compacto"), images: [withImage()] }));
    writeModel(data, "NoAttribution", base({ segment: sourced("urbano"), images: [withImage({ attribution: null })] }));
    // Images that must not be published: no license, no source_id, file missing.
    const noLicense = withImage();
    delete (noLicense as any).license;
    const noSource = withImage();
    delete (noSource as any).source_id;
    writeModel(data, "NoLicense", base({ segment: sourced("berlina"), images: [noLicense] }));
    writeModel(data, "NoSource", base({ segment: sourced("familiar"), images: [noSource] }));
    writeModel(data, "MissingFile", base({ segment: sourced("deportivo"), images: [withImage({ file: "data/images/acme/x/none.png" })] }));
    writeModel(data, "OldShape", base({ segment: sourced("furgoneta"), images: [{ url: "https://upload.wikimedia.org/x.jpg", source_id: "wikimedia-commons", retrieved: "2026-09-20", license: "CC0", attribution: null }] }));
    // One model per segment without image, and one without segment.
    for (const s of SEGMENTS) writeModel(data, `Seg_${s}`, base({ segment: sourced(s), images: [] }));
    writeModel(data, "NoSegment", base({ images: [] }));
    writeModel(data, "Volta", acme());

    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data, CARS_IMAGES_DIR: images },
      stdio: "pipe",
    });
    html = readFileSync(join(out, "coches/index.html"), "utf8");
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-1 (image field): every card has an image or a silhouette, never an empty slot", () => {
    const cards = [...html.slice(html.indexOf('id="resultados"')).matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]);
    assert.equal(cards.length, 18);
    for (const c of cards) assert.match(c, /<img\b|<svg\b/);
    assert.match(card("WithImage"), /<img\b/);
    assert.doesNotMatch(card("WithImage"), /<svg\b/);
  });

  test("RF-8: the image is a local WebP with width and height, empty alt, attribution below linked to page_url", () => {
    const c = card("WithImage");
    const img = /<img\b[^>]*>/.exec(c)![0];
    assert.match(img, /src="\/_astro\/[^"]+\.webp"/);
    assert.match(img, /width="640"/);
    assert.match(img, /height="360"/);
    assert.match(img, /\salt(="")?[\s>]/); // `alt` and `alt=""` are the same empty text
    assert.ok(c.indexOf("<img") < c.indexOf("Foto: A. Author"), "attribution goes below the image");
    assert.match(c, /<a href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Acme_Volta\.png"[^>]*>Foto: A\. Author, CC BY-SA 4\.0<\/a>/);
    // No attribution text, no attribution link.
    assert.equal([...card("NoAttribution").matchAll(/<a\b/g)].length, 1);
  });

  test("CA-10: no image without license and source_id reaches the HTML", () => {
    for (const name of ["NoLicense", "NoSource", "MissingFile", "OldShape"]) {
      assert.doesNotMatch(card(name), /<img\b/, `${name} published an image`);
      assert.match(card(name), /<svg\b/);
    }
    // The only <img> of the page are the two valid ones.
    assert.equal([...html.matchAll(/<img\b/g)].length, 2);
    // The downloaded file's host (source_url) is never linked.
    assert.doesNotMatch(html, /upload\.wikimedia\.org/);
  });

  test("CA-17: a model without image carries the silhouette of its segment and no brand image", () => {
    const sil = (name: string) => /data-silhouette="([^"]+)"/.exec(card(name))?.[1];
    for (const s of SEGMENTS) {
      assert.equal(sil(`Seg_${s}`), s);
      assert.doesNotMatch(card(`Seg_${s}`), /<img\b|<picture\b|background-image/i);
    }
    assert.equal(sil("NoSegment"), "generica");
    assert.match(card("NoSegment"), /Segmento por confirmar/);
    // Decorative and textless (siluetas-segmento.md).
    const svg = /<svg\b[\s\S]*?<\/svg>/.exec(card("Seg_urbano"))![0];
    assert.match(svg, /aria-hidden="true"/);
    assert.match(svg, /focusable="false"/);
    assert.match(svg, /stroke="currentColor"/);
    assert.doesNotMatch(svg, /<title|<desc|<text/);
    const all = new Set(SEGMENTS.map((s) => /<path d="([^"]+)"/.exec(card(`Seg_${s}`))![1]));
    all.add(/<path d="([^"]+)"/.exec(card("NoSegment"))![1]);
    assert.equal(all.size, 11, "the 11 silhouettes are all different");
  });

  test("RNF-5 / CA-7: no src or srcset in the built HTML points to another domain", () => {
    const pages = walk(out).filter((f) => f.endsWith(".html"));
    assert.ok(pages.length > 1);
    let checked = 0;
    for (const f of pages) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/\b(?:src|srcset)="([^"]*)"/g)) {
        for (const part of m[1].split(",")) {
          const url = part.trim().split(/\s+/)[0];
          if (url === "") continue;
          checked++;
          assert.match(url, /^\/(?!\/)/, `${f}: ${url} is not a same-origin path`);
        }
      }
    }
    assert.ok(checked > 0, "the test saw no src at all");
  });
});
