import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { normalize } from "../src/lib/data.ts";
import { summarize } from "../src/lib/derived.ts";
import {
  NO_FILTERS,
  factAttrs,
  filterBySearch,
  parseFilters,
  readFacts,
  toSearch,
} from "../src/lib/filter.ts";
import { acme, sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");

const doc = (model: string, patch: (d: Record<string, any>) => void = () => {}) => {
  const d = acme();
  d.model = model;
  patch(d);
  return d;
};

/** A small catalog (docs plain objects, written to disk for the build test too). */
function catalog(): Record<string, any>[] {
  return [
    // On sale, SUV compacto, awd+rwd, up to 520 km, from 39.990 €.
    doc("Volta"),
    // Announced: no price, range, segment or drivetrain.
    {
      brand: "acme", brand_name: "Acme", model: "Soon", status: sourced("announced"),
      launch: sourced("2026-10-15"), versions: [],
    },
    // Discontinued, urban, 300 km, fwd, 14.990 €.
    {
      brand: "acme", brand_name: "Acme", model: "Old", status: sourced("discontinued"), segment: sourced("urbano"),
      versions: [{
        name: "Old 1", wltp_km: sourced(300), drivetrain: sourced("fwd"),
        price: { ...sourced(14990), unit: "EUR", price_kind: "pvp" },
      }],
    },
    // On sale, other brand, no segment, no range, no drivetrain, 29.990 €.
    {
      brand: "zeta", brand_name: "Zeta", model: "Plain", status: sourced("on_sale"),
      versions: [{ name: "Plain 1", price: { ...sourced(29990), unit: "EUR", price_kind: "pvp" } }],
    },
  ];
}

const models = catalog().map((d) => summarize(normalize(d, `${d.brand}/${d.model}.yaml`)));
const names = (search: string) => filterBySearch(models, search).map((m) => m.model);

describe("filters over the derived model", () => {
  test("no filters: every model", () => {
    assert.deepEqual(names(""), ["Volta", "Soon", "Old", "Plain"]);
  });

  test("CA-2: 'autonomía ≥ 400 km' keeps only models with a version of 400 km or more", () => {
    assert.deepEqual(names("?autonomia=400"), ["Volta"]);
    assert.deepEqual(names("?autonomia=300"), ["Volta", "Old"]);
  });

  test("RF-2: brand, segment, price range and drivetrain combine (AND between filters, OR inside one)", () => {
    assert.deepEqual(names("?marca=zeta"), ["Plain"]);
    assert.deepEqual(names("?marca=zeta,acme&estado=venta"), ["Volta", "Plain"]);
    assert.deepEqual(names("?segmento=urbano,suv_compacto"), ["Volta", "Old"]);
    assert.deepEqual(names("?precio_min=20000&precio_max=35000"), ["Plain"]);
    assert.deepEqual(names("?traccion=total,delantera"), ["Volta", "Old"]);
    assert.deepEqual(names("?segmento=suv_compacto&autonomia=400&traccion=total"), ["Volta"]);
  });

  test("CA-8 (second part): with 'a la venta' the announced model does not appear", () => {
    assert.ok(!names("?estado=venta").includes("Soon"));
    assert.deepEqual(names("?estado=proximamente"), ["Soon"]);
  });

  test("CA-14 (second part): with 'a la venta' a discontinued model does not appear", () => {
    assert.ok(!names("?estado=venta").includes("Old"));
    assert.deepEqual(names("?estado=descatalogado"), ["Old"]);
  });

  test("CA-15 (second part) / RF-12: a model missing the filtered datum does not appear", () => {
    assert.ok(!names("?autonomia=300").includes("Plain"), "no range");
    assert.ok(!names("?autonomia=300").includes("Soon"));
    assert.ok(!names("?segmento=suv_compacto,urbano").includes("Plain"), "no segment");
    assert.ok(!names("?segmento=suv_compacto,urbano").includes("Soon"));
    assert.ok(!names("?traccion=total,trasera,delantera").includes("Plain"), "no drivetrain");
    assert.ok(!names("?traccion=total,trasera,delantera").includes("Soon"));
    assert.ok(!names("?precio_min=1").includes("Soon"), "no price");
    // The same models are there when the field is not filtered.
    assert.ok(names("").includes("Plain") && names("").includes("Soon"));
  });

  test("RF-6 / CA-6: filters without results give an empty list", () => {
    assert.deepEqual(names("?marca=zeta&estado=descatalogado"), []);
  });

  test("CA-5 / CA-13 (results): the same URL gives the same results, and the state survives a round trip", () => {
    const url = "?marca=acme&segmento=suv_compacto&precio_min=30000&autonomia=400&traccion=total&estado=venta";
    assert.deepEqual(names(url), ["Volta"]);
    assert.equal(toSearch(parseFilters(url)), url);
    assert.deepEqual(names(toSearch(parseFilters(url))), names(url));
    assert.equal(toSearch(NO_FILTERS), "");
  });

  test("invalid URL values are ignored, never an error", () => {
    assert.deepEqual(parseFilters("?autonomia=abc&estado=xx&segmento=nope&precio_min=-5&traccion=raro"), NO_FILTERS);
    assert.deepEqual(names("?autonomia=abc"), ["Volta", "Soon", "Old", "Plain"]);
  });

  test("'Desde' greater than 'Hasta' is not applied", () => {
    assert.deepEqual(names("?precio_min=50000&precio_max=10000"), ["Volta", "Soon", "Old", "Plain"]);
  });

  test("the data attributes written on the cards read back to the same model", () => {
    for (const m of models) {
      const a = factAttrs(m);
      const back = readFacts((n) => a[n] ?? null);
      assert.deepEqual(
        filterBySearch([back], "?autonomia=400&segmento=suv_compacto").length,
        filterBySearch([m], "?autonomia=400&segmento=suv_compacto").length,
      );
      assert.equal(back.status, m.status);
      assert.equal(back.maxRangeKm, m.maxRangeKm);
      assert.equal(back.priceFrom?.value ?? null, m.priceFrom?.value ?? null);
    }
  });
});

describe("/coches filter panel in the built page", () => {
  let root: string;
  let html: string;
  let js: string;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-web-filters-"));
    const data = join(root, "data");
    for (const d of catalog()) {
      mkdirSync(join(data, d.brand), { recursive: true });
      writeFileSync(join(data, d.brand, `${d.model}.yaml`), stringify(d));
    }
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", join(root, "out")], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
    html = readFileSync(join(root, "out/coches/index.html"), "utf8");
    const dir = join(root, "out/_astro");
    js = readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("RNF-1: the HTML carries every card, unfiltered, and the panel is hidden until JS shows it", () => {
    assert.equal([...html.matchAll(/<li\b[^>]*data-model/g)].length, 4);
    assert.doesNotMatch(html, /<li\b[^>]*\bhidden\b/);
    assert.match(html, /<div[^>]*data-filters-root[^>]*\shidden/);
    assert.match(html, /Para filtrar el catálogo hace falta activar JavaScript/);
    assert.match(html, /<script\b[^>]*type="module"/);
  });

  test("the cards carry the facts the browser filters on", () => {
    const old = [...html.matchAll(/<li\b[^>]*>/g)].map((m) => m[0]).find((s) => s.includes('data-status="discontinued"'));
    assert.ok(old);
    assert.match(old, /data-segment="urbano"/);
    assert.match(old, /data-range="300"/);
    assert.match(old, /data-drivetrains="fwd"/);
    assert.match(old, /data-price="14990"/);
  });

  test("the panel offers the six filters, the ten-name segment labels, and the three states plus 'Todos'", () => {
    for (const name of ["marca", "segmento", "precio_min", "precio_max", "autonomia", "traccion", "estado"]) {
      assert.match(html, new RegExp(`name="${name}"`));
    }
    assert.match(html, /Acme \(3\)/);
    assert.match(html, /Zeta \(1\)/);
    assert.match(html, /SUV compacto \(1\)/);
    for (const label of ["Todos", "A la venta", "Próximamente", "Descatalogado"]) {
      assert.match(html, new RegExp(`<span>${label}</span>`));
    }
  });

  test("CA-6: the empty state has a message and a button to clear the filters, hidden until needed", () => {
    assert.match(html, /<div[^>]*data-empty[^>]*\shidden[\s\S]*Ningún modelo cumple los filtros[\s\S]*Limpiar filtros/);
    assert.match(html, /<button[^>]*data-empty-clear/);
  });

  test("CA-13: canonical to /coches without query string, no cookies or storage", () => {
    assert.match(html, /<link rel="canonical" href="\/coches"/);
    assert.doesNotMatch(js + html, /localStorage|sessionStorage|document\.cookie/);
  });

  test("RF-5: the shipped script reads the URL and rewrites it without a new history entry", () => {
    assert.match(js, /location\.search/);
    assert.match(js, /replaceState/);
    assert.doesNotMatch(js, /pushState/);
  });
});
