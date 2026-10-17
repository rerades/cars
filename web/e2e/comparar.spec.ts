import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import { stringify } from "yaml";
import { acme } from "../tests/fixtures.ts";

/**
 * PRD-003 story #318 in a real browser: the script of ComparisonTable.astro against the built
 * /comparar/ page (CA-1, CA-3, CA-4, CA-6, CA-15, CA-17). Test data built to a temp dir.
 */

const WEB = join(import.meta.dirname, "..");
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
};

const v = (name: string) => `v=${encodeURIComponent(`acme/Volta/${name}`)}`;

test.describe("comparator table (story #318)", () => {
  test.describe.configure({ mode: "serial" });

  let tmp = "";
  let server: Server;
  let site = "";

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    tmp = mkdtempSync(join(tmpdir(), "cars-comparar-"));
    const data = join(tmp, "data");
    const out = join(tmp, "out");
    mkdirSync(join(data, "acme"), { recursive: true });
    writeFileSync(join(data, "acme", "Volta.yaml"), stringify(acme()));
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
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

  const three = `${v("Volta GT")}&${v("Volta 60")}&${v("Volta 80 AWD")}`;

  test("CA-1: 3 columns in URL order, each with brand, model, name and a link to the model page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${site}/comparar/?${three}`);
    const cols = page.locator("[data-compare] thead th[scope=col]");
    await expect(cols).toHaveCount(3);
    await expect(page.locator("[data-compare] thead th[scope=col] [data-slot=name]")).toHaveText([
      "Volta GT",
      "Volta 60",
      "Volta 80 AWD",
    ]);
    for (let i = 0; i < 3; i++) {
      await expect(cols.nth(i)).toContainText("Acme");
      await expect(cols.nth(i).locator("a")).toHaveAttribute("href", "/marcas/acme/Volta/");
      await expect(cols.nth(i).locator("a")).toContainText("(ficha del modelo)");
    }
  });

  test("CA-3, CA-15: 7 rows in design order, same for every column; no best/worst marks", async ({ page }) => {
    await page.goto(`${site}/comparar/?${three}`);
    await expect(page.locator("[data-compare] tbody")).toHaveCount(7);
    const labels = await page.locator("[data-compare] tbody th[id^=cmp-f-]").evaluateAll((els) => els.map((e) => e.id));
    expect(labels).toEqual(
      ["precio", "autonomia", "bateria", "potencia", "traccion", "cargaCc", "cargaCa"].map((f) => `cmp-f-${f}`),
    );
    await expect(page.locator("[data-compare] tbody tr:has(td)")).toHaveCount(7);
    for (const row of await page.locator("[data-compare] tbody tr:has(td)").all()) {
      await expect(row.locator("td")).toHaveCount(3);
    }
    // Battery basis: gross is indicated as gross (Volta 80 AWD is the third column).
    const battery = page.locator("[data-compare] td[headers='cmp-col-3 cmp-f-bateria']");
    await expect(battery).toContainText("bruta");
    await expect(page.locator("[data-compare] tbody tr[class*=bg-], [data-compare] [aria-label*=mejor i]")).toHaveCount(0);
  });

  test("CA-4: missing datum says «por confirmar» without figures; the ac row stays with all «por confirmar»", async ({ page }) => {
    await page.goto(`${site}/comparar/?${three}`);
    // Order: GT, 60, 80 AWD. dc_max: only 80 AWD has it.
    const dc = (n: number) => page.locator(`[data-compare] td[headers='cmp-col-${n} cmp-f-cargaCc'] [data-slot=text]`);
    await expect(dc(1)).toHaveText("por confirmar");
    await expect(dc(2)).toHaveText("por confirmar");
    await expect(dc(3)).toContainText("150");
    expect(await dc(1).textContent()).not.toMatch(/\d/);
    for (let n = 1; n <= 3; n++) {
      await expect(page.locator(`[data-compare] td[headers='cmp-col-${n} cmp-f-cargaCa'] [data-slot=text]`)).toHaveText("por confirmar");
    }
  });

  test("CA-6: financed price shows the label, the literal terms and a link; pvp shows no label; note beside the datum", async ({ page }) => {
    await page.goto(`${site}/comparar/?${three}`);
    const price = (n: number) => page.locator(`[data-compare] td[headers='cmp-col-${n} cmp-f-precio']`);
    await expect(price(3)).toContainText("Precio con oferta");
    await expect(price(2)).not.toContainText("Precio con oferta");
    const conditions = page.locator("[data-conditions]");
    await expect(conditions).toBeVisible();
    await expect(conditions).toContainText(
      "PVP recomendado financiando en Península y Baleares de 47.500 € (IVA, transporte y descuento de marca incluidos). Crédito mínimo de 10.000 € con permanencia de 48 meses.",
    );
    await expect(conditions.locator("a")).toHaveAttribute("href", "https://www.acme.example/es/volta/ofertas");
    await expect(page.locator("[data-compare] td[headers='cmp-col-3 cmp-f-potencia']")).toContainText("publicado: 299 CV");
  });

  test("the notice without JavaScript is removed once the table is mounted", async ({ page }) => {
    await page.goto(`${site}/comparar/?${three}`);
    await expect(page.locator("[data-compare]")).toBeVisible();
    await expect(page.locator("[data-no-js]")).toHaveCount(0);
  });

  test("the notice is in the served HTML when JavaScript is off", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`${site}/comparar/?${three}`);
    await expect(page.locator("[data-no-js]")).toBeVisible();
    await expect(page.locator("[data-compare]")).toBeHidden();
    await ctx.close();
  });

  test("replaceState: the short form is rewritten to the full form, in column order, without new history entries", async ({ page }) => {
    await page.goto(`${site}/comparar/`);
    const before = await page.evaluate(() => history.length);
    await page.goto(`${site}/comparar/?v=acme/Volta/Volta%20GT&v=acme/Volta`);
    await expect(page.locator("[data-compare] thead th[scope=col]")).toHaveCount(2);
    const search = await page.evaluate(() => location.search);
    const values = new URLSearchParams(search).getAll("v");
    // Short form = default version = the cheapest priced one (Volta 60).
    expect(values).toEqual(["acme/Volta/Volta GT", "acme/Volta/Volta 60"]);
    // Two loads (goto x2) => at most 2 more entries than before; replaceState adds none.
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(before + 1);
  });

  test("CA-17: at 320 px with 3 columns the page has no horizontal scroll and every datum is reachable", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`${site}/comparar/?${three}`);
    await expect(page.locator("[data-compare] thead th[scope=col]")).toHaveCount(3);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // "por confirmar" and the deal label are text, so they read without colour.
    await expect(page.locator("[data-compare] td[headers='cmp-col-1 cmp-f-cargaCa']")).toContainText("por confirmar");
    await expect(page.locator("[data-compare] td[headers='cmp-col-3 cmp-f-precio']")).toContainText("Precio con oferta");
  });

  test("no cookies or web storage", async ({ page }) => {
    await page.goto(`${site}/comparar/?${three}`);
    expect(await page.context().cookies()).toEqual([]);
    const storage = await page.evaluate(() => ({ l: localStorage.length, s: sessionStorage.length, c: document.cookie }));
    expect(storage).toEqual({ l: 0, s: 0, c: "" });
  });
});
