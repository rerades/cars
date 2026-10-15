import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { defaultVersion, isComparable, projectModel } from "../src/lib/compare.ts";
import { normalize } from "../src/lib/data.ts";
import { acme, sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");
const price = (value: number, extra: Record<string, unknown> = {}) => ({
  ...sourced(value), unit: "EUR", price_kind: "pvp", ...extra,
});
const rec = (d: Record<string, any>) => normalize(d, `${d.brand}/${d.model}.yaml`);

/** Models written to disk for the build test; the key says what each one is for. */
function catalog(): Record<string, Record<string, any>> {
  const volta = acme();
  const soon = { brand: "acme", brand_name: "Acme", model: "Soon", status: sourced("announced"),
    launch: sourced("2026-10"), versions: [{ name: "Soon 1" }] };
  const noVersions = { brand: "acme", brand_name: "Acme", model: "Empty", status: sourced("announced"), versions: [] };
  const old = { brand: "acme", brand_name: "Acme", model: "Old", status: sourced("discontinued"),
    versions: [{ name: "Old 1", price: price(14990) }] };
  const review = { ...acme(), model: "Review", needs_review: true };
  const cheap = { brand: "zeta", brand_name: "Zeta", model: "Cheap", status: sourced("on_sale"),
    versions: [{ name: "Cheap A", price: price(42000) }, { name: "Cheap B", price: price(35000) }] };
  const noPrice = { brand: "zeta", brand_name: "Zeta", model: "NoPrice", status: sourced("on_sale"),
    versions: [{ name: "First" }, { name: "Second", wltp_km: sourced(400) }] };
  return { volta, soon, noVersions, old, review, cheap, noPrice };
}

describe("isComparable (RF-11)", () => {
  const c = catalog();
  test("on sale or announced, published and with a version: comparable", () => {
    assert.equal(isComparable(rec(c.volta)), true);
    assert.equal(isComparable(rec(c.soon)), true);
  });
  test("CA-13: needs_review, discontinued and no versions are not", () => {
    assert.equal(isComparable(rec(c.review)), false);
    assert.equal(isComparable(rec(c.old)), false);
    assert.equal(isComparable(rec(c.noVersions)), false);
  });
});

describe("defaultVersion (RF-8)", () => {
  const c = catalog();
  test("CA-9: 35.000 € beats 42.000 €, whatever the order", () => {
    assert.equal(defaultVersion(rec(c.cheap).versions)?.name, "Cheap B");
    assert.equal(defaultVersion(rec(c.cheap).versions.toReversed())?.name, "Cheap B");
  });
  test("financed prices count", () => {
    assert.equal(defaultVersion(rec(c.volta).versions)?.name, "Volta 60"); // 39.990 pvp < 47.500 financed
    const d = c.volta;
    d.versions[0].price.value = 49000;
    assert.equal(defaultVersion(rec(d).versions)?.name, "Volta 80 AWD");
  });
  test("CA-9: with no price anywhere, the first version in the file", () => {
    assert.equal(defaultVersion(rec(c.noPrice).versions)?.name, "First");
  });
  test("an empty list gives null", () => {
    assert.equal(defaultVersion([]), null);
  });
});

describe("projectModel: allow-list, absent → null", () => {
  test("RF-3: a version with nothing published gets nulls, never missing keys", () => {
    const p = projectModel(rec(catalog().soon), "soon");
    assert.deepEqual(p.versions[0], {
      name: "Soon 1", price: null, wltp_km: null, battery_kwh: null, power_kw: null,
      drivetrain: null, dc_max_kw: null, ac_max_kw: null,
    });
    assert.equal(p.status.note, null);
  });
  test("no open_questions, needs_review, specs, images or segment leak", () => {
    const p = projectModel(rec(acme()), "volta");
    assert.deepEqual(Object.keys(p).sort(), ["brand", "brand_name", "launch", "model", "slug", "status", "versions"]);
  });
});

describe("/comparar/datos/ in the built site", () => {
  let root: string;
  let out: string;
  const file = (brand: string, model: string) => join(out, "comparar/datos", brand, `${model}.json`);

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-web-compare-"));
    const data = join(root, "data");
    for (const d of Object.values(catalog())) {
      mkdirSync(join(data, d.brand), { recursive: true });
      writeFileSync(join(data, d.brand, `${d.model}.yaml`), stringify(d));
    }
    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-13: a JSON per comparable model and none for the excluded ones", () => {
    assert.ok(existsSync(file("acme", "Volta")));
    assert.ok(existsSync(file("acme", "Soon")));
    assert.ok(existsSync(file("zeta", "Cheap")));
    for (const [b, m] of [["acme", "Review"], ["acme", "Old"], ["acme", "Empty"]]) {
      assert.equal(existsSync(file(b, m)), false, `${b}/${m}`);
    }
  });

  test("CA-18: every published value equals the one in the YAML, field by field", () => {
    const raw = acme();
    const pub = JSON.parse(readFileSync(file("acme", "Volta"), "utf8"));
    const same = (got: any, want: any, where: string) => {
      if (want == null) return assert.equal(got, null, where);
      for (const k of ["value", "source_id", "url", "retrieved", "tier"]) assert.equal(got[k], want[k], `${where}.${k}`);
      assert.equal(got.note, want.note ?? null, `${where}.note`);
    };
    assert.equal(pub.brand, raw.brand);
    assert.equal(pub.slug, "Volta");
    assert.equal(pub.brand_name, raw.brand_name);
    assert.equal(pub.model, raw.model);
    same(pub.status, raw.status, "status");
    same(pub.launch, raw.launch, "launch");
    assert.equal(pub.versions.length, raw.versions.length);
    raw.versions.forEach((rv: any, i: number) => {
      const pv = pub.versions[i];
      const w = `versions[${i}]`;
      assert.equal(pv.name, rv.name);
      for (const f of ["wltp_km", "power_kw", "drivetrain", "dc_max_kw", "ac_max_kw"]) same(pv[f], rv[f], `${w}.${f}`);
      same(pv.battery_kwh, rv.battery_kwh, `${w}.battery_kwh`);
      if (rv.battery_kwh) assert.equal(pv.battery_kwh.basis, rv.battery_kwh.basis);
      same(pv.price, rv.price, `${w}.price`);
      if (rv.price) {
        assert.equal(pv.price.price_kind, rv.price.price_kind);
        assert.equal(pv.price.price_terms, rv.price.price_terms ?? null);
        assert.equal(pv.price.price_terms_url, rv.price.price_terms_url ?? null);
      }
      // Allow-list: nothing but name and the seven fields.
      assert.deepEqual(Object.keys(pv).sort(), ["ac_max_kw", "battery_kwh", "dc_max_kw", "drivetrain", "name", "power_kw", "price", "wltp_km"]);
    });
  });

  test("the published file has no open_questions, needs_review, specs or images text", () => {
    const text = readFileSync(file("acme", "Volta"), "utf8");
    assert.doesNotMatch(text, /open_questions|needs_review|"specs"|"images"|"segment"/);
    assert.doesNotMatch(text, /potencia y batería no publicadas/);
  });

  test("an announced model with only a name publishes nulls", () => {
    const pub = JSON.parse(readFileSync(file("acme", "Soon"), "utf8"));
    assert.equal(pub.versions[0].price, null);
    assert.equal(pub.launch.value, "2026-10");
  });
});
