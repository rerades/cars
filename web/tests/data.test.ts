import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DEFAULT_DATA_DIR, loadModels, normalize } from "../src/lib/data.ts";
import { ACME_YAML, acme, sourced } from "./fixtures.ts";

// Fixtures follow the example in docs/architecture/data-model.md; the real YAML in data/ is not used.

const norm = (raw: unknown) => normalize(raw, "acme/volta.yaml");

function loadFiles(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "data-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path.split("/")[0]), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return loadModels(dir);
}

// --- loading ---------------------------------------------------------------------------------

test("default data dir resolves from the module, not from cwd", () => {
  assert.equal(DEFAULT_DATA_DIR, resolve(import.meta.dirname, "../../data/raw"));
});

test("the example of data-model.md loads with no errors and no warnings", () => {
  const r = loadFiles({ "acme/volta.yaml": ACME_YAML });
  assert.deepEqual(r.errors, []);
  assert.equal(r.models.length, 1);
  assert.deepEqual(r.models[0].warnings, []);
  assert.equal(r.models[0].file, "acme/volta.yaml");
});

test("CA-18: a model with needs_review: true is not loaded, so no page shows or counts it", () => {
  const held = ACME_YAML.replace("needs_review: false", "needs_review: true");
  const r = loadFiles({ "acme/volta.yaml": ACME_YAML, "acme/held.yaml": held.replace("model: Volta", "model: Held") });
  assert.deepEqual(r.models.map((m) => m.model), ["Volta"]);
  assert.deepEqual(r.errors, []);
});

test("missing directory does not throw and is reported", () => {
  const r = loadModels(join(tmpdir(), "does-not-exist-" + Date.now()));
  assert.deepEqual(r.models, []);
  assert.equal(r.errors.length, 1);
});

test("empty YAML is reported as an error", () => {
  const r = loadFiles({ "x/m.yaml": "" });
  assert.deepEqual(r.models, []);
  assert.deepEqual(r.errors.map((e) => e.file), ["x/m.yaml"]);
});

test("survives broken files and reports them; the rest still loads", () => {
  const r = loadFiles({
    "acme/volta.yaml": ACME_YAML,
    "acme/nobrand.yaml": "model: B\n",
    "acme/bad.yaml": "a: [unclosed\n",
  });
  assert.deepEqual(r.models.map((m) => m.model), ["Volta"]);
  assert.deepEqual(r.errors.map((e) => e.file).sort(), ["acme/bad.yaml", "acme/nobrand.yaml"]);
});

test("models are sorted by brand and then model", () => {
  const b = ACME_YAML.replace("model: Volta", "model: Alfa");
  const r = loadFiles({ "acme/volta.yaml": ACME_YAML, "acme/alfa.yaml": b });
  assert.deepEqual(r.models.map((m) => m.model), ["Alfa", "Volta"]);
});

// --- model level: required keys, one shape only -----------------------------------------------

test("brand, brand_name, model and status are carried to the normalized model", () => {
  const m = norm(acme());
  assert.equal(m.brand, "acme");
  assert.equal(m.brand_name, "Acme");
  assert.equal(m.model, "Volta");
  assert.equal(m.status.value, "on_sale");
  assert.equal(m.status.source_id, "acme-es");
  assert.equal(m.needs_review, false);
  assert.deepEqual(m.open_questions, ["Volta GT: potencia y batería no publicadas en la ficha."]);
});

test("a file without brand_name is an error, with no fallback to brand", () => {
  const raw = acme();
  delete raw.brand_name;
  assert.throws(() => norm(raw), /brand_name/);
});

test("status must be Sourced: a bare string is an error, not 'unknown'", () => {
  const raw = acme();
  raw.status = "on_sale";
  assert.throws(() => norm(raw), /status/);
});

