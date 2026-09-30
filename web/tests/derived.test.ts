import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "../src/lib/data.ts";
import { summarize } from "../src/lib/derived.ts";
import { acme } from "./fixtures.ts";

// Fixtures only (data-model.md example); the real YAML in data/ is not used.
const sum = (raw: unknown) => summarize(normalize(raw, "acme/volta.yaml"));

test("CA-1 price from and max range come from the versions (Spain market)", () => {
  const s = sum(acme());
  assert.equal(s.priceFrom?.value, 39990);
  assert.equal(s.priceFrom?.kind, "pvp");
  assert.equal(s.priceFrom?.financed, false);
  assert.equal(s.priceFrom?.terms, null);
  assert.equal(s.maxRangeKm, 520);
  assert.deepEqual(s.drivetrains, ["rwd", "awd"]);
  assert.equal(s.segment, "suv_compacto");
});

test("CA-2 an announced model without price is 'price to confirm'", () => {
  const raw = acme();
  raw.status.value = "announced";
  for (const v of raw.versions) v.price = null;
  const s = sum(raw);
  assert.equal(s.status, "announced");
  assert.equal(s.priceFrom, null);
  assert.equal(s.priceToConfirm, true);
  assert.equal(s.launch, "2025-03");
});

test("CA-2 a model with a price is not 'price to confirm'", () => {
  assert.equal(sum(acme()).priceToConfirm, false);
});

test("CA-3 a financed price is flagged as offer with its terms (RF-9)", () => {
  const raw = acme();
  raw.versions[0].price = null; // the financed price becomes the minimum
  const s = sum(raw);
  assert.equal(s.priceFrom?.value, 47500);
  assert.equal(s.priceFrom?.kind, "financed");
  assert.equal(s.priceFrom?.financed, true);
  assert.match(s.priceFrom?.terms ?? "", /permanencia de 48 meses/);
  assert.equal(s.priceFrom?.termsUrl, "https://www.acme.example/es/volta/ofertas");
});

test("summary carries status and launch; missing launch or segment give null", () => {
  const raw = acme();
  delete raw.launch;
  delete raw.segment;
  const s = sum(raw);
  assert.equal(s.status, "on_sale");
  assert.equal(s.launch, null);
  assert.equal(s.segment, null);
});
