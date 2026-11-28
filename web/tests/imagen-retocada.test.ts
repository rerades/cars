import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { imageEntry, pngBytes, sourced } from "./fixtures.ts";

// PRD-001 RF-15, CA-23 (story #1149): a retouched image (an `edits` entry) is shown whole, with the credit
// «(modificada)», in the catalogue card and in the first screen of the model page.

const WEB = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(p, "utf8");

describe("retouched image (built HTML)", () => {
  let root: string;
  let out: string;
  const ficha = (model: string) => read(join(out, "marcas", "acme", model, "index.html"));
  const header = (html: string) => /<header[^>]*data-ficha-header[\s\S]*?<\/header>/.exec(html)![0];
  const card = (html: string, model: string) =>
    [...html.matchAll(/<li\b[^>]*class="[^"]*screen[\s\S]*?<\/li>/g)].map((m) => m[0]).find((c) => c.includes(`data-name="${model}"`))!;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-cutout-"));
    const data = join(root, "data");
    const images = join(root, "images");
    mkdirSync(join(images, "acme/cut"), { recursive: true });
    writeFileSync(join(images, "acme/cut/c1.png"), pngBytes());
    mkdirSync(join(data, "acme"), { recursive: true });
    const write = (model: string, doc: Record<string, any>) =>
      writeFileSync(
        join(data, "acme", `${model}.yaml`),
        stringify({ brand: "acme", brand_name: "Acme", model, status: sourced("on_sale", { url: "https://www.acme.example/es/x" }), versions: [], ...doc }),
      );
    const file = "data/images/acme/cut/c1.png";
    write("Cut", { images: [imageEntry({ file, edits: ["background"], attribution: "Ann Author, CC BY-SA 4.0" })] });
    write("Nocredit", { images: [imageEntry({ file, edits: ["background"], attribution: null })] });
    write("Plain", { images: [imageEntry({ file, attribution: "Ann Author, CC BY-SA 4.0" })] });
    write("Silhouette", { images: [] });
    // «Más imágenes» (story #1247): a retouched 2nd image with credit, one without credit, a normal one.
    write("More", {
      images: [
        imageEntry({ file }),
        imageEntry({ file, edits: ["background"], attribution: "Ann Author, CC BY-SA 4.0" }),
        imageEntry({ file, edits: ["background"], attribution: null }),
        imageEntry({ file, attribution: "Bob Plain, CC BY 4.0" }),
      ],
    });

    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data, CARS_IMAGES_DIR: images },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-23: the card of a retouched image says the photo is modified, linked to its page", () => {
    const c = card(read(join(out, "coches/index.html")), "Cut");
    assert.match(c, /<a [^>]*href="https:\/\/commons\.wikimedia\.org[^"]*"[^>]*>Foto: Ann Author, CC BY-SA 4\.0 \(modificada\)<\/a>/);
  });

  test("the card fits the car whole: a cut-out box, no ScreenPhoto (no cover, scrim, vignette or tone), empty alt", () => {
    const c = card(read(join(out, "coches/index.html")), "Cut");
    assert.match(c, /class="cutout"/);
    assert.match(c, /class="cutout-photo"/);
    assert.doesNotMatch(c, /screen-photo/);
    assert.match(c, /<img\b[^>]*\balt(?:="")?[ >]/); // the build writes an empty alt as a bare attribute
    assert.match(c, /class="[^"]*band-dark/);
  });

  test("the fit, floor and filter live in CutoutPhoto: contain, bottom, floor token, no blend or vignette", () => {
    const src = read(join(WEB, "src/components/CutoutPhoto.astro"));
    assert.match(src, /object-fit: contain/);
    assert.match(src, /object-position: 50% 100%/);
    assert.match(src, /var\(--color-cutout-floor\)/);
    assert.match(src, /saturate\(0\.72\) contrast\(1\.06\) brightness\(0\.86\)/);
    assert.doesNotMatch(src, /mix-blend-mode|object-fit: cover/);
    const tokens = read(join(WEB, "src/styles/global.css"));
    assert.match(tokens, /--color-cutout-floor: rgb\(255 255 255 \/ 0\.07\)/);
    assert.match(tokens, /--size-cutout-mobile: 12rem/);
  });

  test("the card box and text follow the design: 12 rem on mobile, the opposite half on lg, alternating", () => {
    const src = read(join(WEB, "src/components/ModelCard.astro"));
    assert.match(src, /\.cutout \{[^}]*height: var\(--size-cutout-mobile\)/);
    assert.match(src, /padding-top: 14\.5rem/);
    assert.match(src, /inset: 2\.5rem 2\.5rem 2\.5rem 50%/);
    assert.match(src, /:nth-child\(even\) \.cutout \{[^}]*inset: 2\.5rem 50% 2\.5rem 2\.5rem/);
  });

  test("served as WebP, never the original PNG (RNF-2)", () => {
    for (const html of [read(join(out, "coches/index.html")), header(ficha("Cut"))]) {
      const srcs = [...html.matchAll(/<img\b[^>]*>/g)].flatMap((m) => [...m[0].matchAll(/(?:src|srcset)="([^"]*)"/g)].map((s) => s[1]!));
      assert.ok(srcs.length > 0);
      for (const s of srcs) assert.doesNotMatch(s, /\.png/i, s);
      assert.match(srcs.join(" "), /\.webp/);
    }
    const files = readdirSync(join(out, "_astro"));
    assert.ok(files.some((f) => f.endsWith(".webp")));
  });

  test("first screen of the ficha: credit «(modificada)» in its own line in the text, the image eager and high priority", () => {
    const h = header(ficha("Cut"));
    assert.match(h, /<p class="hero-credit-line" data-credit>Foto: Ann Author, CC BY-SA 4\.0 \(modificada\)<\/p>/);
    assert.ok(h.indexOf("data-web-marca") < h.indexOf("data-credit"), "credit after the links row");
    assert.ok(h.indexOf("data-credit") < h.indexOf("data-cifras"), "credit inside the text, above the key figures");
    assert.match(h, /class="hero-cutout"/);
    assert.doesNotMatch(h, /screen-photo/);
    const img = /<img\b[^>]*>/.exec(h)![0];
    assert.doesNotMatch(img, /loading="lazy"/);
    assert.match(img, /fetchpriority="high"/);
    assert.match(img, /alt="Acme Cut, imagen 1 de 1"/);
    assert.match(img, /sizes="\(min-width: 1440px\) 720px, \(min-width: 1024px\) 50vw, 100vw"/);
    assert.match(h, /band-dark/);
  });

  test("without attribution there is no credit; without `edits` the normal photo; without image the silhouette", () => {
    assert.doesNotMatch(header(ficha("Nocredit")), /data-credit|Foto:/);
    assert.doesNotMatch(card(read(join(out, "coches/index.html")), "Nocredit"), /screen-foot[^>]*>[^<]*<a[^>]*>Foto/);
    const plain = header(ficha("Plain"));
    assert.match(plain, /screen-photo/);
    assert.doesNotMatch(plain, /cutout|\(modificada\)/);
    assert.match(plain, /<figcaption[^>]*>Foto: Ann Author/);
    const c = card(read(join(out, "coches/index.html")), "Plain");
    assert.match(c, /screen-photo/);
    assert.doesNotMatch(c, /\(modificada\)/);
    assert.match(header(ficha("Silhouette")), /data-slot="silhouette"/);
  });

  test("«Más imágenes»: retouched images in an ink-950 CutoutPhoto box, normal photo with cover, credits as designed", () => {
    const html = ficha("More");
    const section = /<section[^>]*data-more-images[\s\S]*?<\/section>/.exec(html)![0];
    const items = [...section.matchAll(/<li>[\s\S]*?<\/li>/g)].map((m) => m[0]);
    assert.equal(items.length, 3);
    const [cut, nocredit, plain] = items as [string, string, string];
    // CA-12 / CA-23: retouched → cut-out box, credit says «(modificada)»; alt without «modificada».
    assert.match(cut, /data-more-cutout/);
    assert.match(cut, /class="cutout-photo"/);
    assert.doesNotMatch(cut, /object-cover/);
    assert.match(cut, /<figcaption[^>]*>Foto: Ann Author, CC BY-SA 4\.0 \(modificada\)<\/figcaption>/);
    const img = /<img\b[^>]*>/.exec(cut)![0];
    assert.match(img, /alt="Acme More, imagen 2 de 4"/);
    assert.doesNotMatch(img, /modificada/);
    assert.match(img, /loading="lazy"/);
    assert.match(img, /\bwidth="\d+"/);
    assert.match(img, /\bheight="\d+"/);
    assert.match(img, /sizes="\(min-width: 1440px\) 475px, \(min-width: 1024px\) 33vw, \(min-width: 768px\) 50vw, 100vw"/);
    assert.match(img, /\.webp/);
    assert.doesNotMatch(cut, /\.png/i);
    // no attribution → cut-out without credit
    assert.match(nocredit, /data-more-cutout/);
    assert.doesNotMatch(nocredit, /figcaption/);
    // no edits → normal photo, cover, normal credit
    assert.doesNotMatch(plain, /data-more-cutout|cutout-photo|modificada/);
    assert.match(plain, /object-cover/);
    assert.match(plain, /<figcaption[^>]*>Foto: Bob Plain/);
  });

  test("«Más imágenes» box: ink-950 background, 0.75 rem padding at the top and sides, 0.25 rem at the bottom, same 16:9 cell", () => {
    const src = read(join(WEB, "src/components/ModelFigure.astro"));
    assert.match(src, /\.more-cutout \{[^}]*background: var\(--color-ink-950\)/);
    assert.match(src, /\.more-cutout \{[^}]*padding: 0\.75rem 0\.75rem 0\.25rem/);
    assert.match(src, /class="more-cutout aspect-video overflow-hidden rounded-card"/);
    assert.equal(existsSync(join(WEB, "design-proto/mas-imagenes-retocadas.astro")), false, "prototype removed (ADR-0024)");
    assert.ok(existsSync(join(WEB, "design-proto/a/Cifra.astro")));
    assert.ok(existsSync(join(WEB, "design-proto/pantalla.css")));
  });
  // «The car is shown whole at 390 and 1280 px» is checked in a real browser by
  // e2e/mas-imagenes-retocadas.spec.ts (measures the rendered car; fails with `cover`).

  test("the ficha text width is capped to the page frame, not to the whole viewport", () => {
    const src = read(join(WEB, "src/pages/marcas/[marca]/[modelo].astro"));
    assert.match(src, /\.hero-screen--cutout \.hero-text > \* \{[^}]*calc\(min\(50vw, 45rem\) - 4rem\)/);
    assert.match(src, /inset: 6\.5rem 2\.5rem 12rem 50%/);
  });
});
