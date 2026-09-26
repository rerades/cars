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
  assert.equal(models.length, 6);
  assert.deepEqual(
    models.map((m) => m.model),
    ["Born", "Raval", "Tavascan", "Polestar 2", "Polestar 3", "Polestar 4"],
  );
});

test("keeps source and date on prices, in both YAML shapes", () => {
  const { models } = loadModels(real);
  const born = models.find((m) => m.model === "Born")!;
  const p = born.versions[0].price!;
  assert.equal(p.value, 35655.59);
  assert.equal(p.price_kind, "financed");
  assert.equal(p.source_id, "cupra-es");
  assert.equal(p.retrieved, "2026-09-24"); // string, not a Date
  assert.match(p.url, /^https:\/\//);
  assert.equal(born.versions[1].price, null);

  const ps2 = models.find((m) => m.model === "Polestar 2")!;
  assert.equal(ps2.versions[0].price!.source_id, "polestar-es");
});

test("normalizes status and merges model-level specs with their sources", () => {
  const { models } = loadModels(real);
  const born = models.find((m) => m.model === "Born")!;
  assert.equal(born.status.value, "on_sale");
  assert.equal(born.status.source?.retrieved, "2026-09-24");
  assert.equal(born.specs.wltp_max_km.value, 631);
  const ps2 = models.find((m) => m.model === "Polestar 2")!;
  assert.equal(ps2.status.value, "on_sale");
  assert.equal(ps2.status.source, undefined);
  assert.equal(ps2.specs.wltp_range_max.unit, "km");
  assert.equal(ps2.specs.wltp_range_max.source_id, "polestar-es");
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
