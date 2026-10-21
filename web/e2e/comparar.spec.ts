import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import { stringify } from "yaml";
import { buildSite } from "./build-site.ts";
import { acme } from "../tests/fixtures.ts";

/**
 * PRD-003 story #318 in a real browser: the script of ComparisonTable.astro against the built
 * /comparar/ page (CA-1, CA-3, CA-4, CA-6, CA-15, CA-17). Test data built to a temp dir.
 */

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
    const volta = acme();
    // One non-official datum (story #319, CA-5): dc_max_kw of Volta 80 AWD comes from a T3 source.
    const awd = volta.versions.find((x: any) => x.name === "Volta 80 AWD");
    awd.dc_max_kw = { ...awd.dc_max_kw, tier: "T3", url: "https://hibridosyelectricos.com/volta", source_id: "hye" };
    writeFileSync(join(data, "acme", "Volta.yaml"), stringify(volta));
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

  test("CA-5: price shows source and date beside the figure; the rest carry numbered marks to «Fuentes»", async ({ page }) => {
    await page.goto(`${site}/comparar/?${three}`);
    // Price: «Fuente: {fuente}, {fecha}» linked to price.url, no mark, never «fuente no oficial» (T1).
    const p60 = page.locator("[data-compare] td[headers='cmp-col-2 cmp-f-precio']");
    await expect(p60).toContainText("Fuente: acme.example, 20 sep 2026");
    await expect(p60.locator("a[data-slot=sourceLink]")).toHaveAttribute("href", "https://www.acme.example/es/volta/precios");
    await expect(p60.locator("[data-mark]")).toHaveCount(0);
    // «por confirmar» has no source and no mark.
    const dc1 = page.locator("[data-compare] td[headers='cmp-col-1 cmp-f-cargaCc']");
    await expect(dc1.locator("[data-mark]")).toHaveCount(0);
    // A T1 datum: mark [1] to the ficha source, without «fuente no oficial».
    const range = page.locator("[data-compare] td[headers='cmp-col-1 cmp-f-autonomia']");
    await expect(range.locator("[data-mark] a")).toHaveAttribute("href", "#cmp-fuente-1");
    await expect(range.locator("[data-mark]")).not.toContainText("fuente no oficial");
    // The T3 datum: another number and «fuente no oficial» beside the mark.
    const dc3 = page.locator("[data-compare] td[headers='cmp-col-3 cmp-f-cargaCc']");
    await expect(dc3.locator("[data-mark] a")).toHaveAttribute("href", "#cmp-fuente-2");
    await expect(dc3.locator("[data-mark]")).toContainText("fuente no oficial");
    // «Fuentes» block: h2, ol with li#cmp-fuente-{n}[tabindex=-1], domain, date, link to the url.
    await expect(page.locator("h2", { hasText: "Fuentes" })).toBeVisible();
    const items = page.locator("ol > li[id^=cmp-fuente-]");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveAttribute("id", "cmp-fuente-1");
    await expect(items.nth(0)).toHaveAttribute("tabindex", "-1");
    await expect(items.nth(0)).toContainText("acme.example, consultado el 20 sep 2026.");
    await expect(items.nth(0)).not.toContainText("Fuente no oficial");
    await expect(items.nth(0).locator("a")).toHaveAttribute("href", "https://www.acme.example/es/volta/ficha");
    await expect(items.nth(1)).toContainText("hibridosyelectricos.com, consultado el 20 sep 2026. Fuente no oficial.");
    await expect(items.nth(1).locator("a")).toHaveAttribute("href", "https://hibridosyelectricos.com/volta");
    // Every mark leads to an existing entry.
    for (const href of await page.locator("[data-compare] [data-mark] a").evaluateAll((els) => els.map((e) => e.getAttribute("href")))) {
      await expect(page.locator(href!)).toHaveCount(1);
    }
  });

  test("CA-5: «Fuentes» does not exist with fewer than 2 versions", async ({ page }) => {
    await page.goto(`${site}/comparar/?${v("Volta GT")}`);
    await expect(page.locator("[data-sources]")).toBeHidden();
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
