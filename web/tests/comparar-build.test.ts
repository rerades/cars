import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { parse, stringify } from "yaml";
import { acme, sourced } from "./fixtures.ts";

/**
 * Story #325 (PRD-003): cross-cutting checks on the built comparator. RNF-4, RNF-5, RNF-6, RF-11,
 * RF-14; CA-12 (static part), CA-13, CA-16, CA-18, CA-19 (HTML). ADR-0014, decision 5.
 */
const WEB = join(import.meta.dirname, "..");

function writeModel(dir: string, brand: string, model: string, doc: Record<string, any>) {
  mkdirSync(join(dir, brand), { recursive: true });
  writeFileSync(join(dir, brand, `${model}.yaml`), stringify(doc));
}

const build = (data: string | null, outDir: string) =>
  execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", outDir], {
    cwd: WEB,
    env: data ? { ...process.env, CARS_DATA_DIR: data } : process.env,
    stdio: "pipe",
  });

const make = (model: string, status: string, versions: unknown[], brand = "acme") => ({
  brand,
  brand_name: brand,
  model,
  status: sourced(status),
  segment: sourced("suv_compacto"),
  versions,
});
const version = (name: string) => ({ name, wltp_km: sourced(400), price: { ...sourced(30000), unit: "EUR", price_kind: "pvp" } });

/** Every field of the whitelist filled in, with a note and a non-T1 tier, plus fields that must not leak. */
const full = () => ({
  ...make("Full", "announced", [
    {
      name: "Full 1",
      battery_kwh: sourced(64.5, { basis: "usable", note: "net" }),
      wltp_km: sourced(512, { tier: "T2", note: "estimate" }),
      power_kw: sourced(165),
      drivetrain: sourced("awd"),
      dc_max_kw: sourced(175),
      ac_max_kw: sourced(11),
      price: {
        ...sourced(41234, { note: "with offer" }),
        unit: "EUR",
        price_kind: "financed",
        price_terms: "Financed, 48 months.",
        price_terms_url: "https://www.acme.example/es/full/ofertas",
      },
      internal_note: "must not be published",
    },
    { name: "Full 2", price: null },
  ]),
  launch: sourced("2026-12", { note: "planned" }),
  needs_review: false,
  specs: { power_max_kw: sourced(777) },
  open_questions: ["secret question"],
  images: [],
});

const COMPARABLE: [string, string][] = [
  ["acme", "Volta"],
  ["acme", "Soon"],
  ["acme", "Full"],
  ["beta", "Near"],
];
const EXCLUDED: [string, string][] = [
  ["acme", "Hidden"],
  ["acme", "Old"],
  ["acme", "Empty"],
  ["beta", "Gone"],
];

const SOURCED_KEYS = ["note", "retrieved", "source_id", "tier", "url", "value"];
const ALLOWED = {
  model: ["brand", "brand_name", "launch", "model", "slug", "status", "versions"],
  version: ["ac_max_kw", "battery_kwh", "dc_max_kw", "drivetrain", "name", "power_kw", "price", "wltp_km"],
  price: [...SOURCED_KEYS, "price_kind", "price_terms", "price_terms_url"].sort(),
  battery: [...SOURCED_KEYS, "basis"].sort(),
};
const sortedKeys = (o: object) => Object.keys(o).sort();

function jsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsFiles(join(dir, e.name)) : e.name.endsWith(".js") ? [join(dir, e.name)] : [],
  );
}

