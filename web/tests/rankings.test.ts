import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { loadModels, normalize, type ModelRecord } from "../src/lib/data.ts";
import { RANKINGS, candidates, type RankingId } from "../src/lib/rankings.ts";
import { sourced } from "./fixtures.ts";

const price = (value: number, extra: Record<string, unknown> = {}) => ({
  ...sourced(value), unit: "EUR", price_kind: "pvp", ...extra,
});
const battery = (value: number, extra: Record<string, unknown> = {}) => ({ ...sourced(value), basis: "usable", ...extra });

/** A version carrying the figure of every ranking. */
const full = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  price: price(30000),
  wltp_km: sourced(400),
  battery_kwh: battery(60),
  power_kw: sourced(150),
  dc_max_kw: sourced(100),
  ...extra,
});

const model = (brand: string, name: string, patch: Record<string, unknown>) => ({
  brand, brand_name: brand, model: name, status: sourced("on_sale"), versions: [], ...patch,
});

const FIELDS: Record<RankingId, string> = {
  precio: "price", autonomia: "wltp_km", bateria: "battery_kwh", potencia: "power_kw", cargaCc: "dc_max_kw",
};

const DOCS = [
  // On sale, every figure present and T1: enters all five rankings.
  model("acme", "Ok", { versions: [full("Ok 1")] }),
  // Version without the field, with null, and only in specs: out of every ranking.
  model("acme", "Gaps", {
    specs: {
      battery_kwh_options: sourced([60, 80]), wltp_max_km: sourced(500), power_max_kw: sourced(200), dc_max_kw: sourced(150),
    },
    versions: [{ name: "Gaps 1" }],
  }),
  model("acme", "Nulls", {
    versions: [{ name: "Nulls 1", price: null, wltp_km: null, battery_kwh: null, power_kw: null, dc_max_kw: null }],
  }),
  // Every figure T3: out of every ranking.
  model("acme", "Rumor", {
    versions: [full("Rumor 1", {
      price: price(1, { tier: "T3" }),
      wltp_km: sourced(999, { tier: "T3" }),
      battery_kwh: battery(999, { tier: "T3" }),
      power_kw: sourced(999, { tier: "T3" }),
      dc_max_kw: sourced(999, { tier: "T3" }),
    })],
  }),
  // T2 gives a place.
  model("acme", "Unofficial", { versions: [{ name: "Unofficial 1", wltp_km: sourced(350, { tier: "T2" }) }] }),
  model("acme", "Soon", { status: sourced("announced"), versions: [full("Soon 1")] }),
  model("acme", "Old", { status: sourced("discontinued"), versions: [full("Old 1")] }),
  model("acme", "Hidden", { needs_review: true, versions: [full("Hidden 1")] }),
  // Mixed model: one version with the figure, one without. Only the first one ranks.
  model("zeta", "Mixed", { versions: [{ name: "Mixed 60", battery_kwh: battery(60) }, { name: "Mixed GT" }] }),
];

let dir = "";
let loaded: ModelRecord[] = [];
const names = (id: RankingId) => candidates(loaded, id).map((c) => c.version.name);

before(() => {
  dir = mkdtempSync(join(tmpdir(), "cars-rankings-"));
  for (const d of DOCS) {
    mkdirSync(join(dir, d.brand), { recursive: true });
    writeFileSync(join(dir, d.brand, `${d.model}.yaml`), stringify(d));
  }
  const result = loadModels(dir);
  assert.deepEqual(result.errors, []);
  loaded = result.models;
});
after(() => rmSync(dir, { recursive: true, force: true }));

