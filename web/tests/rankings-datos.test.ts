import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { brotliCompressSync } from "node:zlib";
import { parse, stringify } from "yaml";
import { priceBandSlug } from "../src/lib/ranking-data.ts";
import { RANKINGS, rankPlaces } from "../src/lib/rankings.ts";
import { sourced } from "./fixtures.ts";

/**
 * Story #447 (PRD-005, ADR-0015 details 1 and 5): the JSON of each ranking for the browser filters,
 * built with test data (CARS_DATA_DIR) and, for the weight, with the real data.
 * Covers RF-4 (T3), RF-6, RF-11, RF-15 (out set), RNF-6; CA-4 (T3 part), CA-10, CA-16.
 */
const WEB = resolve(import.meta.dirname, "..");
const BROTLI_LIMIT = 50 * 1024; // ADR-0015, weight amendment, point 7
const SLUGS =RANKINGS.map((r) => r.url.split("/").pop()!);

const build = (data: string | null, outDir: string) => {
  const env = { ...process.env };
  delete env.CARS_DATA_DIR;
  if (data) env.CARS_DATA_DIR = data;
  execFileSync("pnpm", ["exec", "astro", "build", "--outDir", outDir], { cwd: WEB, env, stdio: "pipe" });
};

const price = (value: number, extra: Record<string, unknown> = {}) => ({
  ...sourced(value),
  unit: "EUR",
  price_kind: "pvp",
  ...extra,
});

const model = (name: string, status: string, versions: unknown[], extra: Record<string, unknown> = {}) => ({
  brand: "acme",
  brand_name: "Acme",
  model: name,
  status: sourced(status),
  segment: sourced("suv_compacto"),
  needs_review: false,
  versions,
  ...extra,
});

const write = (dir: string, name: string, doc: unknown) => {
  mkdirSync(join(dir, "acme"), { recursive: true });
  writeFileSync(join(dir, "acme", `${name}.yaml`), stringify(doc));
};

const FIGURES = {
  battery_kwh: sourced(60, { basis: "usable", note: "net" }),
  wltp_km: sourced(400, { note: "WLTP" }),
  power_kw: sourced(150),
  dc_max_kw: sourced(120),
};