test("status without source, or with a value outside the list, is an error", () => {
  for (const status of [{ value: "on_sale" }, sourced("for_sale"), null]) {
    const raw = acme();
    raw.status = status;
    assert.throws(() => norm(raw), /status/, JSON.stringify(status));
  }
});

test("the old `model_level` block is not read: it does not become specs", () => {
  const raw = acme();
  delete raw.specs;
  raw.model_level = { wltp_max_km: sourced(999) };
  const m = norm(raw);
  assert.deepEqual(m.specs, {});
  assert.equal(m.max_range_km?.value, 520); // from the versions only
});

test("launch keeps its source; an invalid date is dropped with a warning", () => {
  const m = norm(acme());
  assert.equal(m.launch?.value, "2025-03");
  assert.equal(m.launch?.note, "inicio de venta en España");
  const raw = acme();
  raw.launch = sourced("March 2025");
  const bad = norm(raw);
  assert.equal(bad.launch, null);
  assert.equal(bad.warnings.length, 1);
  delete raw.launch;
  assert.equal(norm(raw).launch, null);
});

test("segment is optional: absent is null without warning; invalid is dropped with warning", () => {
  const raw = acme();
  delete raw.segment;
  const none = norm(raw);
  assert.equal(none.segment, null);
  assert.deepEqual(none.warnings, []);
  raw.segment = sourced("crossover");
  const bad = norm(raw);
  assert.equal(bad.segment, null);
  assert.equal(bad.warnings.length, 1);
  raw.segment = null;
  assert.equal(norm(raw).segment, null);
});

// --- images -------------------------------------------------------------------------------------

const image = (extra: Record<string, unknown> = {}) => ({
  url: "https://commons.example/volta.jpg",
  source_id: "wikimedia-commons",
  retrieved: "2026-09-20",
  license: "CC-BY-SA-4.0",
  attribution: "Photo: A. Author",
  ...extra,
});

test("images keep license and attribution", () => {
  const raw = acme();
  raw.images = [image()];
  const m = norm(raw);
  assert.deepEqual(m.images, [image()]);
  assert.deepEqual(m.warnings, []);
});

test("an image without attribution gets attribution null", () => {
  const raw = acme();
  raw.images = [image({ attribution: null }), (() => { const i = image(); delete (i as any).attribution; return i; })()];
  assert.deepEqual(norm(raw).images.map((i) => i.attribution), [null, null]);
});

test("an image without license is not published (CA-10)", () => {
  const raw = acme();
  const noLicense = image();
  delete (noLicense as any).license;
  raw.images = [noLicense, image({ license: "  " }), image({ url: "https://commons.example/ok.jpg" })];
  const m = norm(raw);
  assert.deepEqual(m.images.map((i) => i.url), ["https://commons.example/ok.jpg"]);
  assert.equal(m.warnings.length, 2);
});

test("images: [] and a missing images key both give no images", () => {
  assert.deepEqual(norm(acme()).images, []);
  const raw = acme();
  delete raw.images;
  assert.deepEqual(norm(raw).images, []);
});

test("images as text is ignored with a warning", () => {
  const raw = acme();
  raw.images = "none";
  const m = norm(raw);
  assert.deepEqual(m.images, []);
  assert.equal(m.warnings.length, 1);
});

// --- section 5: precio desde ---------------------------------------------------------------------

test("S5 price from = minimum of versions[].price.value", () => {
  const m = norm(acme());
  assert.equal(m.price_from?.value, 39990);
  assert.equal(m.price_from?.source_id, "acme-es");
  assert.equal(m.price_from?.url, "https://www.acme.example/es/volta/precios");
});

test("S5 price from includes financed prices (RF-9) and keeps their terms", () => {
  const raw = acme();
  raw.versions[0].price = null; // the cheapest pvp goes away: the financed one is now the minimum
  const m = norm(raw);
  assert.equal(m.price_from?.value, 47500);
  assert.equal(m.price_from?.price_kind, "financed");
  assert.match(m.price_from?.price_terms ?? "", /permanencia de 48 meses/);
  assert.equal(m.price_from?.price_terms_url, "https://www.acme.example/es/volta/ofertas");
});

