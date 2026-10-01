import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { cardView, formatLaunch } from "../src/lib/card.ts";
import { normalize } from "../src/lib/data.ts";
import { acme, sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");

/** Writes `<dir>/<brand>/<model>.yaml` from a plain object. */
function writeModel(dir: string, brand: string, model: string, doc: Record<string, any>) {
  mkdirSync(join(dir, brand), { recursive: true });
  writeFileSync(join(dir, brand, `${model}.yaml`), stringify(doc));
}

const financedPrice = (value: number) => ({
  ...sourced(value),
  unit: "EUR",
  price_kind: "financed",
  price_terms: "Financiando.",
  price_terms_url: "https://www.acme.example/es/ofertas",
});

function fixtures(dir: string) {
  // On sale, full data, cheapest version is a PVP.
  writeModel(dir, "acme", "Volta", acme());
  // Announced, with expected date, no price, no range, no segment.
  writeModel(dir, "acme", "Soon", {
    brand: "acme",
    brand_name: "Acme",
    model: "Soon",
    status: sourced("announced"),
    launch: sourced("2026-10-15"),
    versions: [],
  });
  // Cheapest price is a financed one.
  writeModel(dir, "acme", "Deal", {
    brand: "acme",
    brand_name: "Acme",
    model: "Deal",
    status: sourced("on_sale"),
    segment: sourced("urbano"),
    versions: [{ name: "Deal 1", wltp_km: sourced(300), price: financedPrice(24990) }],
  });
}

describe("cardView (formatting of the derived model)", () => {
  const view = (patch: (doc: Record<string, any>) => void = () => {}) => {
    const doc = acme();
    patch(doc);
    return cardView(normalize(doc, "acme/volta.yaml"));
  };

  test("formats price, range and segment from the derived fields", () => {
    const v = view();
    assert.equal(v.priceLabel, "Desde 39.990 €");
    assert.equal(v.rangeLabel, "Hasta 520 km WLTP");
    assert.equal(v.segmentLabel, "SUV compacto");
    assert.equal(v.statusLabel, null);
    assert.equal(v.dealLabel, null);
  });

  test("groups four-digit prices too", () => {
    const v = view((d) => {
      d.versions = [{ name: "x", price: { ...d.versions[0].price, value: 4500 } }];
    });
    assert.equal(v.priceLabel, "Desde 4.500 €");
  });

  test("missing data gives the 'por confirmar' texts", () => {
    const v = view((d) => {
      d.versions = [];
      delete d.specs;
      delete d.segment;
    });
    assert.equal(v.priceLabel, "Precio por confirmar");
    assert.equal(v.rangeLabel, "Autonomía por confirmar");
    assert.equal(v.segmentLabel, "Segmento por confirmar");
    assert.equal(v.dealLabel, null);
  });

  test("announced shows month and year, or plain 'Próximamente' without launch", () => {
    assert.equal(formatLaunch("2026-10"), "oct 2026");
    assert.equal(formatLaunch("2026-10-15"), "oct 2026");
    assert.equal(formatLaunch("nope"), null);
    const withDate = view((d) => {
      d.status.value = "announced";
      d.launch.value = "2026-10";
    });
    assert.equal(withDate.statusLabel, "Próximamente · oct 2026");
    const noDate = view((d) => {
      d.status.value = "announced";
      delete d.launch;
    });
    assert.equal(noDate.statusLabel, "Próximamente");
  });

  test("discontinued has its own label, never together with 'Próximamente'", () => {
    const v = view((d) => (d.status.value = "discontinued"));
    assert.equal(v.statusLabel, "Descatalogado");
  });
});

describe("/coches built page", () => {
  let root: string;
  let html: string;
  /** The `<li>` of the card whose model is `name`. */
  const card = (name: string) => {
    const li = [...html.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]).find((s) => s.includes(`>${name}</a>`));
    assert.ok(li, `no card for ${name}`);
    return li;
  };
  const text = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-web-"));
    const data = join(root, "data");
    fixtures(data);
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", join(root, "out")], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
    html = readFileSync(join(root, "out/coches/index.html"), "utf8");
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("RNF-1: complete HTML without JavaScript", () => {
    assert.doesNotMatch(html, /<script\b/i);
    assert.match(html, /<h1[^>]*>Coches eléctricos<\/h1>/);
    assert.match(html, /<title>Coches eléctricos<\/title>/);
  });

  test("CA-1: one card per model with brand, model, price, range and segment, and no image", () => {
    assert.equal([...html.matchAll(/<li\b/g)].length, 3);
    const t = text(card("Volta"));
    assert.match(t, /Acme/);
    assert.match(t, /Volta/);
    assert.match(t, /Desde 39\.990\s€/);
    assert.match(t, /Hasta 520 km WLTP/);
    assert.match(t, /SUV compacto/);
    // RF-8 is blocked: no image and no empty image slot.
    assert.doesNotMatch(html, /<img\b|<picture\b|<svg\b|<video\b|background-image/i);
  });

  test("CA-1: a card with missing data still renders with 'por confirmar'", () => {
    const t = text(card("Soon"));
    assert.match(t, /Precio por confirmar/);
    assert.match(t, /Autonomía por confirmar/);
    assert.match(t, /Segmento por confirmar/);
  });

  test("CA-8 (first part): an announced model appears with the 'Próximamente' label and its date", () => {
    const t = text(card("Soon"));
    assert.match(t, /Próximamente · oct 2026/);
    assert.doesNotMatch(text(card("Volta")), /Próximamente/);
  });

  test("CA-11 (first part): a financed price carries the 'Precio con oferta' label", () => {
    assert.match(text(card("Deal")), /Desde 24\.990\s€/);
    assert.match(text(card("Deal")), /Precio con oferta/);
    // The cheapest Volta version is a PVP, so no label; and no label on a missing price.
    assert.doesNotMatch(text(card("Volta")), /Precio con oferta/);
    assert.doesNotMatch(text(card("Soon")), /Precio con oferta/);
  });

  test("each card links to /marcas/{brand}/{file name}/ (PRD-002, RF-1), all distinct", () => {
    const hrefs = ["Volta", "Soon", "Deal"].map((name) => /href="([^"]*)"/.exec(card(name))![1]);
    assert.deepEqual(hrefs, ["/marcas/acme/Volta/", "/marcas/acme/Soon/", "/marcas/acme/Deal/"]);
  });

  test("RNF-3: structure for assistive tech (one h1, results list named by its h2, one link per card)", () => {
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    assert.match(html, /<h2 id="resultados"[^>]*>Modelos<\/h2>/);
    assert.match(html, /<ul[^>]*aria-labelledby="resultados"/);
    assert.match(html, /<html lang="es"/);
    for (const name of ["Volta", "Soon", "Deal"]) {
      assert.equal([...card(name).matchAll(/<a\b/g)].length, 1);
      assert.match(card(name), /<h3\b/);
      assert.match(card(name), /<dl\b/);
    }
  });
});
