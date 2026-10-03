import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { exploreGroups, pricePages, rangePages, segmentPages } from "../src/lib/catalog.ts";
import { normalize, type ModelRecord } from "../src/lib/data.ts";
import { sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");

interface Spec {
  segment?: string;
  /** One entry per version: [price, wltp_km]; null leaves the value out. */
  versions?: [number | null, number | null][];
  review?: boolean;
}

function doc(brand: string, model: string, spec: Spec = {}): Record<string, any> {
  return {
    brand,
    brand_name: brand.toUpperCase(),
    model,
    status: sourced("on_sale"),
    needs_review: spec.review === true,
    ...(spec.segment ? { segment: sourced(spec.segment) } : {}),
    versions: (spec.versions ?? []).map(([price, km], i) => ({
      name: `${model} ${i}`,
      ...(price !== null ? { price: sourced(price, { unit: "EUR", price_kind: "pvp" }) } : {}),
      ...(km !== null ? { wltp_km: sourced(km) } : {}),
    })),
  };
}

/** Edge fixtures: exact borders of RF-10 and a model per missing-data case. */
const EDGE: Record<string, Spec> = {
  p30000: { segment: "urbano", versions: [[30000, 350], [31000, 400]] }, // price edge, range from the 2nd version
  p30001: { segment: "suv_compacto", versions: [[30001, 399]] },
  p45000: { segment: "suv_compacto", versions: [[45000, 500]] },
  p45001: { segment: "suv_grande", versions: [[45001, 499]] },
  nodata: { versions: [] }, // no segment, price or range (RF-12)
  hidden: { segment: "berlina", review: true, versions: [[20000, 600]] }, // needs_review (RF-13)
};

const records = (): ModelRecord[] =>
  Object.entries(EDGE)
    .map(([m, spec]) => normalize(doc("acme", m, spec), `acme/${m}.yaml`))
    .filter((m) => !m.needs_review);
const names = (page: { models: ModelRecord[] }) => page.models.map((m) => m.model).sort();

describe("band pages: exact borders (RF-10)", () => {
  test("price: 30.000 is in the lower band, 45.000 in the middle one, 45.001 in the top one", () => {
    const [low, mid, high] = pricePages(records());
    assert.deepEqual(names(low), ["p30000"]);
    assert.deepEqual(names(mid), ["p30001", "p45000"]);
    assert.deepEqual(names(high), ["p45001"]);
  });

  test("range: >= 400 and >= 500 (399 and 499 stay out); the bands overlap; any version counts", () => {
    const [r400, r500] = rangePages(records());
    assert.deepEqual(names(r400), ["p30000", "p45000", "p45001"]);
    assert.ok(!names(r400).includes("p30001"), "399 km must not reach the 400 band");
    assert.deepEqual(names(r500), ["p45000"]);
    assert.ok(!names(r500).includes("p45001"), "499 km must not reach the 500 band");
    assert.ok(names(r500).every((n) => names(r400).includes(n)), "the 500 band is inside the 400 one");
  });

  test("RF-12 and RF-13: models without the value or under review are on no criterion page", () => {
    const all = [...pricePages(records()), ...rangePages(records()), ...segmentPages(records())];
    for (const p of all) assert.ok(!names(p).includes("nodata") && !names(p).includes("hidden"));
    assert.deepEqual(segmentPages(records()).map((s) => s.slug), ["suv-compacto", "suv-grande", "urbano"]);
  });

  test("bands are always returned, even with no models", () => {
    assert.equal(pricePages([]).length, 3);
    assert.equal(rangePages([]).length, 2);
    assert.deepEqual(segmentPages([]), []);
  });

  test("Explorar drops the Segmentos group when no segment page exists", () => {
    const labels = exploreGroups([], "/coches/").map((g) => g.label);
    assert.deepEqual(labels, ["Precio", "Autonomía"]);
  });
});

const text = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const h1 = (html: string) => text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1]);
const intro = (html: string) => text(/<p[^>]*data-intro[^>]*>([\s\S]*?)<\/p>/.exec(html)![1]);
const docTitle = (html: string) => /<title>([^<]*)<\/title>/.exec(html)![1];
const resultsOf = (html: string) => html.slice(html.indexOf('id="resultados"'));
const cardNames = (html: string) =>
  [...resultsOf(html).matchAll(/<h3[\s\S]*?>([^<]+)<\/a>/g)].map((m) => m[1].trim()).sort();

function build(root: string, models: Record<string, Spec>): string {
  const data = join(root, "data");
  for (const [m, spec] of Object.entries(models)) {
    mkdirSync(join(data, "acme"), { recursive: true });
    writeFileSync(join(data, "acme", `${m}.yaml`), stringify(doc("acme", m, spec)));
  }
  const out = join(root, "out");
  execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
    cwd: WEB,
    env: { ...process.env, CARS_DATA_DIR: data },
    stdio: "pipe",
  });
  return out;
}

