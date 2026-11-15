import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { assignBands } from "../src/lib/bands.ts";
import { imageEntry, pngBytes, sourced } from "./fixtures.ts";

// PRD-002 story #1039: first screen of the model page (dark band, photo or silhouette) and the band colour rule.
// CA-2, CA-10, CA-13 and CA-16 are also checked on the hero here; ficha.test.ts keeps its own checks of them.

const WEB = join(import.meta.dirname, "..");
const text = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("band colours (assignBands)", () => {
  const optional = ["datos", "imagenes", "relacionados", "fuentes", "reviews"];
  const subsets = Array.from({ length: 1 << optional.length }, (_, m) => ["versiones", ...optional.filter((_, i) => m & (1 << i))]);

  test("two bands in a row never share a colour, the first screen (dark) included, for every combination of sections", () => {
    for (const ids of subsets) {
      const colors = ["dark", ...assignBands(ids)];
      colors.forEach((c, i) => i > 0 && assert.notEqual(c, colors[i - 1], `${ids.join(",")}: ${colors.join(",")}`));
    }
  });

  test("«Fuentes» is always light", () => {
    for (const ids of subsets.filter((s) => s.includes("fuentes"))) {
      assert.equal(assignBands(ids)[ids.indexOf("fuentes")], "light", ids.join(","));
    }
  });

  test("the full sequence is white, dark, light, white, dark, light; a missing section hands its colour to the next", () => {
    assert.deepEqual(assignBands(["versiones", "datos", "imagenes", "relacionados", "fuentes", "reviews"]), ["white", "dark", "light", "white", "light", "white"]);
    assert.deepEqual(assignBands(["versiones", "datos", "fuentes"]).slice(0, 2), ["white", "dark"]);
    assert.deepEqual(assignBands(["versiones", "imagenes", "fuentes"]).slice(0, 2), ["white", "dark"]);
  });
});