test("S5 a financed price cheaper than every pvp wins", () => {
  const raw = acme();
  raw.versions[1].price.value = 30000;
  assert.equal(norm(raw).price_from?.price_kind, "financed");
  assert.equal(norm(raw).price_from?.value, 30000);
});

test("S5 no version with a price gives price_from null ('Precio por confirmar')", () => {
  const raw = acme();
  for (const v of raw.versions) v.price = null;
  assert.equal(norm(raw).price_from, null);
  raw.versions = [];
  assert.equal(norm(raw).price_from, null);
});

test("S5 an invalid price does not count for price from", () => {
  const raw = acme();
  raw.versions[0].price = { ...raw.versions[0].price, value: 100, tier: "T2" }; // a T2 price is not published
  const m = norm(raw);
  assert.equal(m.versions[0].price, null);
  assert.equal(m.versions[0].price_issue, "invalid price");
  assert.equal(m.price_from?.value, 47500);
});

// --- price validity (section 4) ------------------------------------------------------------------

test("price rules: value, unit, kind, tier and terms; each violation drops the price with a warning", () => {
  const good = () => structuredClone(acme().versions[0].price);
  const fin = () => structuredClone(acme().versions[1].price);
  const bad: [string, Record<string, unknown>][] = [
    ["non-numeric value", { ...good(), value: "cheap" }],
    ["zero value", { ...good(), value: 0 }],
    ["missing unit", (() => { const p = good(); delete p.unit; return p; })()],
    ["unit not EUR", { ...good(), unit: "USD" }],
    ["bad price_kind", { ...good(), price_kind: "lease" }],
    ["missing price_kind", (() => { const p = good(); delete p.price_kind; return p; })()],
    ["tier not T1", { ...good(), tier: "T3" }],
    ["missing retrieved", (() => { const p = good(); delete p.retrieved; return p; })()],
    ["missing url", (() => { const p = good(); delete p.url; return p; })()],
    ["pvp with price_terms", { ...good(), price_terms: "x", price_terms_url: "https://e.x" }],
    ["financed without price_terms", (() => { const p = fin(); delete p.price_terms; return p; })()],
    ["financed without price_terms_url", (() => { const p = fin(); delete p.price_terms_url; return p; })()],
  ];
  for (const [label, price] of bad) {
    const raw = acme();
    raw.versions[2].price = price;
    const m = norm(raw);
    assert.equal(m.versions[2].price, null, label);
    assert.equal(m.versions[2].price_issue, "invalid price", label);
    assert.equal(m.warnings.length, 1, label);
  }
});

test("a version with price null or without price key is not an invalid price", () => {
  const raw = acme();
  delete raw.versions[2].price;
  const m = norm(raw);
  assert.equal(m.versions[2].price, null);
  assert.equal(m.versions[2].price_issue, null);
  assert.deepEqual(m.warnings, []);
});

test("valid pvp and financed prices pass through with unit and kind", () => {
  const [a, b] = norm(acme()).versions;
  assert.deepEqual([a.price?.unit, a.price?.price_kind], ["EUR", "pvp"]);
  assert.deepEqual([b.price?.unit, b.price?.price_kind], ["EUR", "financed"]);
  assert.match(a.price!.retrieved, /^\d{4}-\d{2}-\d{2}$/); // a string, not a Date
});

// --- versions ------------------------------------------------------------------------------------

test("version fields are typed and keep source, tier and notes", () => {
  const v = norm(acme()).versions[1];
  assert.equal(v.name, "Volta 80 AWD");
  assert.equal(v.battery_kwh?.value, 80);
  assert.equal(v.battery_kwh?.basis, "gross");
  assert.equal(v.wltp_km?.value, 520);
  assert.equal(v.power_kw?.value, 220);
  assert.equal(v.drivetrain?.value, "awd");
  assert.equal(v.dc_max_kw?.tier, "T1");
  assert.equal(v.ac_max_kw, null);
});

