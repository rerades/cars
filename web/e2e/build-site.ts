import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Builds the site to `out` with test data, one build at a time across all Playwright workers.
 *
 * Every `astro build` run from web/ shares two directories. With `--outDir` outside the cwd,
 * Astro stages prerender chunks in web/.astro/.prerender/ and deletes them when done; and Vite
 * optimizes deps into web/node_modules/.vite/deps. With fullyParallel, several spec files build
 * at once and collide ("Cannot find module .../.astro/.prerender/chunks/server_*.mjs", or
 * "ENOTEMPTY ... .vite/deps"). A lock directory (mkdir is atomic) makes the builds run in series.
 */

const WEB = join(import.meta.dirname, "..");
// Inside web/node_modules: one lock per checkout, since each has its own .astro and .vite.
const LOCK = join(WEB, "node_modules", ".e2e-build.lock");
// A build takes well under this; an older lock was left by a killed worker (Ctrl-C skips the
// finally). Shorter than WAIT_MS so waiters break it instead of timing out.
const STALE_MS = 2 * 60_000;
const WAIT_MS = 4 * 60_000;

const SLEEPER = new Int32Array(new SharedArrayBuffer(4));
const sleep = (ms: number) => Atomics.wait(SLEEPER, 0, 0, ms);

function acquire(): void {
  const start = Date.now();
  for (;;) {
    try {
      mkdirSync(LOCK);
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
    try {
      if (Date.now() - statSync(LOCK).mtimeMs > STALE_MS) rmSync(LOCK, { recursive: true, force: true });
    } catch {
      // The holder released it between the two calls: try again.
    }
    if (Date.now() - start > WAIT_MS) throw new Error(`Timed out waiting for the build lock ${LOCK}`);
    sleep(250);
  }
}

export function buildSite(out: string, env: Record<string, string>): void {
  acquire();
  try {
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, ...env },
      stdio: "pipe",
    });
  } finally {
    rmSync(LOCK, { recursive: true, force: true });
  }
}
