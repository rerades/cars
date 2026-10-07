/** Tests for the deterministic evals. Run: npm test */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { changedFiles, runEvals } from "../evals.ts";
import { clock } from "../orchestrator.ts";

const TODAY = "2026-09-23";
/** The test registry: one file per source (data-model.md, section 8). */
const CUPRA = "data/sources/cupra-es.yaml";
const SOURCES = {
  [CUPRA]: "id: cupra-es\ntier: T1\nurls: { home: https://www.cupra.com/es-es/ }\nlast_verified: 2026-09-23\n",
  "data/sources/acme-es.yaml": "id: acme-es\ntier: T1\nurls: { home: https://www.acme.example/es/ }\nlast_verified: 2026-09-20\n",
};

/** The full example of data-model.md: the schema check must accept the document it enforces. */
const EXAMPLE = /## 7\. Ejemplo completo[\s\S]*?```yaml\n([\s\S]*?)```/.exec(
  readFileSync(join(import.meta.dirname, "..", "..", "docs", "architecture", "data-model.md"), "utf8"),
)![1];
const VOLTA = "data/raw/acme/volta.yaml";

/** Writes files into a temp dir and runs the researcher evals on them. */
function evalFiles(files: Record<string, string | Buffer>, paths = ["data/"]) {
  const dir = mkdtempSync(join(tmpdir(), "evals-"));
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), body);
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
    const r = evalFiles({ ...SOURCES, [VOLTA]: EXAMPLE });
    assert.deepEqual(r, { passed: 4, failed: [] });
  });
  test("el registro actual del repo pasa", () => {
    const repo = join(import.meta.dirname, "..", "..");
    // Hoy de verdad, no TODAY: el registro lo actualizan los agentes y sus fechas avanzan.
    const hoy = clock(new Date(), "Europe/Madrid").day;
    const files = readdirSync(join(repo, "data", "sources")).map((f) => `data/sources/${f}`);
    assert.ok(files.length > 0);
    assert.deepEqual(runEvals("researcher", repo, files, ["data/"], hoy).failed, []);
  });
  test("registro inválido", () => {
    const bad = SOURCES[CUPRA].replace("T1", "T9").replace("2026-09-23", "2027-01-01");
    const { failed } = evalFiles({ [CUPRA]: bad });
    assert.deepEqual(failed, [
      "data/sources/cupra-es.yaml: tier must be T1, T2 or T3",
      "data/sources/cupra-es.yaml: last_verified must be a past date",
    ]);
  });
  test("YAML roto", () => {
    assert.match(evalFiles({ [CUPRA]: "id: [" }).failed[0], /invalid YAML/);
  });
  test("el id de una fuente es el nombre de su fichero", () => {
    assert.deepEqual(evalFiles({ "data/sources/cupra-es.yaml": SOURCES["data/sources/acme-es.yaml"] }).failed,
      ['data/sources/cupra-es.yaml: id must be "cupra-es", the file name']);
  });
  test("una fuente es un mapa, no una lista", () => {
    assert.deepEqual(evalFiles({ [CUPRA]: `- ${SOURCES[CUPRA].replaceAll("\n", "\n  ")}` }).failed,
      ["data/sources/cupra-es.yaml: must be a map with one source"]);
  });
  test("un source_id vale aunque su fichero no haya cambiado", () => {
    const dir = mkdtempSync(join(tmpdir(), "evals-"));
    for (const [f, body] of Object.entries({ ...SOURCES, "data/raw/cupra/born.yaml": value({}) })) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      writeFileSync(join(dir, f), body, "utf8");
    }
    const { failed } = runEvals("researcher", dir, ["data/raw/cupra/born.yaml"], ["data/"], TODAY);
    rmSync(dir, { recursive: true, force: true });
    assert.deepEqual(failed.filter((f) => /source_id/.test(f)), []);
  });
  test("un valor sin url ni fuente registrada", () => {
    const { failed } = evalFiles({
      ...SOURCES,
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
      return evalFiles({ ...SOURCES, [VOLTA]: body }).failed;
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
      ["images: []", "images: [{file: x, source_url: x, page_url: x, source_id: acme-es, retrieved: 2026-09-20, attribution: null}]",
        /images\[0\]\.license: missing/],
    ];
    for (const [from, to, error] of cases) {
      const failed = bad(from, to);
      assert.ok(failed.some((f) => error.test(f)), `${error}: ${JSON.stringify(failed)}`);
    }
    assert.match(bad("brand: acme", "brand: acme-motors").join(), /brand must be the folder name/);
  });
  test("brand_name igual en toda la carpeta", () => {
    const { failed } = evalFiles({
      ...SOURCES,
      [VOLTA]: EXAMPLE,
      "data/raw/acme/volta-2.yaml": EXAMPLE.replace("brand_name: Acme", "brand_name: ACME"),
    });
    assert.ok(failed.some((f) => /brand_name "ACME" differs from volta\.yaml/.test(f)), JSON.stringify(failed));
  });
  test("imágenes (ADR-0012; ADR-0010, puntos 11 y 14)", () => {
    const png = (width: number) => {
      const size = Buffer.alloc(8);
      size.writeUInt32BE(width, 0);
      size.writeUInt32BE(720, 4);
      return Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d", "hex"), Buffer.from("IHDR"), size, Buffer.alloc(5)]);
    };
    const FILE = "data/images/acme/volta/frontal.png";
    const image = (extra: string) => EXAMPLE.replace("images: []", "images:\n  - {file: " + FILE + ", "
      + "source_url: https://upload.wikimedia.org/x.png, page_url: https://commons.wikimedia.org/wiki/File:X.png, "
      + "source_id: acme-es, retrieved: 2026-09-20, license: CC-BY-4.0, attribution: null" + extra + "}");
    const images = (body: string, files: Record<string, string | Buffer> = { [FILE]: png(1280) }) =>
      evalFiles({ ...SOURCES, [VOLTA]: body, ...files }).failed.filter((f) => /images/.test(f));

    assert.deepEqual(images(image("")), []);
    assert.match(images(image(", url: x")).join(), /url cannot be mixed/);
    const old = EXAMPLE.replace("images: []", "images: [{url: x, source_id: acme-es, retrieved: 2026-09-20, license: CC0, attribution: null}]");
    assert.match(images(old, {}).join(), /old shape \(url\)/);
    assert.match(images(image(""), {}).join(), /does not exist/);
    assert.match(images(image(""), { [FILE]: png(1920) }).join(), /1920 px wide/);
    assert.match(images(image(""), { [FILE]: "<html>" }).join(), /not a JPEG or PNG/);
    assert.match(images(image("").replace(FILE, "data/images/acme/otro/frontal.png")).join(), /must be data\/images\/acme\/volta\//);
    assert.match(images(image("").replace(", attribution: null", "")).join(), /attribution: missing/);
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

test("dos ramas que dan de alta fuentes distintas se rebasan sin conflicto (#164)", () => {
  const dir = mkdtempSync(join(tmpdir(), "evals-rebase-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t",
    "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" });
  const add = (f: string, body: string) => {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), body, "utf8");
  };
  git("init", "-q", "-b", "trunk");
  add(CUPRA, SOURCES[CUPRA]);
  git("add", "-A");
  git("commit", "-qm", "base");
  git("checkout", "-qb", "a");
  add("data/sources/acme-es.yaml", SOURCES["data/sources/acme-es.yaml"]);
  git("add", "-A");
  git("commit", "-qm", "alta acme");
  git("checkout", "-q", "trunk");
  git("checkout", "-qb", "b");
  add("data/sources/zeta-es.yaml", SOURCES[CUPRA].replaceAll("cupra", "zeta"));
  git("add", "-A");
  git("commit", "-qm", "alta zeta");
  git("rebase", "-q", "a"); // throws on a conflict
  assert.deepEqual(readdirSync(join(dir, "data", "sources")).sort(), ["acme-es.yaml", "cupra-es.yaml", "zeta-es.yaml"]);
  rmSync(dir, { recursive: true, force: true });
});