test("S5 CV: power_kw stays the kW value and the note keeps the published CV", () => {
  const v = norm(acme()).versions[1];
  assert.equal(v.power_kw?.value, 220);
  assert.equal(v.power_kw?.note, "publicado: 299 CV");
});

test("a version value without source, with a wrong type or out of its list is dropped with a warning", () => {
  const cases: [string, unknown][] = [
    ["wltp_km", { value: 470, source_id: "s" }], // no url, date or tier
    ["wltp_km", sourced(470.5)], // not an integer
    ["wltp_km", sourced(0)],
    ["power_kw", sourced(-3)],
    ["drivetrain", sourced("4x4")],
    ["battery_kwh", sourced(60)], // basis is required
    ["battery_kwh", sourced(60, { basis: "net" })],
    ["dc_max_kw", sourced("fast")],
    ["ac_max_kw", "11"],
  ];
  for (const [field, val] of cases) {
    const raw = acme();
    raw.versions[2][field] = val;
    const m = norm(raw);
    assert.equal((m.versions[2] as any)[field], null, `${field} ${JSON.stringify(val)}`);
    assert.equal(m.warnings.length, 1, field);
  }
});

test("versions as text is ignored with a warning; a version without name is dropped", () => {
  const raw = acme();
  raw.versions = "hello";
  const m = norm(raw);
  assert.deepEqual(m.versions, []);
  assert.equal(m.warnings.length, 1);
  raw.versions = [{ wltp_km: sourced(400) }, { name: "Ok" }];
  const m2 = norm(raw);
  assert.deepEqual(m2.versions.map((v) => v.name), ["Ok"]);
  assert.equal(m2.warnings.length, 1);
});

// --- specs ---------------------------------------------------------------------------------------

test("specs keep their sources and accept only the permitted keys", () => {
  const raw = acme();
  raw.specs.power_max_kw = sourced(220);
  raw.specs.ac_max_kw = sourced(11);
  raw.specs.battery_kwh_options = sourced([60, 80]);
  raw.specs.drivetrains = sourced(["rwd", "awd"]);
  raw.specs.price_from = sourced(1); // not in the schema
  const m = norm(raw);
  assert.deepEqual(Object.keys(m.specs).sort(), [
    "ac_max_kw", "battery_kwh_options", "dc_max_kw", "drivetrains", "power_max_kw", "wltp_max_km",
  ]);
  assert.equal(m.specs.wltp_max_km?.note, "hasta 520 km");
  assert.deepEqual(m.specs.battery_kwh_options?.value, [60, 80]);
  assert.equal(m.warnings.length, 1); // the unknown key
});

test("specs without url, date or tier are dropped with a warning", () => {
  const raw = acme();
  raw.specs.dc_max_kw = { value: 150, source_id: "acme-es" };
  const m = norm(raw);
  assert.equal(m.specs.dc_max_kw, undefined);
  assert.equal(m.specs.wltp_max_km?.value, 520);
  assert.equal(m.warnings.length, 1);
});

test("specs invalid list values are dropped with a warning", () => {
  const raw = acme();
  raw.specs.drivetrains = sourced(["rwd", "4x4"]);
  raw.specs.battery_kwh_options = sourced([60, "big"]);
  const m = norm(raw);
  assert.equal(m.specs.drivetrains, undefined);
  assert.equal(m.specs.battery_kwh_options, undefined);
  assert.equal(m.warnings.length, 2);
});

// --- section 5: autonomía máxima -----------------------------------------------------------------

test("S5 max range = maximum of versions[].wltp_km", () => {
  const raw = acme();
  raw.versions[2].wltp_km.value = 480;
  const m = norm(raw);
  assert.equal(m.max_range_km?.value, 520);
  assert.equal(m.max_range_km?.url, "https://www.acme.example/es/volta/ficha"); // the version's source
});

