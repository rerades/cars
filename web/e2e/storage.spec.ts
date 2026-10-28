import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { stringify } from "yaml";
import { buildSite } from "./build-site.ts";
import { acme, imageEntry, pngBytes, sourced } from "../tests/fixtures.ts";

/**
 * RNF-5 / CA-7 (PRD-001): no catalog page creates cookies or writes to localStorage/sessionStorage.
 * Also ADR-0012: the page only asks for resources from its own origin.
 * Real data covers /coches/ and the pre-generated pages; the card with an image runs on test data
 * (no real YAML has the `file` field yet), built to a temp dir and served by a tiny static server.
 */

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/** Every hostname (with port) the pages asked for, across the whole run; printed at the end. */
const requestedHosts = new Set<string>();

/** Loads `url` (absolute) and checks cookies, storage and request origins. */
async function checkNoStorage(page: Page, url: string, opts: { expectImg?: boolean } = {}) {
  const origin = new URL(url).origin;
  const hosts = new Set<string>();
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.protocol === "http:" || u.protocol === "https:") hosts.add(u.host);
  });

  const response = await page.goto(url, { waitUntil: "networkidle" });
  expect(response?.ok(), `${url} did not respond OK (status ${response?.status()})`).toBe(true);
  if (opts.expectImg) await expect(page.locator("[data-results] img").first()).toBeVisible();

  // The context cookie jar holds cookies of every domain, third parties included.
  expect(await page.context().cookies(), `cookies after loading ${url}`).toEqual([]);
  const storage = await page.evaluate(() => ({
    local: Object.keys(window.localStorage),
    session: Object.keys(window.sessionStorage),
    cookie: document.cookie,
  }));
  expect(storage, `storage after loading ${url}`).toEqual({ local: [], session: [], cookie: "" });

  for (const h of hosts) requestedHosts.add(h);
  expect([...hosts], `hosts requested by ${url}`).toEqual([new URL(origin).host]);
}

async function exploreLinks(page: Page, prefix: string): Promise<string[]> {
  const hrefs = await page.locator("[data-explore] a").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  return hrefs.filter((h) => h.startsWith(prefix));
}

async function firstWithModels(request: APIRequestContext, links: string[]): Promise<string> {
  for (const href of links) {
    const res = await request.get(href);
    if (res.ok() && (await res.text()).includes("data-results")) return href;
  }
  throw new Error(`No page with models among: ${links.join(", ") || "(none)"}`);
}