describe("comparator build with test data (PRD-003, story #325)", () => {
  let root: string;
  let data: string;
  const out = () => join(root, "out");
  const json = (p: string) => JSON.parse(readFileSync(join(out(), p), "utf8"));
  const yamlOf = (brand: string, model: string) => parse(readFileSync(join(data, brand, `${model}.yaml`), "utf8"));
  const page = (p: string) => readFileSync(join(out(), p, "index.html"), "utf8");
  const compareLinks = (s: string) => [...s.matchAll(/<a\b[^>]*href="\/comparar\/[^"]*"[^>]*>/g)].map((m) => m[0]);

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-web-"));
    data = join(root, "data");
    writeModel(data, "acme", "Volta", acme());
    writeModel(data, "acme", "Soon", make("Soon", "announced", [version("Soon 1")]));
    writeModel(data, "acme", "Full", full());
    writeModel(data, "acme", "Hidden", { ...make("Hidden", "on_sale", [version("Hidden 1")]), needs_review: true });
    writeModel(data, "acme", "Old", make("Old", "discontinued", [version("Old 1")]));
    writeModel(data, "acme", "Empty", make("Empty", "announced", []));
    writeModel(data, "beta", "Near", make("Near", "on_sale", [version("Near 1")], "beta"));
    writeModel(data, "beta", "Gone", make("Gone", "discontinued", [version("Gone 1")], "beta"));
    build(data, out());
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("RF-11/CA-13: one JSON per comparable model, none for needs_review, discontinued or versionless", () => {
    for (const [b, m] of COMPARABLE) assert.ok(existsSync(join(out(), `comparar/datos/${b}/${m}.json`)), `${b}/${m}`);
    for (const [b, m] of EXCLUDED) assert.equal(existsSync(join(out(), `comparar/datos/${b}/${m}.json`)), false, `${b}/${m}`);
    const files = readdirSync(join(out(), "comparar/datos/acme")).sort();
    assert.deepEqual(files, ["Full.json", "Soon.json", "Volta.json"]);
  });

  test("index lists exactly the comparable models and carries no figures", () => {
    const index = json("comparar/datos/indice.json") as Record<string, unknown>[];
    assert.deepEqual(
      index.map((e) => `${e.brand}/${e.slug}`).sort(),
      COMPARABLE.map(([b, m]) => `${b}/${m}`).sort(),
    );
    const walk = (v: unknown, path: string) => {
      assert.notEqual(typeof v, "number", `figure at ${path}`);
      assert.notEqual(typeof v, "boolean", `boolean at ${path}`);
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(index, "index");
    for (const e of index) {
      assert.deepEqual(sortedKeys(e), ["brand", "brand_name", "default_version", "model", "slug", "status", "versions"]);
    }
    const volta = index.find((e) => e.slug === "Volta")!;
    assert.deepEqual(volta.versions, ["Volta 60", "Volta 80 AWD", "Volta GT"]);
    assert.equal(volta.default_version, "Volta 60");
    // No datum of the YAML leaks into the index (price, URLs, dates).
    assert.doesNotMatch(readFileSync(join(out(), "comparar/datos/indice.json"), "utf8"), /39990|https?:|2026-09-20/);
  });

  test("CA-18: every published value is identical to the YAML", () => {
    const datum = (s: any) => ({
      value: s.value,
      source_id: s.source_id,
      url: s.url,
      retrieved: s.retrieved,
      tier: s.tier,
      note: s.note ?? null,
    });
    const opt = (s: any, extra: Record<string, unknown> = {}) => (s == null ? null : { ...datum(s), ...extra });
    for (const [b, m] of COMPARABLE) {
      const y = yamlOf(b, m);
      const j = json(`comparar/datos/${b}/${m}.json`);
      assert.equal(j.brand, y.brand);
      assert.equal(j.slug, m);
      assert.equal(j.brand_name, y.brand_name);
      assert.equal(j.model, y.model);
      assert.deepEqual(j.status, datum(y.status), `${m} status`);
      assert.deepEqual(j.launch, opt(y.launch), `${m} launch`);
      assert.equal(j.versions.length, y.versions.length);
      y.versions.forEach((yv: any, i: number) => {
        const jv = j.versions[i];
        assert.equal(jv.name, yv.name);
        for (const f of ["wltp_km", "power_kw", "drivetrain", "dc_max_kw", "ac_max_kw"]) {
          assert.deepEqual(jv[f], opt(yv[f]), `${m} ${yv.name} ${f}`);
        }
        assert.deepEqual(jv.battery_kwh, opt(yv.battery_kwh, yv.battery_kwh ? { basis: yv.battery_kwh.basis } : {}), `${m} battery`);
        assert.deepEqual(
          jv.price,
          opt(yv.price, {
            price_kind: yv.price?.price_kind,
            price_terms: yv.price?.price_terms ?? null,
            price_terms_url: yv.price?.price_terms_url ?? null,
          }),
          `${m} ${yv.name} price`,
        );
      });
    }
    // The fixture really exercises the optional parts.
    const f = json("comparar/datos/acme/Full.json");
    assert.equal(f.versions[0].battery_kwh.value, 64.5);
    assert.equal(f.versions[0].wltp_km.tier, "T2");
    assert.equal(f.versions[0].price.price_kind, "financed");
    assert.equal(f.versions[1].price, null);
    assert.equal(f.launch.note, "planned");
  });

  test("CA-18: no field outside the allow-list, and no figure that is not in the YAML", () => {
    for (const [b, m] of COMPARABLE) {
      const j = json(`comparar/datos/${b}/${m}.json`);
      assert.deepEqual(sortedKeys(j), ALLOWED.model, `${m} model keys`);
      for (const d of [j.status, j.launch]) if (d) assert.deepEqual(sortedKeys(d), [...SOURCED_KEYS].sort());
      for (const v of j.versions) {
        assert.deepEqual(sortedKeys(v), ALLOWED.version, `${m} version keys`);
        for (const [k, d] of Object.entries<any>(v)) {
          if (k === "name" || d === null) continue;
          const expected = k === "price" ? ALLOWED.price : k === "battery_kwh" ? ALLOWED.battery : [...SOURCED_KEYS].sort();
          assert.deepEqual(sortedKeys(d), expected, `${m} ${v.name} ${k}`);
        }
      }
    }
    const text = readFileSync(join(out(), "comparar/datos/acme/Full.json"), "utf8");
    for (const leaked of ["internal_note", "must not be published", "open_questions", "secret question", "needs_review", "specs", "777", "images", "segment"]) {
      assert.ok(!text.includes(leaked), `leaked: ${leaked}`);
    }
    // Every number in the JSON appears in the YAML.
    const numbers = (s: string) => new Set(s.match(/-?\d+(\.\d+)?/g));
    for (const [b, m] of COMPARABLE) {
      const inYaml = numbers(readFileSync(join(data, b, `${m}.yaml`), "utf8"));
      const inJson = numbers(JSON.stringify(json(`comparar/datos/${b}/${m}.json`).versions.map((v: any) => ({ ...v, name: "" }))));
      for (const n of inJson) assert.ok(inYaml.has(n), `${b}/${m}: number ${n} is not in the YAML`);
    }
  });

  test("CA-16: /comparar/ carries noindex and a canonical without parameters", () => {
    const html = page("comparar");
    const head = html.slice(0, html.indexOf("</head>"));
    assert.match(head, /<meta name="robots" content="noindex"\s*\/?>/);
    const canonicals = [...head.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(canonicals, ["https://siete3.com/comparar/"]);
  });

  test("CA-19: /comparar/ has a visible no-JavaScript notice with a link to /coches", () => {
    const html = page("comparar");
    const notice = html.match(/<div\b[^>]*data-no-js[^>]*>[\s\S]*?<\/div>/)?.[0];
    assert.ok(notice, "no [data-no-js] notice");
    assert.doesNotMatch(notice, /\bhidden\b/);
    assert.match(notice, /necesita JavaScript/);
    assert.match(notice, /<a\b[^>]*href="\/coches"/);
  });

  test("RF-6/RF-7/CA-13: comparable cards and sheets link to /comparar/, excluded ones do not", () => {
    const coches = page("coches");
    for (const [b, m] of COMPARABLE) {
      assert.ok(coches.includes(`href="/comparar/?v=${b}/${m}"`), `card ${b}/${m}`);
      assert.equal(compareLinks(page(`marcas/${b}/${m}`)).filter((l) => l.includes(`v=${b}/${m}"`)).length, 1, `sheet ${b}/${m}`);
    }
    for (const [b, m] of EXCLUDED) {
      assert.ok(!coches.includes(`v=${b}/${m}`), `card ${b}/${m}`);
      if (existsSync(join(out(), `marcas/${b}/${m}/index.html`))) {
        // Related models on the sheet may be comparable; the model's own link must not exist.
        assert.equal(compareLinks(page(`marcas/${b}/${m}`)).filter((l) => l.includes(`v=${b}/${m}"`)).length, 0, `sheet ${b}/${m}`);
      }
    }
  });

  test("RF-14: robots.txt in the build disallows /comparar/datos/", () => {
    const robots = readFileSync(join(out(), "robots.txt"), "utf8");
    assert.match(robots, /^User-agent: \*\s*$/m);
    assert.match(robots, /^Disallow: \/comparar\/datos\/\s*$/m);
    assert.deepEqual(
      robots.split("\n").filter((l) => /^Disallow:/i.test(l)),
      ["Disallow: /comparar/datos/", "Disallow: /rankings/datos/"],
    );
  });

  test("RNF-4/CA-12: no browser storage identifiers in the built .js files", () => {
    const files = jsFiles(out());
    assert.ok(files.length > 0, "no .js in the build");
    const forbidden = /\b(localStorage|sessionStorage|indexedDB|caches|serviceWorker)\b|document\.cookie/;
    for (const f of files) {
      const hit = forbidden.exec(readFileSync(f, "utf8"));
      assert.equal(hit, null, `${f.slice(out().length)} contains ${hit?.[0]}`);
    }
  });
});

describe("comparator weight with the real data (ADR-0014 limits)", () => {
  let out: string;
  before(() => {
    out = mkdtempSync(join(tmpdir(), "cars-web-real-"));
    build(null, join(out, "out"));
  });
  after(() => rmSync(out, { recursive: true, force: true }));

  const INDEX_LIMIT = 65_536; // 64 KB
  const MODEL_LIMIT = 32_768; // 32 KB

  test("prints the weight and fails if the index or a model JSON exceeds its limit", () => {
    const dir = join(out, "out/comparar/datos");
    const index = statSync(join(dir, "indice.json")).size;
    const models: { file: string; size: number }[] = [];
    for (const b of readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      for (const f of readdirSync(join(dir, b.name))) {
        models.push({ file: `${b.name}/${f}`, size: statSync(join(dir, b.name, f)).size });
      }
    }
    models.sort((a, b) => b.size - a.size);
    const total = models.reduce((n, m) => n + m.size, 0);
    console.log(
      `[comparar weight] index: ${index} B; models: ${models.length}; largest: ${models[0]?.file} ${models[0]?.size} B; ` +
        `total of model JSON: ${total} B (ADR-0014 measured: index 17483 B, largest porsche/taycan 22257 B, total 232039 B)`,
    );
    assert.ok(index > 0 && models.length > 0);
    // ADR-0014 alarm thresholds (no limit on the total).
    assert.ok(
      index <= INDEX_LIMIT,
      `comparar/datos/indice.json is ${index} B, over the ${INDEX_LIMIT} B limit (ADR-0014)`,
    );
    for (const m of models) {
      assert.ok(
        m.size <= MODEL_LIMIT,
        `comparar/datos/${m.file} is ${m.size} B, over the ${MODEL_LIMIT} B limit (ADR-0014)`,
      );
    }
  });
});