test("S5 max range ignores versions without wltp_km", () => {
  const raw = acme();
  delete raw.versions[1].wltp_km;
  delete raw.specs.wltp_max_km;
  assert.equal(norm(raw).max_range_km?.value, 490);
});

test("S5 max range falls back to specs.wltp_max_km when no version has wltp_km", () => {
  const raw = acme();
  for (const v of raw.versions) delete v.wltp_km;
  const m = norm(raw);
  assert.equal(m.max_range_km?.value, 520);
  assert.equal(m.max_range_km?.note, "hasta 520 km");
  raw.versions = [];
  assert.equal(norm(raw).max_range_km?.value, 520);
});

test("S5 max range is null when neither versions nor specs have it", () => {
  const raw = acme();
  for (const v of raw.versions) delete v.wltp_km;
  delete raw.specs.wltp_max_km;
  assert.equal(norm(raw).max_range_km, null);
});

test("S5 specs.wltp_max_km that disagrees with the versions makes the file invalid", () => {
  for (const wrong of [500, 600]) {
    const raw = acme();
    raw.specs.wltp_max_km.value = wrong;
    assert.throws(() => norm(raw), /wltp_max_km/, String(wrong));
  }
  const r = loadFiles({ "acme/volta.yaml": ACME_YAML.replace("wltp_max_km: {value: 520", "wltp_max_km: {value: 600") });
  assert.deepEqual(r.models, []);
  assert.deepEqual(r.errors.map((e) => e.file), ["acme/volta.yaml"]);
});

// --- section 5: tracción -------------------------------------------------------------------------

test("S5 drivetrains = set of versions[].drivetrain, without repeats", () => {
  assert.deepEqual(norm(acme()).drivetrains, ["rwd", "awd"]); // rwd, awd, awd
});

test("S5 drivetrains are given in a fixed order, whatever the version order", () => {
  const raw = acme();
  raw.versions[0].drivetrain.value = "awd";
  raw.versions[1].drivetrain.value = "fwd";
  assert.deepEqual(norm(raw).drivetrains, ["fwd", "awd"]);
});

test("S5 drivetrains fall back to specs.drivetrains when no version has one", () => {
  const raw = acme();
  for (const v of raw.versions) delete v.drivetrain;
  raw.specs.drivetrains = sourced(["awd", "rwd"]);
  assert.deepEqual(norm(raw).drivetrains, ["rwd", "awd"]);
});

test("S5 versions win over specs.drivetrains when both exist", () => {
  const raw = acme();
  raw.specs.drivetrains = sourced(["fwd"]);
  assert.deepEqual(norm(raw).drivetrains, ["rwd", "awd"]);
});

test("S5 drivetrains is empty when there is no data anywhere", () => {
  const raw = acme();
  for (const v of raw.versions) delete v.drivetrain;
  assert.deepEqual(norm(raw).drivetrains, []);
});

// --- section 5: estado y segmento ----------------------------------------------------------------

test("S5 status and segment come from the model level, not from versions", () => {
  const m = norm(acme());
  assert.equal(m.status.value, "on_sale");
  assert.equal(m.segment?.value, "suv_compacto");
  assert.equal(m.segment?.note, "la web lo presenta como SUV compacto");
  for (const s of ["on_sale", "announced", "discontinued"]) {
    const raw = acme();
    raw.status.value = s;
    assert.equal(norm(raw).status.value, s);
  }
});

test("S5 an announced model with no versions is valid and has nothing derived", () => {
  const raw = acme();
  raw.status.value = "announced";
  raw.versions = [];
  delete raw.specs;
  const m = norm(raw);
  assert.equal(m.price_from, null);
  assert.equal(m.max_range_km, null);
  assert.deepEqual(m.drivetrains, []);
  assert.deepEqual(m.warnings, []);
});
