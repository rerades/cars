/** Tests for the deterministic evals. Run: npm test */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { changedFiles, runEvals, validateData } from "../evals.ts";
import { madridToday, summary } from "../validate-data.ts";
import { clock } from "../orchestrator.ts";

const TODAY = "2026-09-23";
/** The test registry: one file per source (data-model.md, section 8). */
const CUPRA = "data/sources/cupra-es.yaml";
const SOURCES = {
  [CUPRA]: "id: cupra-es\ntier: T1\nurls: { home: https://www.cupra.com/es-es/ }\nlast_verified: 2026-09-23\n",
  "data/sources/acme-es.yaml": "id: acme-es\ntier: T1\nurls: { home: https://www.acme.example/es/ }\nlast_verified: 2026-09-20\n",
};

const DATA_MODEL = readFileSync(join(import.meta.dirname, "..", "..", "docs", "architecture", "data-model.md"), "utf8");
/** The full example of data-model.md: the schema check must accept the document it enforces. */
const EXAMPLE = /## 7\. Ejemplo completo[\s\S]*?```yaml\n([\s\S]*?)```/.exec(DATA_MODEL)![1];
const VOLTA = "data/raw/acme/volta.yaml";
/** Section 3.1's example (ADR-0017): the reviews to append to EXAMPLE, and the medium they cite. */
const [REVIEWS, MEDIUM] = [...(/### 3\.1[\s\S]*?\n## 4\./.exec(DATA_MODEL)![0].matchAll(/```yaml\n([\s\S]*?)```/g))].map((m) => m[1]);
const MEDIUM_FILE = "data/sources/motorejemplo-es.yaml";

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
      ["price_kind: pvp", "price_kind: pvp\n      page_name: volta-60", /price\.page_name: must be text other than the version name/],
      ["price_kind: pvp", "price_kind: pvp\n      page_name: \"\"", /price\.page_name: must be text other than the version name/],
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
    assert.match(images(image(""), { [FILE]: Buffer.concat([png(1280), Buffer.alloc(2_000_000)]) }).join(), /bytes, more than 2000000/);
    assert.match(images(image(""), { [FILE]: "<html>" }).join(), /not a JPEG or PNG/);
    assert.match(images(image("").replace(FILE, "data/images/acme/otro/frontal.png")).join(), /must be data\/images\/acme\/volta\//);
    assert.match(images(image("").replace(", attribution: null", "")).join(), /attribution: missing/);
  });
  test("escribir fuera de write_paths", () => {
    assert.deepEqual(evalFiles({ "src/x.ts": "" }).failed, ['write_paths: src/x.ts is outside ["data/"]']);
  });
});

