import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import { stringify } from "yaml";
import { buildSite } from "./build-site.ts";
import { acme, sourced } from "../tests/fixtures.ts";

/**
 * PRD-002 CA-3 in a real browser: at 1280 px the comparison table is visible and the blocks are
 * not; at 320 px the blocks are visible, the table is not and the page has no horizontal scroll
 * (WCAG 1.4.10). Test data built to a temp dir, served by a tiny static server.
 */

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css" };

test.describe("model page versions (CA-3, CA-11)", () => {
  test.describe.configure({ mode: "serial" });

  let tmp = "";
  let server: Server;
  let site = "";

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    tmp = mkdtempSync(join(tmpdir(), "cars-versiones-"));
    const data = join(tmp, "data");
    const out = join(tmp, "out");
    mkdirSync(join(data, "acme"), { recursive: true });
    writeFileSync(join(data, "acme", "Volta.yaml"), stringify(acme()));
    writeFileSync(
      join(data, "acme", "Soon.yaml"),
      stringify({ brand: "acme", brand_name: "Acme", model: "Soon", status: sourced("announced"), versions: [] }),
    );
    buildSite(out, { CARS_DATA_DIR: data });
    server = createServer((req, res) => {
      const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
      let file = join(out, path);
      if (!file.startsWith(out)) return void res.writeHead(403).end();
      try {
        if (statSync(file).isDirectory()) file = join(file, "index.html");
        res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
      } catch {
        res.writeHead(404).end("not found");
      }
    });
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
    const addr = server.address();
    site = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });

  test.afterAll(() => {
    server?.close();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  const expected = ["Volta 60", "Volta 80 AWD", "Volta GT"];

  test("1280 px: the table is visible, in order, and the blocks are hidden", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${site}/marcas/acme/Volta/`);
    await expect(page.locator("[data-versiones-tabla] table")).toBeVisible();
    await expect(page.locator("[data-versiones-bloques]")).toBeHidden();
    await expect(page.locator("[data-versiones-tabla] th[scope=col]")).toHaveText(expected);
  });

  test("320 px: the blocks are visible, in order, the table is hidden and nothing scrolls sideways", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`${site}/marcas/acme/Volta/`);
    await expect(page.locator("[data-versiones-bloques]")).toBeVisible();
    await expect(page.locator("[data-versiones-tabla]")).toBeHidden();
    await expect(page.locator("[data-versiones-bloques] h3")).toHaveText(expected);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("CA-11: announced model with versions: [] shows the section and the empty text, no table or blocks", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${site}/marcas/acme/Soon/`);
    await expect(page.getByRole("heading", { level: 2, name: "Versiones" })).toBeVisible();
    await expect(page.getByText("Acme todavía no ha publicado las versiones de este modelo.")).toBeVisible();
    await expect(page.locator("table, [data-versiones-bloques]")).toHaveCount(0);
  });

  test("no cookies or web storage", async ({ page }) => {
    await page.goto(`${site}/marcas/acme/Volta/`);
    expect(await page.context().cookies()).toEqual([]);
    const storage = await page.evaluate(() => ({ l: localStorage.length, s: sessionStorage.length, c: document.cookie }));
    expect(storage).toEqual({ l: 0, s: 0, c: "" });
  });
});