const dirsWithPage = (out: string, section: string) =>
  existsSync(join(out, section))
    ? readdirSync(join(out, section), { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(join(out, section, d.name, "index.html")))
        .map((d) => d.name)
        .sort()
    : [];

describe("segment, price and range built pages", () => {
  let root: string;
  let out: string;
  const page = (section: string, slug: string) => readFileSync(join(out, section, slug, "index.html"), "utf8");
  const all = () =>
    ["marcas", "segmentos", "precio", "autonomia"].flatMap((s) =>
      dirsWithPage(out, s).map((slug) => ({ section: s, slug, html: page(s, slug) })),
    );

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-pages-"));
    out = build(root, EDGE);
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-12a: one page per segment with models and one per band (3 + 2), none for the rest", () => {
    assert.deepEqual(dirsWithPage(out, "segmentos"), ["suv-compacto", "suv-grande", "urbano"]);
    assert.equal(existsSync(join(out, "segmentos", "berlina")), false); // only a needs_review model
    assert.deepEqual(dirsWithPage(out, "precio"), [
      "de-30000-a-45000-euros",
      "hasta-30000-euros",
      "mas-de-45000-euros",
    ]);
    assert.deepEqual(dirsWithPage(out, "autonomia"), ["mas-de-400-km", "mas-de-500-km"]);
    assert.equal(all().length, 1 + 3 + 3 + 2); // brand + segments + price + range
  });

  test("CA-12c: served HTML holds exactly the cards of each criterion at the exact borders, with no script", () => {
    assert.deepEqual(cardNames(page("precio", "hasta-30000-euros")), ["p30000"]);
    assert.deepEqual(cardNames(page("precio", "de-30000-a-45000-euros")), ["p30001", "p45000"]);
    assert.deepEqual(cardNames(page("precio", "mas-de-45000-euros")), ["p45001"]);
    assert.deepEqual(cardNames(page("autonomia", "mas-de-400-km")), ["p30000", "p45000", "p45001"]);
    assert.deepEqual(cardNames(page("autonomia", "mas-de-500-km")), ["p45000"]);
    assert.deepEqual(cardNames(page("segmentos", "suv-compacto")), ["p30001", "p45000"]);
    for (const p of all()) {
      assert.doesNotMatch(p.html, /<script\b/i);
      assert.doesNotMatch(p.html, />hidden</); // RF-13: on no page
      // RF-12: a model without the value is on no criterion page (the brand page does list it)
      if (p.section !== "marcas") assert.doesNotMatch(p.html, />nodata</);
    }
    assert.match(page("precio", "de-30000-a-45000-euros"), /<p[^>]*data-count[^>]*>\s*2 modelos\s*<\/p>/);
    assert.match(page("precio", "mas-de-45000-euros"), /<p[^>]*data-count[^>]*>\s*1 modelo\s*<\/p>/);
  });

  test("CA-12b: h1, intro and title are different on every pregenerated page, and use the design texts", () => {
    const pages = all();
    for (const pick of [h1, intro, docTitle]) {
      assert.equal(new Set(pages.map((p) => pick(p.html))).size, pages.length);
    }
    assert.equal(h1(page("precio", "hasta-30000-euros")), "Coches eléctricos hasta 30.000 €");
    assert.equal(h1(page("segmentos", "suv-compacto")), "SUV compactos eléctricos");
    assert.equal(
      intro(page("autonomia", "mas-de-500-km")),
      "Modelos eléctricos con al menos una versión que llega a 500 km de autonomía WLTP o más. Es la cifra homologada WLTP, no la de uso real. Los modelos sin autonomía confirmada no aparecen aquí.",
    );
    assert.match(intro(page("segmentos", "urbano")), /Solo aparecen los modelos cuyo segmento está confirmado\.$/);
    assert.match(intro(page("precio", "hasta-30000-euros")), /Precio con oferta/);
  });

  test("Explorar: <nav> with its h2, links only to built pages, current page marked", () => {
    const html = page("segmentos", "suv-compacto");
    const nav = /<nav[^>]*aria-labelledby="explorar"[\s\S]*?<\/nav>/.exec(html)![0];
    assert.match(nav, /<h2 id="explorar"[^>]*>Explorar<\/h2>/);
    const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length >= 10);
    for (const href of hrefs) assert.ok(existsSync(join(out, href, "index.html")), `${href} is not built`);
    assert.equal([...nav.matchAll(/aria-current="page"/g)].length, 1);
    assert.match(nav, /<a[^>]*href="\/segmentos\/suv-compacto\/"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/segmentos\/suv-compacto\/"/);
    assert.ok(html.indexOf('id="explorar"') < html.indexOf('id="resultados"'), "Explorar goes before the results");
    assert.ok(!/href="\/segmentos\/berlina\//.test(nav));
    assert.doesNotMatch(readFileSync(join(out, "coches", "index.html"), "utf8").match(/<nav[\s\S]*?<\/nav>/)![0], /Todos los coches/);
  });
});

describe("band pages with no models", () => {
  let root: string;
  let out: string;
  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-empty-"));
    out = build(root, { nodata: EDGE.nodata });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-12a: the 5 band pages exist and show the empty state; no segment page; Segmentos left out of Explorar", () => {
    assert.deepEqual(dirsWithPage(out, "segmentos"), []);
    for (const [section, slugs] of [
      ["precio", ["hasta-30000-euros", "de-30000-a-45000-euros", "mas-de-45000-euros"]],
      ["autonomia", ["mas-de-400-km", "mas-de-500-km"]],
    ] as const) {
      for (const slug of slugs) {
        const html = readFileSync(join(out, section, slug, "index.html"), "utf8");
        assert.match(html, /<p[^>]*data-count[^>]*>\s*Ningún modelo\s*<\/p>/);
        assert.match(html, /Ahora mismo no hay ningún modelo en este tramo\./);
        assert.match(html, /<a[^>]*href="\/coches\/"[^>]*>\s*Ver todos los coches\s*<\/a>/);
        assert.doesNotMatch(html, /<h3[^>]*>Segmentos<\/h3>/);
        assert.match(html, /<h3[^>]*>Precio<\/h3>/);
      }
    }
  });
});
