import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import { stringify } from "yaml";
import { buildSite } from "./build-site.ts";
import { acme } from "../tests/fixtures.ts";

/**
 * PRD-001 filters, keyboard behaviour in a real browser: Esc closes the open panel, the opener's
 * aria-expanded goes back to false and the focus returns to the button that opened it (desktop pill and mobile toggle).
 */

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
};

test.describe("catalog filters: Esc closes the panel", () => {
  test.describe.configure({ mode: "serial" });

  let tmp = "";
  let server: Server;
  let site = "";

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    tmp = mkdtempSync(join(tmpdir(), "cars-filtros-"));
    const data = join(tmp, "data");
    const out = join(tmp, "out");
    mkdirSync(join(data, "acme"), { recursive: true });
    writeFileSync(join(data, "acme", "Volta.yaml"), stringify(acme()));
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

  test("desktop: Esc closes the group panel, aria-expanded is false and the focus is back on the pill", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${site}/coches/`);
    const pill = page.locator("[data-group-toggle]").first();
    const panel = page.locator("#filtros-cuerpo");
    await expect(pill).toBeVisible();
    await expect(pill).toHaveAttribute("aria-expanded", "false");
    await pill.click();
    await expect(pill).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(pill).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
    await expect(pill).toBeFocused();
  });

  test("mobile: Esc closes the panel, aria-expanded is false and the focus is back on the toggle", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(`${site}/coches/`);
    const toggle = page.locator("[data-filters-toggle]");
    const panel = page.locator("#filtros-cuerpo");
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
  });
});