test.describe("no cookies, no web storage (RNF-5, CA-7)", () => {
  // Serial: one worker runs beforeAll once. Parallel workers would each run `astro build` at the
  // same time in web/.astro and collide.
  test.describe.configure({ mode: "serial" });

  let brandUrl = "";
  let segmentUrl = "";
  let bandUrl = "";
  let tmp = "";
  let server: Server;
  let imageSiteUrl = "";

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    // Real pages: pick the first brand, segment and band page that list models.
    const base = test.info().project.use.baseURL!;
    const page = await browser.newPage();
    await page.goto(`${base}/coches/`);
    const abs = (links: string[]) => links.map((l) => new URL(l, base).toString());
    const request = page.context().request;
    brandUrl = await firstWithModels(request, abs(await exploreLinks(page, "/marcas/")));
    segmentUrl = await firstWithModels(request, abs(await exploreLinks(page, "/segmentos/")));
    bandUrl = await firstWithModels(
      request,
      abs([...(await exploreLinks(page, "/precio/")), ...(await exploreLinks(page, "/autonomia/"))]),
    );
    await page.close();

    // Test-data site with one card that has an image.
    tmp = mkdtempSync(join(tmpdir(), "cars-storage-"));
    const data = join(tmp, "data");
    const images = join(tmp, "images");
    const out = join(tmp, "out");
    mkdirSync(join(data, "acme"), { recursive: true });
    mkdirSync(join(images, "acme/withimage"), { recursive: true });
    writeFileSync(join(images, "acme/withimage/front.png"), pngBytes());
    const doc = {
      brand: "acme",
      brand_name: "Acme",
      model: "WithImage",
      status: sourced("on_sale"),
      segment: sourced("suv_compacto"),
      versions: [{ name: "x", wltp_km: sourced(300) }],
      images: [imageEntry({ file: "data/images/acme/withimage/front.png" })],
    };
    writeFileSync(join(data, "acme", "WithImage.yaml"), stringify(doc));
    writeFileSync(join(data, "acme", "Volta.yaml"), stringify(acme()));
    buildSite(out, { CARS_DATA_DIR: data, CARS_IMAGES_DIR: images });

    server = createServer((req, res) => {
      const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
      let file = join(out, path);
      if (!file.startsWith(out)) return void res.writeHead(403).end();
      try {
        if (statSync(file).isDirectory()) file = join(file, "index.html");
        const body = readFileSync(file);
        res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }).end(body);
      } catch {
        res.writeHead(404).end("not found");
      }
    });
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
    const addr = server.address();
    imageSiteUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });

  test.afterAll(() => {
    server?.close();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
    console.log(`[storage] hosts requested by the pages: ${[...requestedHosts].join(", ") || "(none)"}`);
  });

  test("/coches/ with filters and order from the query string", async ({ page, baseURL }) => {
    await checkNoStorage(page, `${baseURL}/coches/?marca=tesla,byd&segmento=suv_compacto&precio_max=60000&autonomia=300&traccion=awd&estado=venta&orden=precio-asc`);
  });

  test("home page (PRD-004, CA-10)", async ({ page, baseURL }) => {
    await checkNoStorage(page, `${baseURL}/`);
  });

  test("/coches/ without query string", async ({ page, baseURL }) => {
    await checkNoStorage(page, `${baseURL}/coches/`);
  });

  test("brand page", async ({ page }) => {
    await checkNoStorage(page, brandUrl);
  });

  test("segment page", async ({ page }) => {
    await checkNoStorage(page, segmentUrl);
  });

  test("band page (price or range)", async ({ page }) => {
    await checkNoStorage(page, bandUrl);
  });

  /**
   * PRD-003 CA-12 on test data: loads /comparar/, runs `actions` and checks the same things as
   * checkNoStorage, plus that every fetch/XHR goes to /comparar/datos/ of the own origin.
   */
  async function checkComparator(page: Page, query: string, actions: (page: Page) => Promise<void> = async () => {}) {
    const dataRequests: string[] = [];
    const hosts = new Set<string>();
    page.on("request", (req) => {
      const u = new URL(req.url());
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
      hosts.add(u.host);
      if (req.resourceType() === "fetch" || req.resourceType() === "xhr") dataRequests.push(`${u.host}${u.pathname}`);
    });
    const host = new URL(imageSiteUrl).host;
    const response = await page.goto(`${imageSiteUrl}/comparar/${query}`, { waitUntil: "networkidle" });
    expect(response?.ok()).toBe(true);
    await expect(page.locator("[data-loading]")).toBeHidden();
    await expect(page.locator("[data-chosen]")).toBeVisible();
    await actions(page);
    await page.waitForLoadState("networkidle");

    expect(await page.context().cookies(), "cookies in the comparator").toEqual([]);
    const storage = await page.evaluate(() => ({
      local: Object.keys(window.localStorage),
      session: Object.keys(window.sessionStorage),
      cookie: document.cookie,
    }));
    expect(storage).toEqual({ local: [], session: [], cookie: "" });
    expect([...hosts]).toEqual([host]);
    expect(dataRequests.length, "the comparator asks for its data").toBeGreaterThan(0);
    for (const r of dataRequests) expect(r.startsWith(`${host}/comparar/datos/`), `data request ${r}`).toBe(true);
    for (const h of hosts) requestedHosts.add(h);
  }

  test("/comparar/ without a selection (CA-12)", async ({ page }) => {
    await checkComparator(page, "");
  });

  test("/comparar/ with one selection (CA-12)", async ({ page }) => {
    await checkComparator(page, `?v=${encodeURIComponent("acme/Volta")}`);
  });

  test("/comparar/ after adding, changing version and removing (CA-12)", async ({ page }) => {
    await checkComparator(page, `?v=${encodeURIComponent("acme/Volta")}`, async (p) => {
      await p.locator("[data-add-select]").selectOption("acme/WithImage");
      await p.locator("[data-add-form] button[type=submit]").click();
      await expect(p.locator("[data-compare] thead th[scope=col]")).toHaveCount(2);
      await p.locator("[data-chosen-list] > li").first().locator("select").selectOption("Volta GT");
      await expect(p.locator("[data-compare] thead th[scope=col] [data-slot=name]").first()).toHaveText("Volta GT");
      await p.locator("[data-chosen-list] > li").last().locator("[data-slot=remove]").click();
      await expect(p.locator("[data-chosen-list] > li")).toHaveCount(1);
    });
  });

  /**
   * PRD-005 CA-15 / ADR-0015, detail 4: loads a ranking, runs `actions` and checks cookies, storage,
   * origins, and that every fetch/XHR goes to /rankings/datos/ of the own origin.
   * `expectData` is whether the page must have asked for the JSON (it only does when it filters).
   */
  async function checkRanking(
    page: Page,
    path: string,
    expectData: boolean,
    actions: (page: Page) => Promise<void> = async () => {},
  ) {
    const dataRequests: string[] = [];
    const hosts = new Set<string>();
    page.on("request", (req) => {
      const u = new URL(req.url());
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
      hosts.add(u.host);
      if (req.resourceType() === "fetch" || req.resourceType() === "xhr") dataRequests.push(`${u.host}${u.pathname}`);
    });
    const base = test.info().project.use.baseURL!;
    const host = new URL(base).host;
    const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    expect(response?.ok(), `${path} status ${response?.status()}`).toBe(true);
    await expect(page.locator("[data-filter-price]")).toBeVisible();
    await actions(page);
    await page.waitForLoadState("networkidle");

    expect(await page.context().cookies(), `cookies in ${path}`).toEqual([]);
    const storage = await page.evaluate(() => ({
      local: Object.keys(window.localStorage),
      session: Object.keys(window.sessionStorage),
      cookie: document.cookie,
    }));
    expect(storage).toEqual({ local: [], session: [], cookie: "" });
    expect([...hosts]).toEqual([host]);
    if (expectData) expect(dataRequests.length, "the ranking asks for its data").toBeGreaterThan(0);
    for (const r of dataRequests) expect(r.startsWith(`${host}/rankings/datos/`), `data request ${r}`).toBe(true);
    for (const h of hosts) requestedHosts.add(h);
  }

  test("ranking without filters (PRD-005, CA-15)", async ({ page }) => {
    await checkRanking(page, "/rankings/mas-autonomia/", false);
  });

  test("ranking with filters in the URL (PRD-005, CA-15)", async ({ page }) => {
    await checkRanking(page, "/rankings/mas-autonomia/?precio=de-30000-a-45000-euros", true);
  });

  test("ranking after changing both selects (PRD-005, CA-15)", async ({ page }) => {
    await checkRanking(page, "/rankings/mas-baratos/", true, async (p) => {
      const pick = async (sel: string) => {
        const value = await p.locator(`${sel} option:not([value=""])`).first().getAttribute("value");
        await p.locator(sel).focus();
        await p.locator(sel).selectOption(value!);
      };
      await pick("[data-filter-segment]");
      await pick("[data-filter-price]");
      await p.waitForLoadState("networkidle");
      await expect(p.locator("[data-filter-price]")).not.toHaveValue("");
    });
  });

  test("page with a card with an image (test data)", async ({ page }) => {
    await checkNoStorage(page, `${imageSiteUrl}/coches/?orden=precio-desc`, { expectImg: true });
  });
});
