/** Tests for the deterministic evals. Run: npm test */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { changedFiles, runEvals } from "../evals.ts";
import { clock } from "../orchestrator.ts";

const TODAY = "2026-09-23";
const REGISTRY = `sources:
  - id: cupra-es
    tier: T1
    urls: { home: https://www.cupra.com/es-es/ }
    last_verified: 2026-09-23
  - id: acme-es
    tier: T1
    urls: { home: https://www.acme.example/es/ }
    last_verified: 2026-09-20
`;

/** The full example of data-model.md: the schema check must accept the document it enforces. */
const EXAMPLE = /## 7\. Ejemplo completo[\s\S]*?```yaml\n([\s\S]*?)```/.exec(
  readFileSync(join(import.meta.dirname, "..", "..", "docs", "architecture", "data-model.md"), "utf8"),
)![1];
const VOLTA = "data/raw/acme/volta.yaml";

/** Writes files into a temp dir and runs the researcher evals on them. */
function evalFiles(files: Record<string, string>, paths = ["data/"]) {
  const dir = mkdtempSync(join(tmpdir(), "evals-"));
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), body, "utf8");
  }
  try {
    return runEvals("researcher", dir, Object.keys(files), paths, TODAY);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const value = (extra: object) => JSON.stringify({ battery_kwh: {
  value: 77, source_id: "cupra-es", url: "https://www.cupra.com/es-es/coches/born", retrieved: TODAY, tier: "T1", ...extra,
} });

describe("evals del researcher", () => {
  test("el registro y el ejemplo de data-model.md pasan", () => {
    const r = evalFiles({ "data/sources/registry.yaml": REGISTRY, [VOLTA]: EXAMPLE });
    assert.deepEqual(r, { passed: 4, failed: [] });
  });
  test("el registro actual del repo pasa", () => {
    const repo = join(import.meta.dirname, "..", "..");
    // Hoy de verdad, no TODAY: el registro lo actualizan los agentes y sus fechas avanzan.
    const hoy = clock(new Date(), "Europe/Madrid").day;
    assert.deepEqual(runEvals("researcher", repo, ["data/sources/registry.yaml"], ["data/"], hoy).failed, []);
  });
  test("registro inválido", () => {
    const bad = REGISTRY.replace("T1", "T9").replace("2026-09-23", "2027-01-01");
    const { failed } = evalFiles({ "data/sources/registry.yaml": bad });
    assert.deepEqual(failed, [
      "data/sources/registry.yaml: cupra-es: tier must be T1, T2 or T3",
      "data/sources/registry.yaml: cupra-es: last_verified must be a past date",
    ]);
  });
  test("YAML roto", () => {
    assert.match(evalFiles({ "data/sources/registry.yaml": "sources: [" }).failed[0], /invalid YAML/);
  });
  test("un valor sin url ni fuente registrada", () => {
    const { failed } = evalFiles({
      "data/sources/registry.yaml": REGISTRY,
      "data/raw/cupra/born.yaml": value({ url: "", source_id: "inventada" }),
    });
    assert.deepEqual(failed.filter((f) => /battery_kwh: (missing|source_id)/.test(f)), [
      "data/raw/cupra/born.yaml: battery_kwh: missing url",
      "data/raw/cupra/born.yaml: battery_kwh: source_id inventada is not in the registry",
    ]);
  });
  test("forma de ADR-0008: cada regla rechaza su error", () => {
    const bad = (from: string, to: string) => {
      const body = EXAMPLE.replace(from, to);
      assert.notEqual(body, EXAMPLE, `fixture did not change: ${from}`);
      return evalFiles({ "data/sources/registry.yaml": REGISTRY, [VOLTA]: body }).failed;
    };
    const cases: [string, string, RegExp][] = [
      ["brand: acme", "brand: acme\nmodel_level: {}", /model_level: unknown key/],
      ["brand_name: Acme\n", "", /brand_name: missing/],
      ["value: on_sale", "value: vendido", /status: invalid value/],
      ["value: suv_compacto", "value: suv", /segment: invalid value/],
      ["value: rwd", "value: RWD", /versions\[0\]\.drivetrain: invalid value/],
      ["value: 470,", "value: 470.5,", /versions\[0\]\.wltp_km: invalid value/],
      ["value: 60, basis: usable,", "value: 60,", /battery_kwh\.basis/],
      ["power_kw: {value: 150,", "power_cv: {value: 204,", /power_cv: unknown key/],
      ["price_kind: pvp", "price_kind: pvp\n      price_terms: x", /pvp must not have price_terms/],
      ["      price_terms_url:", "      terms_url:", /financed needs price_terms/],
      ["    price: null   #", "    #", /versions\[2\]\.price: missing/],
      ["name: Volta 80 AWD", "name: Volta 60", /repeated \(Volta 60\)/],
      ["wltp_max_km: {value: 520", "wltp_max_km: {value: 530", /must match the versions. maximum/],
      ["images: []", "images: [{url: x, source_id: acme-es, retrieved: 2026-09-20}]", /images\[0\]\.license: missing/],
    ];
    for (const [from, to, error] of cases) {
      const failed = bad(from, to);
      assert.ok(failed.some((f) => error.test(f)), `${error}: ${JSON.stringify(failed)}`);
    }
    assert.match(bad("brand: acme", "brand: acme-motors").join(), /brand must be the folder name/);
  });
  test("brand_name igual en toda la carpeta", () => {
    const { failed } = evalFiles({
      "data/sources/registry.yaml": REGISTRY,
      [VOLTA]: EXAMPLE,
      "data/raw/acme/volta-2.yaml": EXAMPLE.replace("brand_name: Acme", "brand_name: ACME"),
    });
    assert.ok(failed.some((f) => /brand_name "ACME" differs from volta\.yaml/.test(f)), JSON.stringify(failed));
  });
  test("escribir fuera de write_paths", () => {
    assert.deepEqual(evalFiles({ "src/x.ts": "" }).failed, ['write_paths: src/x.ts is outside ["data/"]']);
  });
});

test("changedFiles ve modificados y nuevos", () => {
  const dir = mkdtempSync(join(tmpdir(), "evals-git-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q", "-b", "base");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  writeFileSync(join(dir, "a.txt"), "1", "utf8");
  writeFileSync(join(dir, "b.txt"), "1", "utf8");
  git("add", "-A");
  git("commit", "-q", "-m", "inicial");
  writeFileSync(join(dir, "a.txt"), "2", "utf8");
  mkdirSync(join(dir, "data"));
  writeFileSync(join(dir, "data", "c.yaml"), "", "utf8");
  assert.deepEqual(changedFiles(dir).sort(), ["a.txt", "data/c.yaml"]);
  rmSync(dir, { recursive: true, force: true });
});
