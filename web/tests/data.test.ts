import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadModels } from "../src/lib/data.ts";

const real = resolve(import.meta.dirname, "../../data/raw");

test("reads every real YAML with no errors", () => {
  const { models, errors } = loadModels(real);
  assert.deepEqual(errors, []);
  assert.ok(models.length > 0);
});

test("default data dir resolves from the module, not from cwd", async () => {
  const { DEFAULT_DATA_DIR } = await import("../src/lib/data.ts");
  assert.equal(DEFAULT_DATA_DIR, real);
  const cwd = process.cwd();
  process.chdir(tmpdir());
  try {
    assert.ok(loadModels().models.length > 0);
  } finally {
    process.chdir(cwd);
  }
});

function load(yaml: string) {
  const dir = mkdtempSync(join(tmpdir(), "data-"));
  mkdirSync(join(dir, "x"));
  writeFileSync(join(dir, "x", "m.yaml"), yaml);
  return loadModels(dir);
}
/** Source fields as YAML lines, indented `i` spaces after the first one. */
const src = (i: number) => ["source_id: s", "url: https://e.x", "retrieved: '2026-01-01'"].join("\n" + " ".repeat(i)) + "\n";

test("missing directory does not throw and is reported", () => {
  const r = loadModels(join(tmpdir(), "does-not-exist-" + Date.now()));
  assert.deepEqual(r.models, []);
  assert.equal(r.errors.length, 1);
});

test("empty YAML is reported as an error", () => {
  const r = load("");
  assert.deepEqual(r.models, []);
  assert.deepEqual(r.errors.map((e) => e.file), ["x/m.yaml"]);
});

test("versions as text is ignored with a warning", () => {
  const r = load("brand: A\nmodel: B\nversions: hello\n");
  assert.deepEqual(r.models[0].versions, []);
  assert.equal(r.models[0].warnings.length, 1);
});

test("price without retrieved is dropped, flagged invalid, and warned", () => {
  const r = load(
    `brand: A\nmodel: B\nversions:\n  - name: V\n    price:\n      value: 10\n      price_kind: pvp\n      source_id: s\n      url: https://e.x\n`,
  );
  const v = r.models[0].versions[0];
  assert.equal(v.price, null);
  assert.equal(v.price_issue, "invalid price");
  assert.equal(r.models[0].warnings.length, 1);
});

test("price without url, with non-numeric value or bad price_kind is invalid", () => {
  const bad = [
    `value: 10\n      price_kind: pvp\n      source_id: s\n      retrieved: '2026-01-01'\n`,
    `value: cheap\n      price_kind: pvp\n      ${src(6)}`,
    `value: 10\n      price_kind: lease\n      ${src(6)}`,
    `value: 10\n      ${src(6)}`,
  ];
  for (const p of bad) {
    const v = load(`brand: A\nmodel: B\nversions:\n  - name: V\n    price:\n      ${p}`).models[0].versions[0];
    assert.equal(v.price, null, p);
    assert.equal(v.price_issue, "invalid price", p);
  }
});

test("a model without price is not an invalid price", () => {
  const v = load("brand: A\nmodel: B\nversions:\n  - name: V\n").models[0];
  assert.equal(v.versions[0].price, null);
  assert.equal(v.versions[0].price_issue, null);
  assert.deepEqual(v.warnings, []);
});

test("valid price passes through", () => {
  const v = load(
    `brand: A\nmodel: B\nversions:\n  - name: V\n    price:\n      value: 10\n      price_kind: pvp\n      ${src(6)}`,
  ).models[0].versions[0];
  assert.equal(v.price?.value, 10);
  assert.equal(v.price_issue, null);
});

test("specs without url or date are dropped with a warning", () => {
  const m = load(
    `brand: A\nmodel: B\nspecs:\n  ok:\n    value: 1\n    ${src(4)}  bad:\n    value: 2\n    source_id: s\n`,
  ).models[0];
  assert.deepEqual(Object.keys(m.specs), ["ok"]);
  assert.equal(m.warnings.length, 1);
});

test("keeps source and date on prices, in both YAML shapes", () => {
  const { models } = loadModels(real);
  const priced = models.flatMap((m) => m.versions).filter((v) => v.price);
  assert.ok(priced.length > 0);
  for (const { price: p } of priced) {
    assert.ok(p!.source_id);
    assert.match(p!.retrieved, /^\d{4}-\d{2}-\d{2}$/); // string, not a Date
    assert.match(p!.url, /^https:\/\//);
  }
  // both shapes: Cupra (model_level) and Polestar (specs)
  assert.ok([...new Set(priced.map((v) => v.price!.source_id))].length >= 2);
});

test("normalizes status and merges model-level specs with their sources", () => {
  const { models } = loadModels(real);
  for (const m of models) {
    assert.equal(typeof m.status.value, "string");
    if (m.status.source) assert.ok(m.status.source.retrieved && m.status.source.url);
    for (const s of Object.values(m.specs)) assert.ok(s.source_id && s.url && s.retrieved);
  }
  assert.ok(models.some((m) => m.status.source), "a sourced status");
  assert.ok(models.some((m) => !m.status.source), "a bare-string status");
  assert.ok(models.some((m) => Object.keys(m.specs).length > 0));
});

test("survives broken files and reports them", () => {
  const dir = mkdtempSync(join(tmpdir(), "data-"));
  mkdirSync(join(dir, "x"));
  writeFileSync(join(dir, "x", "ok.yaml"), "brand: A\nmodel: B\n");
  writeFileSync(join(dir, "x", "nobrand.yaml"), "model: B\n");
  writeFileSync(join(dir, "x", "bad.yaml"), "a: [unclosed\n");
  const { models, errors } = loadModels(dir);
  assert.equal(models.length, 1);
  assert.deepEqual(models[0].versions, []);
  assert.equal(models[0].status.value, "unknown");
  assert.deepEqual(errors.map((e) => e.file).sort(), ["x/bad.yaml", "x/nobrand.yaml"]);
});