describe("table of rankings (RF-1)", () => {
  test("has the five rankings, with field, direction, text key and URL", () => {
    assert.deepEqual(
      RANKINGS.map((r) => [r.id, r.field, r.direction, r.textKey, r.url]),
      [
        ["precio", "price", "asc", "ranking.precio", "/rankings/mas-baratos"],
        ["autonomia", "wltp_km", "desc", "ranking.autonomia", "/rankings/mas-autonomia"],
        ["bateria", "battery_kwh", "desc", "ranking.bateria", "/rankings/mas-bateria"],
        ["potencia", "power_kw", "desc", "ranking.potencia", "/rankings/mas-potencia"],
        ["cargaCc", "dc_max_kw", "desc", "ranking.cargaCc", "/rankings/carga-mas-rapida-en-continua"],
      ],
    );
  });

  test("URLs are unique and carry no query string", () => {
    assert.equal(new Set(RANKINGS.map((r) => r.url)).size, 5);
    assert.ok(RANKINGS.every((r) => !r.url.includes("?")));
  });
});

describe("candidates", () => {
  for (const id of Object.keys(FIELDS) as RankingId[]) {
    test(`${id}: an on-sale version with a T1 figure enters; the figure is the file's, as is`, () => {
      const ok = candidates(loaded, id).find((c) => c.version.name === "Ok 1");
      assert.ok(ok);
      assert.equal(ok.model.model, "Ok");
      assert.equal(ok.figure, (ok.version as any)[FIELDS[id]]);
    });

    test(`${id}: no field, null, T3, announced, discontinued and needs_review stay out`, () => {
      const out = names(id);
      for (const n of ["Gaps 1", "Nulls 1", "Rumor 1", "Soon 1", "Old 1", "Hidden 1"]) {
        assert.ok(!out.includes(n), `${n} must not be in ${id}`);
      }
    });
  }

  test("CA-6: three versions, one without battery, one null, one with 60 kWh: only the last", () => {
    const m = normalize(
      model("acme", "Trio", {
        versions: [{ name: "none" }, { name: "null", battery_kwh: null }, { name: "sixty", battery_kwh: battery(60) }],
      }),
      "acme/Trio.yaml",
    );
    assert.deepEqual(candidates([m], "bateria").map((c) => [c.version.name, c.figure.value]), [["sixty", 60]]);
  });

  test("CA-6: a model with only specs.battery_kwh_options does not enter the battery ranking", () => {
    assert.ok(!candidates(loaded, "bateria").some((c) => c.model.model === "Gaps"));
    assert.ok(!candidates(loaded, "autonomia").some((c) => c.model.model === "Gaps")); // specs.wltp_max_km
    assert.ok(!candidates(loaded, "potencia").some((c) => c.model.model === "Gaps")); // specs.power_max_kw
    assert.ok(!candidates(loaded, "cargaCc").some((c) => c.model.model === "Gaps")); // specs.dc_max_kw
  });

  test("a version without the figure is not rescued by another version of the same model", () => {
    assert.deepEqual(names("bateria").filter((n) => n.startsWith("Mixed")), ["Mixed 60"]);
  });

  test("CA-4 (T3): a T3 figure gives no place; T2 does", () => {
    assert.ok(!names("autonomia").includes("Rumor 1"));
    assert.ok(names("autonomia").includes("Unofficial 1"));
    assert.ok(!names("precio").includes("Rumor 1")); // the price itself is T3 here
  });

  test("CA-10: announced and discontinued with the figure never enter, in any ranking", () => {
    for (const id of Object.keys(FIELDS) as RankingId[]) {
      assert.ok(candidates(loaded, id).every((c) => c.model.status.value === "on_sale"));
    }
  });

  test("CA-10: needs_review is excluded by the function itself, not only by the loader", () => {
    const hidden = normalize(model("acme", "Hidden", { needs_review: true, versions: [full("Hidden 1")] }), "acme/Hidden.yaml");
    assert.equal(hidden.needs_review, true);
    for (const id of Object.keys(FIELDS) as RankingId[]) assert.deepEqual(candidates([hidden], id), []);
  });

  test("a price of 0 is not invented: versions without price do not enter the price ranking", () => {
    assert.deepEqual(names("precio"), ["Ok 1"]);
  });

  test("keeps input order and does not limit", () => {
    assert.deepEqual(names("autonomia"), ["Ok 1", "Unofficial 1"]);
  });
});
