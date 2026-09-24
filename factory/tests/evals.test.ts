/** Tests for the deterministic evals. Run: npm test */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { changedFiles, runEvals } from "../evals.ts";

const TODAY = "2026-09-23";
const REGISTRY = `sources:
  - id: cupra-es
    tier: T1
    urls: { home: https://www.cupra.com/es-es/ }
    last_verified: 2026-09-23
`;

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
  test("el registro y los datos correctos pasan", () => {
    const r = evalFiles({ "data/sources/registry.yaml": REGISTRY, "data/raw/cupra/born.yaml": value({}) });
    assert.deepEqual(r, { passed: 3, failed: [] });
  });
  test("el registro actual del repo pasa", () => {
    const repo = join(import.meta.dirname, "..", "..");
    assert.deepEqual(runEvals("researcher", repo, ["data/sources/registry.yaml"], ["data/"], TODAY).failed, []);
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
    assert.deepEqual(failed, [
      "data/raw/cupra/born.yaml: battery_kwh: missing url",
      "data/raw/cupra/born.yaml: battery_kwh: source_id inventada is not in the registry",
    ]);
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
