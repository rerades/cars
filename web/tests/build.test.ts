import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

// The real build, with no CARS_DATA_DIR from outside: pages are bundled, so the data dir must
// not depend on where the bundled module ends up (it once rendered an empty catalog).
test("the build reads the real data/raw without CARS_DATA_DIR", () => {
  const out = mkdtempSync(join(tmpdir(), "cars-build-"));
  const env = { ...process.env };
  delete env.CARS_DATA_DIR;
  execFileSync("pnpm", ["exec", "astro", "build", "--outDir", out], {
    cwd: resolve(import.meta.dirname, ".."),
    env,
    stdio: "pipe",
  });
  const html = readFileSync(join(out, "index.html"), "utf8");
  assert.ok((html.match(/<h2/g) ?? []).length > 0, "the home page lists no model");
});
