import { defineConfig } from "@playwright/test";

// Not Astro's default 4321: a dev or preview server already there would make `astro preview`
// silently move to another port and the config would wait for the wrong one.
const PORT = 4331;

// Browser tests (ADR-0006) live in e2e/, apart from tests/ (node --test). They run against the
// built static site served by `astro preview`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, javaScriptEnabled: true },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `pnpm run build && pnpm run preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/coches/`,
    // Always test a fresh build, never a stale server.
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
