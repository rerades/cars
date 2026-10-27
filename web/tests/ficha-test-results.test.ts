import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { formatMetricValue, metricLabel, publishableResults } from "../src/lib/test-results.ts";
import { sourced } from "./fixtures.ts";

/**
 * PRD-006 RF-9, RF-1, RF-2, RNF-4; CA-8, CA-1, CA-2 (#601). No real metric exists yet, so the build runs
 * with a fictional one injected through CARS_TEST_METRICS_FIXTURE (label per metric).
 */
const WEB = join(import.meta.dirname, "..");
const URL_A = "https://www.organismo.example/pruebas/acme-volta";

const result = (extra: Record<string, unknown> = {}) => ({
  test: "Prueba ficticia de autonomía (protocolo X)",
  metric: "fake_range_km",
  value: 412.5,
  source_id: "organismo-ejemplo",
  url: URL_A,
  retrieved: "2026-09-20",
  tier: "T2",
  ...extra,
});
const review = {
  title: "Acme: primera prueba",
  url: "https://www.motor.example/pruebas/acme",
  source_id: "motorejemplo-es",
  retrieved: "2026-09-21",
  tier: "T3",
};

describe("«Resultados de pruebas» in the Reviews block (#601)", () => {
  let root: string;
  let out: string;
  const page = (m: string) => readFileSync(join(out, "marcas", "acme", m, "index.html"), "utf8");
  const section = (m: string) => /<section[^>]*data-reviews[\s\S]*?<\/section>/.exec(page(m))![0];
  const write = (model: string, extra: Record<string, unknown>) => {
    mkdirSync(join(root, "data", "acme"), { recursive: true });
    writeFileSync(
      join(root, "data", "acme", `${model}.yaml`),
      stringify({
        brand: "acme",
        brand_name: "Acme",
        model,
        status: sourced("on_sale", { url: "https://www.acme.example/status" }),
        versions: [{ name: "Volta 80 AWD" }],
        ...extra,
      }),
    );
  };

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-pruebas-"));
    mkdirSync(join(root, "sources"), { recursive: true });
    const src = (id: string, name: string, kind: string, tier: string, host: string) =>
      writeFileSync(
        join(root, "sources", `${id}.yaml`),
        stringify({
          id,
          brand: "varias",
          name,
          tier,
          market: "ES",
          kind: [kind],
          urls: { home: `https://www.${host}/` },
          terms_url: `https://www.${host}/aviso-legal`,
          terms_checked: "2026-09-20",
        }),
      );
    src("organismo-ejemplo", "Organismo Ejemplo", "tests", "T2", "organismo.example");
    src("motorejemplo-es", "Motor Ejemplo", "reviews", "T3", "motor.example");
    writeFileSync(join(root, "metrics.json"), JSON.stringify({ fake_range_km: "Autonomía ficticia" }));

    write("Solo", { test_results: [result({ version: "Volta 80 AWD", note: "Nota literal del organismo." }), result({ test: "Otra prueba", value: 1234.5 })] });
    write("Both", { test_results: [result()], reviews: [review] });
    write("Unknown", { test_results: [result({ metric: "invented_metric_km" })] });
    write("NoSource", { test_results: [result({ source_id: "missing-source" })] });
    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: {
        ...process.env,
        CARS_DATA_DIR: join(root, "data"),
        CARS_SOURCES_DIR: join(root, "sources"),
        CARS_TEST_METRICS_FIXTURE: join(root, "metrics.json"),
      },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("only results: h2, entry line, ul role=list, one li per result, no h3 and no media sublist", () => {
    const s = section("Solo");
    assert.doesNotMatch(s, /<h3/);
    assert.match(s, /Resultados publicados por organismos de pruebas independientes/);
    assert.doesNotMatch(s, /Enlaces a pruebas de este modelo/);
    assert.match(s, /<ul role="list"/);
    assert.equal((s.match(/<li/g) ?? []).length, 2);
    assert.doesNotMatch(s, /id="reviews-pruebas"|id="reviews-medios"/);
  });

  test("CA-1, CA-8: each result has dl with label and value, test literal, organism link to the exact url, date", () => {
    const [first, second] = [...section("Solo").matchAll(/<li[\s\S]*?<\/li>/g)].map((m) => m[0]);
    assert.match(first, /<dl[^>]*><dt>Autonomía ficticia:<\/dt><dd[^>]*>\s*412,5 km/);
    assert.match(first, /Prueba ficticia de autonomía \(protocolo X\)/);
    assert.match(first, new RegExp(`Fuente: <a href="${URL_A.replace(/[.]/g, "\\.")}"[^>]*>\\s*Organismo Ejemplo`));
    assert.match(first, /<time datetime="2026-09-20">20 sep 2026<\/time>/);
    assert.match(first, /\(resultado de Prueba ficticia de autonomía \(protocolo X\) para Acme Solo, en otra web\)/);
    assert.equal((first.match(/<a /g) ?? []).length, 1);
    assert.match(second, /1\.234,5 km/);
  });

  test("version and note only when the result has them; no «fuente no oficial»", () => {
    const [first, second] = [...section("Solo").matchAll(/<li[\s\S]*?<\/li>/g)].map((m) => m[0]);
    assert.match(first, /Sobre la versión Volta 80 AWD/);
    assert.match(first, /Nota literal del organismo\./);
    assert.doesNotMatch(second, /Sobre la versión|Nota literal/);
    assert.doesNotMatch(section("Solo"), /no oficial/i);
  });

  test("a metric without label is not drawn, and its identifier never appears", () => {
    for (const m of ["Unknown", "NoSource"]) assert.doesNotMatch(page(m), /data-reviews[ >]/, m);
    for (const m of ["Solo", "Both", "Unknown"]) assert.doesNotMatch(page(m), /fake_range_km|invented_metric_km/, m);
  });

  test("both sublists: h3 for each, results first, ids set, results before media", () => {
    const s = section("Both");
    const h3 = [...s.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
    assert.deepEqual(h3, ["Resultados de pruebas", "Reviews de medios"]);
    assert.ok(s.indexOf('id="reviews-pruebas"') < s.indexOf('id="reviews-medios"'));
    assert.ok(s.indexOf("data-reviews-pruebas") < s.indexOf("data-reviews-medios"));
    assert.ok(s.indexOf("Resultados publicados") < s.indexOf("Enlaces a pruebas"));
    assert.ok(s.indexOf("412,5 km") < s.indexOf("Acme: primera prueba"));
  });

  test("CA-2: every number shown comes from data with source, url, retrieved and tier (no value without link and date)", () => {
    for (const li of section("Solo").matchAll(/<li[\s\S]*?<\/li>/g)) {
      assert.match(li[0], /<a href="https:\/\//);
      assert.match(li[0], /<time datetime="\d{4}-\d{2}-\d{2}">/);
    }
  });
});

describe("test-results helpers (#601)", () => {
  const base = { test: "T", source_id: "s", url: "https://x.example/", retrieved: "2026-09-20", tier: "T2" as const };

  test("value keeps its decimals, es-ES separators and the unit of the metric suffix", () => {
    assert.equal(formatMetricValue("a_range_km", 412), "412 km");
    assert.equal(formatMetricValue("a_range_km", 1234.5), "1.234,5 km");
    assert.equal(formatMetricValue("a_energy_kwh", 77.50), "77,5 kWh");
    assert.equal(formatMetricValue("a_power_kw", 150.25), "150,25 kW");
    assert.equal(formatMetricValue("a_score", 7), "7");
  });

  test("no label is defined today and none is invented", () => {
    assert.equal(metricLabel("anything_km"), null);
  });

  test("results with unknown label, non-numeric value or no organism name are dropped", () => {
    const r = { ...base, metric: "anything_km", value: 400, organism: "Org" };
    assert.deepEqual(publishableResults([r]), []);
  });
});