describe("ranking JSON with test data (#447)", () => {
  let root: string;
  let data: string;
  let out: string;
  const json = (slug: string) => JSON.parse(readFileSync(join(out, `rankings/datos/${slug}.json`), "utf8"));
  const yamlOf = (name: string) => parse(readFileSync(join(data, "acme", `${name}.yaml`), "utf8"));

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-rankings-datos-"));
    data = join(root, "data");
    out = join(root, "out");
    const full = (n: string, p: unknown) => ({ name: n, ...FIGURES, price: p });
    write(
      data,
      "Ok",
      model("Ok", "on_sale", [
        full("Ok Cheap", price(25000)),
        full("Ok Edge", price(30000)),
        full("Ok Mid", price(30001)),
        full("Ok Fin", price(45000, { price_kind: "financed", price_terms: "48 months", price_terms_url: "https://www.acme.example/t", note: "offer" })),
        full("Ok High", price(45001)),
        full("Ok NoPrice", null),
      ]),
    );
    write(
      data,
      "NoSegment",
      model("NoSegment", "on_sale", [full("NS 1", price(20000))], { segment: null }),
    );
    // Only T3 and missing figures: they go to `out[]`, never to `entries[]`.
    write(
      data,
      "Weak",
      model("Weak", "on_sale", [
        {
          name: "Weak T3",
          battery_kwh: sourced(99, { tier: "T3", basis: "gross" }),
          wltp_km: sourced(999, { tier: "T3" }),
          power_kw: sourced(999, { tier: "T3" }),
          dc_max_kw: sourced(999, { tier: "T3" }),
          price: price(50000),
        },
        { name: "Weak Empty", price: price(28000) },
      ]),
    );
    write(data, "Soon", model("Soon", "announced", [full("Soon 1", price(10000))]));
    write(data, "Old", model("Old", "discontinued", [full("Old 1", price(11000))]));
    write(data, "Hidden", model("Hidden", "on_sale", [full("Hidden 1", price(12000))], { needs_review: true }));
    build(data, out);
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("RF-1: exactly five JSON files, named like the page slugs", () => {
    assert.deepEqual(readdirSync(join(out, "rankings/datos")).sort(), SLUGS.map((s) => `${s}.json`).sort());
  });

  test("CA-10, CA-4 (T3): no announced, discontinued, needs_review or T3 version in any entries", () => {
    for (const slug of SLUGS) {
      const { entries } = json(slug);
      const names = entries.map((e: any) => e.name).sort();
      assert.ok(names.length > 0, slug);
      for (const n of names) assert.doesNotMatch(n, /^(Soon|Old|Hidden)\b/, `${slug}: ${n}`);
      if (slug !== "mas-baratos") for (const n of names) assert.match(n, /^(Ok|NS)\b/, `${slug}: ${n}`);
      for (const e of entries) assert.notEqual(e.figure.tier, "T3");
    }
  });

  test("CA-16: every figure equals the YAML, with its source", () => {
    const fields = ["price", "wltp_km", "battery_kwh", "power_kw", "dc_max_kw"];
    RANKINGS.forEach((r, i) => {
      const { entries } = json(SLUGS[i]);
      assert.ok(fields.includes(r.field));
      for (const e of entries) {
        const y = yamlOf(e.slug).versions.find((v: any) => v.name === e.name)[r.field];
        for (const k of ["value", "source_id", "url", "retrieved", "tier"]) assert.equal(e.figure[k], y[k], `${r.id} ${e.name} ${k}`);
        assert.equal(e.figure.note, y.note ?? null);
        assert.equal(e.brand, "acme");
        assert.equal(e.brand_name, "Acme");
      }
    });
    const precio = json("mas-baratos").entries;
    const fin = precio.find((e: any) => e.name === "Ok Fin").figure;
    assert.equal(fin.price_kind, "financed");
    assert.equal(fin.price_terms, "48 months");
    assert.equal(fin.price_terms_url, "https://www.acme.example/t");
    assert.equal(precio.find((e: any) => e.name === "Ok Cheap").figure.price_terms, null);
    assert.equal(json("mas-bateria").entries[0].figure.basis, "usable");
  });

  test("white-list: only the allowed keys, per ranking; no price figure outside the price ranking", () => {
    const base = ["brand", "brand_name", "figure", "model", "name", "price_band", "segment", "slug"];
    const common = ["note", "retrieved", "source_id", "tier", "url", "value"];
    const extra: Record<string, string[]> = {
      "mas-baratos": ["price_kind", "price_terms", "price_terms_url"],
      "mas-bateria": ["basis"],
    };
    for (const slug of SLUGS) {
      const j = json(slug);
      assert.deepEqual(Object.keys(j).sort(), ["entries", "out"]);
      for (const e of j.entries) {
        assert.deepEqual(Object.keys(e).sort(), base, slug);
        assert.deepEqual(Object.keys(e.figure).sort(), [...common, ...(extra[slug] ?? [])].sort(), slug);
      }
      const text = readFileSync(join(out, `rankings/datos/${slug}.json`), "utf8");
      for (const leaked of ["48 months", "internal"]) {
        assert.equal(text.includes(leaked), slug === "mas-baratos" && leaked === "48 months", `${slug}: ${leaked}`);
      }
      if (slug !== "mas-baratos") assert.doesNotMatch(text, /25000|30001|45001|20000/);
    }
  });

  test("price band slugs come from PRICE_BANDS (30000, 30001, 45000, 45001, none)", () => {
    const bands = Object.fromEntries(json("mas-autonomia").entries.map((e: any) => [e.name, e.price_band]));
    assert.deepEqual(bands, {
      "Ok Cheap": "hasta-30000-euros",
      "Ok Edge": "hasta-30000-euros",
      "Ok Mid": "de-30000-a-45000-euros",
      "Ok Fin": "de-30000-a-45000-euros",
      "Ok High": "mas-de-45000-euros",
      "Ok NoPrice": null,
      "NS 1": "hasta-30000-euros",
    });
    assert.equal(priceBandSlug(null), null);
    assert.equal(priceBandSlug(45000), "de-30000-a-45000-euros");
  });

  test("segment is null for a model without one", () => {
    const ns = json("mas-potencia").entries.find((e: any) => e.name === "NS 1");
    assert.equal(ns.segment, null);
    assert.equal(json("mas-potencia").entries.find((e: any) => e.name === "Ok Cheap").segment, "suv_compacto");
  });

  test("RF-15: out[] has the T3 and figureless on-sale versions with only segment and band", () => {
    for (const slug of SLUGS) {
      const { out: left } = json(slug);
      // Price ranking: only "Ok NoPrice" lacks the figure ("Weak" versions have a T1 price).
      assert.equal(left.length, slug === "mas-baratos" ? 1 : 2, slug);
      for (const o of left) assert.deepEqual(Object.keys(o).sort(), ["price_band", "segment"]);
    }
    const bands = json("mas-autonomia").out.map((o: any) => o.price_band).sort();
    assert.deepEqual(bands, ["hasta-30000-euros", "mas-de-45000-euros"]);
  });

  test("the HTML list equals rankPlaces() over the JSON without filters", () => {
    for (const slug of SLUGS) {
      const def = RANKINGS.find((r) => r.url.endsWith(`/${slug}`))!;
      const html = readFileSync(join(out, "rankings", slug, "index.html"), "utf8");
      const shown = [...html.matchAll(/<li\b[^>]*data-place="(\d+)"[\s\S]*?<p[^>]*data-version[^>]*>\s*([^<]*?)\s*<\/p>/g)].map(
        (m) => `${m[1]} ${m[2]}`,
      );
      const expected = rankPlaces(json(slug).entries, def).map((p) => `${p.place} ${(p.entry as { name: string }).name}`);
      assert.deepEqual(shown, expected, slug);
      assert.ok(shown.length > 0);
    }
  });

  test("ADR-0015 detail 5: robots.txt disallows /rankings/datos/", () => {
    assert.match(readFileSync(join(out, "robots.txt"), "utf8"), /^Disallow: \/rankings\/datos\/\s*$/m);
  });
});

describe("ranking JSON weight with the real data (ADR-0015 estimate)", () => {
  let out: string;
  before(() => {
    out = mkdtempSync(join(tmpdir(), "cars-rankings-real-"));
    build(null, join(out, "out"));
  });
  after(() => rmSync(out, { recursive: true, force: true }));

  test("each of the five JSON weighs 50 KB or less with Brotli (ADR-0015, weight amendment, point 7)", () => {
    const dir = join(out, "out/rankings/datos");
    const sizes = SLUGS.map((s) => {
      const raw = readFileSync(join(dir, `${s}.json`));
      return { s, bytes: raw.length, brotli: brotliCompressSync(raw).length };
    });
    console.log(
      `[rankings weight] ${sizes.map((x) => `${x.s}: ${x.bytes} B raw, ${x.brotli} B brotli`).join("; ")} ` +
        `(threshold: ${BROTLI_LIMIT} B brotli each)`,
    );
    assert.equal(sizes.length, 5);
    for (const x of sizes) {
      assert.ok(x.bytes > 0, x.s);
      assert.ok(x.brotli <= BROTLI_LIMIT, `${x.s}: ${x.brotli} B brotli exceeds ${BROTLI_LIMIT} B`);
    }
  });
});