describe("reviews y resultados de pruebas (ADR-0017)", () => {
  const WITH = EXAMPLE + REVIEWS;
  const ORG_FILE = "data/sources/pruebas-eu.yaml";
  const ORG = "id: pruebas-eu\ntier: T2\nkind: [tests]\nname: Pruebas Ejemplo\nterms_url: https://www.pruebas.example/terms\n"
    + "terms_checked: 2026-09-20\nurls: { home: https://www.pruebas.example/ }\nlast_verified: 2026-09-20\n";
  const run = (body: string, medium = MEDIUM) =>
    evalFiles({ ...SOURCES, [MEDIUM_FILE]: medium, [ORG_FILE]: ORG, [VOLTA]: body }).failed;

  test("el ejemplo de la sección 3.1 y su medio pasan", () => {
    assert.ok(REVIEWS?.startsWith("reviews:") && MEDIUM?.includes("id: motorejemplo-es"), "section 3.1 examples not found");
    assert.deepEqual(run(WITH), []);
  });
  test("cada regla de las reviews rechaza su error", () => {
    const cases: [string, string, RegExp][] = [
      ["    version: Volta 80 AWD", "    version: Volta 80 AWD\n    summary: muy bueno", /reviews\[0\]\.summary: unknown key/],
      ['  - title: "Acme Volta, primera prueba"\n', "  -\n", /reviews\[1\]\.title: missing/],
      ["source_id: motorejemplo-es", "source_id: otro-es", /reviews\[0\]: source_id otro-es is not in the registry/],
      ["tier: T3\n    version", "tier: T1\n    version", /reviews\[0\]\.tier: must be T2 or T3/],
      ["https://www.motor.example/pruebas", "https://www.tienda.example/pruebas", /reviews\[0\]\.url: host www\.tienda\.example is not one of the source's urls/],
      ["https://videos.motor.example", "http://videos.motor.example", /reviews\[1\]\.url: must be an https URL/],
      ["version: Volta 80 AWD", "version: Volta 99", /reviews\[0\]\.version: Volta 99 is not a version of this file/],
      ["https://videos.motor.example/acme-volta", "https://www.motor.example/pruebas/acme-volta-80-awd", /reviews\[1\]\.url: repeated/],
      ["retrieved: 2026-09-20\n    tier: T3", "retrieved: 2027-01-01\n    tier: T3", /reviews\[0\]\.retrieved: must be a past date/],
    ];
    for (const [from, to, error] of cases) {
      const body = WITH.replace(from, to);
      assert.notEqual(body, WITH, `fixture did not change: ${from}`);
      const failed = run(body);
      assert.ok(failed.some((f) => error.test(f)), `${error}: ${JSON.stringify(failed)}`);
    }
    assert.match(run(EXAMPLE + "reviews: {}\n").join(), /reviews: must be a list/);
  });
  test("la fuente de una review: kind, name, términos y nivel", () => {
    const medium = (from: string, to: string) => {
      const body = MEDIUM.replace(from, to);
      assert.notEqual(body, MEDIUM, `fixture did not change: ${from}`);
      return run(WITH, body).join("\n");
    };
    const unnamed = medium("name: Motor Ejemplo\n", "");
    assert.match(unnamed, /motorejemplo-es\.yaml: kind reviews or tests needs name/);
    assert.match(unnamed, /reviews\[0\]: source motorejemplo-es needs name, terms_url and terms_checked/);
    assert.match(medium("terms_url: https://www.motor.example/aviso-legal\n", ""), /needs terms_url, an https URL/);
    assert.match(medium("terms_checked: 2026-09-20", "terms_checked: 2027-01-01"), /terms_checked must be a past date/);
    assert.match(medium("kind: [reviews]", "kind: [announcements]"), /reviews\[0\]: source motorejemplo-es needs kind reviews/);
    assert.match(medium("tier: T3", "tier: T2"), /reviews\[0\]\.tier: must be the source's \(T2\)/);
  });
  test("un resultado de prueba falla mientras la lista de métricas esté vacía", () => {
    const result = (extra = "") => EXAMPLE + "test_results:\n  - {value: 5, test: \"Protocolo 2026\", metric: estrellas, "
      + `source_id: pruebas-eu, url: "https://www.pruebas.example/acme-volta", retrieved: 2026-09-20, tier: T2${extra}}\n`;
    // Everything else about it is right: the metric is the only failure.
    assert.deepEqual(run(result()), ["data/raw/acme/volta.yaml: test_results[0].metric: estrellas is not in the list of data-model.md"]);
    assert.match(run(result().replace("tier: T2", "tier: T3")).join(), /test_results\[0\]\.tier: must be T2/);
    assert.match(run(result().replace(', url: "https://www.pruebas.example/acme-volta"', "")).join(), /test_results\[0\]: missing url/);
    assert.match(run(result(", summary: x")).join(), /test_results\[0\]\.summary: unknown key/);
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

describe("validateData (ADR-0010)", () => {
  /** Writes a whole data/ tree and validates all of it, as the CI does. */
  function validate(files: Record<string, string | Buffer>, today = TODAY) {
    const dir = mkdtempSync(join(tmpdir(), "validate-"));
    for (const [f, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      writeFileSync(join(dir, f), body);
    }
    try {
      return validateData(dir, today);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const messages = (r: { warnings: { message: string }[] }) => r.warnings.map((w) => w.message);

  test("the data-model example and its registry pass with nothing to say", () => {
    assert.deepEqual(validate({ ...SOURCES, [VOLTA]: EXAMPLE }), { checked: 3, errors: [], warnings: [] });
  });

  test("it checks every file, not just changed ones: a file citing a missing source fails", () => {
    const r = validate({ [CUPRA]: SOURCES[CUPRA], [VOLTA]: EXAMPLE });
    assert.ok(r.errors.some((e) => /source_id acme-es is not in the registry/.test(e)));
  });

  test("the old image shape only warns; mixing it with the new keys still fails", () => {
    const old = EXAMPLE.replace("images: []", "images: [{url: x, source_id: acme-es, retrieved: 2026-09-20, license: CC0, attribution: null}]");
    const r = validate({ ...SOURCES, [VOLTA]: old });
    assert.deepEqual(r.errors, []);
    assert.match(messages(r).join(), /images\[0\]: old shape \(url\)/);
    const mixed = old.replace("{url: x,", "{url: x, file: x, source_url: x, page_url: x,");
    assert.match(validate({ ...SOURCES, [VOLTA]: mixed }).errors.join(), /url cannot be mixed/);
  });

  test("point 5 warnings: stale price and source, unusable source, needs_review, orphan image", () => {
    const broken = SOURCES["data/sources/acme-es.yaml"] + "status: broken\n";
    const r = validate({
      ...SOURCES,
      "data/sources/acme-es.yaml": broken,
      [VOLTA]: EXAMPLE.replace("needs_review: false", "needs_review: true"),
      "data/images/acme/volta/old.png": "x",
      "data/images/.gitkeep": "",
    }, "2026-11-10");
    assert.deepEqual(r.errors, []);
    const all = messages(r).join("\n");
    assert.match(all, /versions\[0\]\.price\.retrieved 2026-09-20 is older than 45 days/);
    assert.match(all, /data\/sources\/acme-es\.yaml: last_verified 2026-09-20 is older than 45 days/);
    assert.match(all, /status: source acme-es is broken in the registry/);
    assert.match(all, /needs_review is true/);
    assert.match(all, /data\/images\/acme\/volta\/old\.png: not cited/);
    assert.doesNotMatch(all, /gitkeep/);
    assert.ok(r.warnings.filter((w) => w.stale).every((w) => /older than/.test(w.message)));
  });

  test("ADR-0017 warnings: stale review, query string, needs_review with reviews", () => {
    const body = (EXAMPLE + REVIEWS).replace("needs_review: false", "needs_review: true")
      .replace("acme-volta-80-awd", "acme-volta-80-awd?utm_source=x");
    const r = validate({ ...SOURCES, [MEDIUM_FILE]: MEDIUM, [VOLTA]: body }, "2026-11-10");
    assert.deepEqual(r.errors, []);
    const all = messages(r).join("\n");
    assert.match(all, /reviews: the model has needs_review, so they are not published/);
    assert.match(all, /reviews\[0\]\.url has a query string/);
    assert.match(all, /reviews\[1\]\.retrieved 2026-09-20 is older than 45 days/);
  });

  test("45 days is still fresh, 46 is stale", () => {
    const stale = (today: string) => validate({ ...SOURCES, [VOLTA]: EXAMPLE }, today).warnings.some((w) => w.file === VOLTA && w.stale);
    assert.equal(stale("2026-11-04"), false);
    assert.equal(stale("2026-11-05"), true);
  });

  test("today is Madrid's date: at 00:30 in Spain, UTC is still yesterday", () => {
    assert.equal(madridToday(new Date("2026-10-07T22:30:00Z")), "2026-10-08");
    assert.equal(madridToday(new Date("2026-01-15T23:30:00Z")), "2026-01-16");
  });

  test("the summary lists overdue brands and groups warnings by brand", () => {
    const md = summary({
      checked: 3,
      errors: [],
      warnings: [
        { file: VOLTA, message: `${VOLTA}: versions[0].price.retrieved 2026-09-20 is older than 45 days`, stale: true },
        { file: "data/sources/acme-es.yaml", message: "data/sources/acme-es.yaml: x", stale: false },
      ],
    });
    assert.match(md, /\*\*Marcas vencidas\*\* \(refresco mensual\): acme/);
    assert.match(md, /### acme\n- data\/raw\/acme\/volta\.yaml/);
    assert.match(md, /### registro\n- data\/sources\/acme-es\.yaml: x/);
  });

  test("the repo's real data/ has no errors", () => {
    const repo = join(import.meta.dirname, "..", "..");
    assert.deepEqual(validateData(repo, clock(new Date(), "Europe/Madrid").day).errors, []);
  });
});