describe("first screen of the model page (built HTML)", () => {
  let root: string;
  let out: string;
  const page = (model: string) => readFileSync(join(out, "marcas", "acme", model, "index.html"), "utf8");
  const header = (html: string) => /<header[^>]*data-ficha-header[\s\S]*?<\/header>/.exec(html)![0];

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-hero-"));
    const data = join(root, "data");
    const images = join(root, "images");
    mkdirSync(join(images, "acme/photo"), { recursive: true });
    writeFileSync(join(images, "acme/photo/p1.png"), pngBytes());
    mkdirSync(join(data, "acme"), { recursive: true });
    const write = (model: string, doc: Record<string, any>) =>
      writeFileSync(
        join(data, "acme", `${model}.yaml`),
        stringify({ brand: "acme", brand_name: "Acme", model, status: sourced("on_sale", { url: "https://www.acme.example/es/photo" }), versions: [], ...doc }),
      );
    write("Photo", {
      segment: sourced("suv_compacto"),
      images: [imageEntry({ file: "data/images/acme/photo/p1.png", attribution: "Ann Author" })],
      versions: [{ name: "Photo 60", price: { ...sourced(30000), unit: "EUR", price_kind: "pvp" } }],
    });
    write("Soon", { status: sourced("announced"), launch: sourced("2026-10"), images: [] });
    write("Gone", { status: sourced("discontinued"), segment: sourced("berlina"), images: [] });
    write("Plain", { images: [] });

    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data, CARS_IMAGES_DIR: images },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("the header is a dark band holding route, h1, status and segment, photo and credit; one h1", () => {
    const html = page("Photo");
    const h = header(html);
    assert.match(h, /class="[^"]*band-dark/);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    for (const part of ["data-ficha-ruta", "<h1", "data-field=\"segment\"", "data-web-marca", "<img", "Foto: Ann Author"]) {
      assert.ok(h.includes(part), part);
    }
    assert.ok(h.indexOf("data-ficha-ruta") < h.indexOf("<h1"), "route before the h1 in the DOM");
    assert.ok(h.indexOf("<img") < h.indexOf("<figcaption"), "caption after the image");
  });

  test("the photo reuses ScreenPhoto (the card's treatment): eager, high priority, sized, empty alt on none", () => {
    const h = header(page("Photo"));
    assert.match(h, /class="screen-photo"/);
    const img = /<img\b[^>]*>/.exec(h)![0];
    assert.doesNotMatch(img, /loading="lazy"/);
    assert.match(img, /fetchpriority="high"/);
    assert.match(img, /width="1280"/);
    assert.match(img, /height="720"/);
    assert.match(img, /alt="Acme Photo, imagen 1 de 1"/);
    const page_ = readFileSync(join(WEB, "src/pages/marcas/[marca]/[modelo].astro"), "utf8");
    const card = readFileSync(join(WEB, "src/components/ModelCard.astro"), "utf8");
    assert.match(page_, /import ScreenPhoto/);
    assert.match(card, /import ScreenPhoto/);
    // The treatment lives once, in ScreenPhoto: neither consumer repeats the filter or the tone.
    for (const src of [page_, card]) assert.doesNotMatch(src, /saturate\(|#1d4a5c/);
  });

  test("the h1 uses --text-display", () => {
    const src = readFileSync(join(WEB, "src/pages/marcas/[marca]/[modelo].astro"), "utf8");
    assert.match(src, /\.hero-name \{[^}]*font-size: var\(--text-display\)/);
  });

  test("without a photo the first screen stays dark and carries the silhouette, no image, no caption", () => {
    const h = header(page("Plain"));
    assert.match(h, /band-dark/);
    assert.match(h, /data-slot="silhouette"/);
    assert.match(h, /data-silhouette="generica"/);
    assert.doesNotMatch(h, /<img|<figure|<figcaption/);
  });

  test("CA-2: brand, model, segment label and status; without segment «Segmento por confirmar»", () => {
    const h = header(page("Photo"));
    assert.match(text(/<h1[^>]*>[\s\S]*?<\/h1>/.exec(h)![0]), /^Acme Photo$/);
    assert.match(text(h), /Segmento SUV compacto/);
    assert.match(text(header(page("Plain"))), /Segmento por confirmar/);
  });

  test("CA-10: announced with launch 2026-10 shows «Próximamente · oct 2026»; discontinued «Descatalogado»; on_sale none; never two", () => {
    const labels = (html: string) => [...header(html).matchAll(/data-status="(soon|discontinued)"[^>]*>([^<]*)</g)].map((m) => m[2]);
    assert.deepEqual(labels(page("Soon")), ["Próximamente · oct 2026"]);
    assert.deepEqual(labels(page("Gone")), ["Descatalogado"]);
    assert.deepEqual(labels(page("Photo")), []);
  });

  test("CA-13: the brand link goes to /marcas/acme/ and «Coches» to /coches", () => {
    const nav = /<nav[^>]*data-ficha-ruta[\s\S]*?<\/nav>/.exec(page("Photo"))![0];
    assert.match(nav, /<a[^>]*href="\/coches"[^>]*>Coches<\/a>/);
    assert.match(nav, /<a[^>]*href="\/marcas\/acme\/"[^>]*>Acme<\/a>/);
  });

  test("CA-16: «Ver en la web de la marca» goes to status.url and is a text link, not a button", () => {
    const h = header(page("Photo"));
    const a = /<a\b[^>]*data-web-marca[^>]*>[\s\S]*?<\/a>/.exec(h)![0];
    assert.match(a, /href="https:\/\/www\.acme\.example\/es\/photo"/);
    assert.match(a, /Ver en la web de la marca/);
    assert.doesNotMatch(h, /<button|role="button"/);
    assert.match(a, /underline/);
    assert.doesNotMatch(a, /\bbg-|\bborder\b|rounded/);
  });

  test("bands in the HTML: dark first screen, then white («Versiones»), and no two neighbours alike", () => {
    const html = page("Photo");
    const classes = [...html.matchAll(/<(?:header|section|div)[^>]*class="[^"]*\b(band-(?:dark|white|light))\b[^"]*"/g)].map((m) => m[1]);
    assert.equal(classes[0], "band-dark");
    assert.equal(classes[1], "band-white");
    classes.forEach((c, i) => i > 0 && assert.notEqual(c, classes[i - 1]));
    const fuentes = /<section[^>]*data-fuentes[^>]*>/.exec(html)?.[0];
    if (fuentes) assert.match(fuentes, /band-light/);
  });
});
