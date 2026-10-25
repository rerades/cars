import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { loadModels, loadSources, normalize, TEST_METRICS, type SourceRegistry, type TestMetrics } from "../src/lib/data.ts";
import { acme } from "./fixtures.ts";

/** PRD-006 RF-9 / CA-8 (data part), ADR-0017: #597. The metric is fictional and injected: the real list is empty. */

const METRICS: TestMetrics = { fake_range_km: (v) => typeof v === "number" && v > 0 };

const result = (extra: Record<string, unknown> = {}) => ({
  test: "Prueba ficticia de autonomía",
  metric: "fake_range_km",
  value: 412,
  source_id: "organismo-ejemplo",
  url: "https://www.organismo.example/pruebas/acme-volta",
  retrieved: "2026-09-20",
  tier: "T2",
  version: "Volta 80 AWD",
  ...extra,
});
const without = (key: string) => {
  const r: Record<string, unknown> = result();
  delete r[key];
  return r;
};
const source = (extra: Record<string, unknown> = {}) => ({
  id: "organismo-ejemplo",
  brand: "(varias; organismo de pruebas)",
  name: "Organismo Ejemplo",
  tier: "T2",
  market: "ES",
  kind: ["tests"],
  urls: { home: "https://www.organismo.example/" },
  terms_url: "https://www.organismo.example/aviso-legal",
  terms_checked: "2026-09-20",
  last_verified: "2026-09-20",
  ...extra,
});
function registryOf(doc: Record<string, unknown> | null): SourceRegistry {
  const dir = mkdtempSync(join(tmpdir(), "sources-"));
  if (doc) writeFileSync(join(dir, "organismo-ejemplo.yaml"), stringify(doc));
  return loadSources(dir);
}

const model = (list: unknown) => ({ ...acme(), test_results: list });
const norm = (list: unknown) => normalize(model(list), "acme/volta.yaml", undefined, null, METRICS);
const linked = (list: unknown, reg: SourceRegistry = registryOf(source())) =>
  normalize(model(list), "acme/volta.yaml", undefined, reg, METRICS);

test("#597: a valid result is kept as written, with and without version", () => {
  const m = norm([result(), without("version"), result({ note: "nota", test: "Otra" })]);
  assert.deepEqual(m.warnings, []);
  assert.equal(m.test_results.length, 3);
  assert.deepEqual(m.test_results[0], result());
  assert.equal("version" in m.test_results[1], false);
});

test("#597: test_results absent, null or [] give an empty list without warnings", () => {
  const a = normalize(acme(), "acme/volta.yaml");
  assert.deepEqual(a.test_results, []);
  assert.deepEqual(a.warnings, []);
  for (const v of [null, []]) {
    const m = norm(v);
    assert.deepEqual(m.test_results, []);
    assert.deepEqual(m.warnings, []);
  }
});

test("#597: test_results that is not a list is ignored with a warning", () => {
  const m = norm("nada");
  assert.deepEqual(m.test_results, []);
  assert.deepEqual(m.warnings, ["test_results: not a list"]);
});

for (const key of ["test", "metric", "value", "source_id", "url", "retrieved", "tier"]) {
  test(`#597: a result without ${key} is dropped with a warning, the valid one stays`, () => {
    const m = norm([without(key), result({ test: "Otra" })]);
    assert.deepEqual(m.test_results.map((r) => r.test), ["Otra"]);
    assert.equal(m.warnings.length, 1);
    assert.match(m.warnings[0], /test_results\[0\]: dropped/);
  });
}

test("#597: http url, tier T1 or T3, bad date, bad value and unknown version are dropped", () => {
  const m = norm([
    result({ url: "http://www.organismo.example/x" }),
    result({ tier: "T1" }),
    result({ tier: "T3" }),
    result({ retrieved: "ayer" }),
    result({ value: -3 }),
    result({ version: "Volta 99" }),
  ]);
  assert.deepEqual(m.test_results, []);
  assert.equal(m.warnings.length, 6);
});

for (const key of ["unit", "summary", "rating", "text"]) {
  test(`#597: unknown key ${key} drops the result`, () => {
    const m = norm([result({ [key]: "x" })]);
    assert.deepEqual(m.test_results, []);
    assert.match(m.warnings[0], new RegExp(`unknown key ${key}`));
  });
}

test("#597: a repeated (source, test, metric, version) is dropped", () => {
  const m = norm([result(), result({ value: 400 })]);
  assert.equal(m.test_results.length, 1);
  assert.match(m.warnings[0], /repeated/);
});

test("#597: the metric list is empty today, so any real test_results is dropped (no metric invented)", () => {
  assert.deepEqual(Object.keys(TEST_METRICS), []);
  const m = normalize(model([result()]), "acme/volta.yaml", undefined, null);
  assert.deepEqual(m.test_results, []);
  assert.match(m.warnings[0], /metric fake_range_km is not in the list/);
  // Inherited names are not metrics either.
  const p = normalize(model([result({ metric: "toString" })]), "acme/volta.yaml", undefined, null, METRICS);
  assert.deepEqual(p.test_results, []);
});

test("#597: with a registry, the source name and terms are checked like for reviews", () => {
  assert.equal(linked([result()]).test_results.length, 1);
  const cases: [string, SourceRegistry, RegExp][] = [
    ["missing", registryOf(null), /not in data\/sources/],
    ["kind", registryOf(source({ kind: ["reviews"] })), /kind tests/],
    ["tier", registryOf(source({ tier: "T3" })), /tier/],
    ["terms", registryOf(source({ terms_checked: undefined })), /terms/],
    ["name", registryOf(source({ name: undefined })), /no name/],
  ];
  for (const [name, reg, re] of cases) {
    const m = linked([result()], reg);
    assert.deepEqual(m.test_results, [], name);
    assert.match(m.warnings[0], re, name);
  }
  const off = linked([result({ url: "https://otro.example/x" })]);
  assert.deepEqual(off.test_results, []);
  assert.match(off.warnings[0], /domain/);
});

test("#597 CA-8 (data): every kept result carries source_id, url, retrieved and tier", () => {
  const kept = linked([result(), without("version")]).test_results;
  assert.equal(kept.length, 2);
  for (const r of kept) {
    for (const k of ["source_id", "url", "retrieved", "tier"] as const) assert.ok(r[k], k);
    assert.equal(r.tier, "T2");
  }
});

test("#597: the real data/ loads with an empty test_results everywhere", () => {
  const { models, errors } = loadModels();
  assert.deepEqual(errors, []);
  for (const m of models) assert.deepEqual(m.test_results, [], m.file);
});
