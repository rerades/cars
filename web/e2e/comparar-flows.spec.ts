import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { stringify } from "yaml";
import { buildSite } from "./build-site.ts";
import { acme, sourced } from "../tests/fixtures.ts";

/**
 * PRD-003 story #326: the comparator flows in a real browser against test data built to a temp
 * dir (CA-2, CA-9 to CA-11, CA-13, CA-14, CA-17, CA-19), including the focus after removing a
 * column (CA-10, focusAfterRemove) and after changing a version (CA-9). Storage (CA-12) lives in
 * storage.spec.ts and the axe check in a11y.spec.ts.
 */

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
};

const v = (model: string, name?: string) =>
  `v=${encodeURIComponent(name ? `acme/${model}/${name}` : `acme/${model}`)}`;

/** A model of the fictional brand with the given versions: `[name, price | null, wltp_km]`. */
function model(name: string, versions: [string, number | null, number][], extra: Record<string, unknown> = {}) {
  return {
    brand: "acme",
    brand_name: "Acme",
    model: name,
    status: sourced("on_sale"),
    segment: sourced("suv_compacto"),
    needs_review: false,
    versions: versions.map(([vn, price, km]) => ({
      name: vn,
      wltp_km: sourced(km),
      price: price === null ? null : sourced(price, { unit: "EUR", price_kind: "pvp" }),
    })),
    ...extra,
  };
}

test.describe("comparator flows (story #326)", () => {
  test.describe.configure({ mode: "serial" });

  let tmp = "";
  let server: Server;
  let site = "";

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    tmp = mkdtempSync(join(tmpdir(), "cars-comparar-flows-"));
    const data = join(tmp, "data");
    const out = join(tmp, "out");
    mkdirSync(join(data, "acme"), { recursive: true });
    const write = (file: string, doc: unknown) => writeFileSync(join(data, "acme", `${file}.yaml`), stringify(doc));
    write("Volta", acme()); // GT (no price), 60 (39.990 €), 80 AWD (47.500 €, financed)
    write("Bolt", model("Bolt", [["Bolt Max", 42000, 550], ["Bolt Eco", 35000, 400]])); // default: Eco
    write("Nova", model("Nova", [["Nova A", null, 300], ["Nova B", null, 350]])); // no price: first in file
    write("Old", model("Old", [["Old 1", 20000, 200]], { status: sourced("discontinued") }));
    write("Review", model("Review", [["Review 1", 21000, 210]], { needs_review: true }));
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

  const names = (page: Page) => page.locator("[data-compare] thead th[scope=col] [data-slot=name]");
  const urlNames = (page: Page) => new URLSearchParams(new URL(page.url()).search).getAll("v");
  const removeButton = (page: Page, i: number) => page.locator("[data-chosen-list] > li").nth(i).locator("[data-slot=remove]");
  const versionSelect = (page: Page, i: number) => page.locator("[data-chosen-list] > li").nth(i).locator("select");
  const addSelect = (page: Page) => page.locator("[data-add-select]");

  test("CA-2: a URL with 4 valid versions shows the first 3 and a notice, never a 4th column", async ({ page }) => {
    await page.goto(`${site}/comparar/?${v("Volta", "Volta GT")}&${v("Volta", "Volta 60")}&${v("Volta", "Volta 80 AWD")}&${v("Bolt")}`);
    await expect(names(page)).toHaveText(["Volta GT", "Volta 60", "Volta 80 AWD"]);
    await expect(page.locator("[data-url-notice]")).toContainText("El enlace tenía más de 3 coches. Se muestran los 3 primeros.");
    expect(urlNames(page)).toHaveLength(3);
  });

  test("CA-9: default version is the cheapest, or the first in the file without prices", async ({ page }) => {
    await page.goto(`${site}/comparar/?${v("Bolt")}&${v("Nova")}`);
    await expect(names(page)).toHaveText(["Bolt Eco", "Nova A"]);
  });

  test("CA-9: changing the version updates the column and the URL, and the focus stays on its select", async ({ page }) => {
    await page.goto(`${site}/comparar/?${v("Bolt")}&${v("Nova")}`);
    await expect(names(page)).toHaveText(["Bolt Eco", "Nova A"]);
    const range = page.locator("[data-compare] td[headers='cmp-col-1 cmp-f-autonomia']");
    await expect(range).toContainText("400");
    const select = versionSelect(page, 0);
    await select.focus();
    await select.selectOption("Bolt Max");
    await expect(names(page)).toHaveText(["Bolt Max", "Nova A"]);
    await expect(range).toContainText("550");
    expect(urlNames(page)).toEqual(["acme/Bolt/Bolt Max", "acme/Nova/Nova A"]);
    // Table and list are redrawn; the focus is on the new select of the same column (WCAG 3.2.2).
    await expect(versionSelect(page, 0)).toBeFocused();
    await expect(versionSelect(page, 0)).toHaveValue("Bolt Max");
  });

  test("CA-9: a version taken by another column of the same model is not selectable", async ({ page }) => {
    await page.goto(`${site}/comparar/?${v("Volta", "Volta 60")}&${v("Volta", "Volta GT")}`);
    await expect(names(page)).toHaveText(["Volta 60", "Volta GT"]);
    await expect(versionSelect(page, 0).locator("option", { hasText: "Volta GT" })).toBeDisabled();
    await expect(versionSelect(page, 1).locator("option", { hasText: "Volta 60" })).toBeDisabled();
  });

  test("CA-10: removing a column leaves 2 and the focus goes to the remove button of the same position", async ({ page }) => {
    await page.goto(`${site}/comparar/?${v("Volta", "Volta GT")}&${v("Volta", "Volta 60")}&${v("Bolt")}`);
    await expect(names(page)).toHaveCount(3);
    await removeButton(page, 1).click();
    await expect(names(page)).toHaveText(["Volta GT", "Bolt Eco"]);
    await expect(page.locator("[data-compare]")).not.toContainText("Volta 60");
    expect(urlNames(page)).toEqual(["acme/Volta/Volta GT", "acme/Bolt/Bolt Eco"]);
    // focusAfterRemove(1, 2): same position.
    await expect(removeButton(page, 1)).toBeFocused();
  });

  test("CA-10: removing the last column moves the focus to the previous one; removing the only one, to «Añadir»", async ({ page }) => {
    await page.goto(`${site}/comparar/?${v("Volta", "Volta GT")}&${v("Bolt")}`);
    await expect(names(page)).toHaveCount(2);
    await removeButton(page, 1).click();
    await expect(removeButton(page, 0)).toBeFocused(); // focusAfterRemove(1, 1)
    await removeButton(page, 0).click();
    await expect(addSelect(page)).toBeFocused(); // focusAfterRemove(0, 0)
    await expect(page.locator("[data-chosen-list] > li")).toHaveCount(0);
  });

  test("CA-10: adding at 2 gives 3 columns and the form is replaced by the text of the maximum", async ({ page }) => {
    await page.goto(`${site}/comparar/?${v("Volta", "Volta 60")}&${v("Bolt")}`);
    await expect(names(page)).toHaveCount(2);
    await expect(page.locator("[data-add-form]")).toBeVisible();
    // Same model, another version: Volta 60 is taken, so the next one in sheet order enters.
    await addSelect(page).selectOption("acme/Volta");
    await page.locator("[data-add-form] button[type=submit]").click();
    await expect(names(page)).toHaveText(["Volta 60", "Bolt Eco", "Volta 80 AWD"]);
    await expect(page.locator("[data-add-form]")).toBeHidden();
    await expect(page.locator("[data-max-text]")).toBeVisible();
    await expect(page.locator("[data-max-text]")).toContainText("3");
    expect(urlNames(page)).toHaveLength(3);
    // Quitting one opens the form again.
    await removeButton(page, 0).click();
    await expect(page.locator("[data-add-form]")).toBeVisible();
    await expect(page.locator("[data-max-text]")).toBeHidden();
  });

  test("CA-10: a model with every version in the comparison cannot be added again", async ({ page }) => {
    await page.goto(`${site}/comparar/?${v("Bolt", "Bolt Eco")}&${v("Bolt", "Bolt Max")}`);
    await expect(names(page)).toHaveText(["Bolt Eco", "Bolt Max"]);
    await expect(addSelect(page).locator("option", { hasText: "Bolt" })).toBeDisabled();
    await expect(addSelect(page).locator("option", { hasText: "Volta" })).toBeEnabled();
  });

  test("CA-11: the copied URL opens in a fresh session with the same versions, order and data", async ({ page, browser }) => {
    await page.goto(`${site}/comparar/?${v("Bolt")}&${v("Volta", "Volta GT")}`);
    await versionSelect(page, 0).selectOption("Bolt Max");
    await addSelect(page).selectOption("acme/Nova");
    await page.locator("[data-add-form] button[type=submit]").click();
    await expect(names(page)).toHaveText(["Bolt Max", "Volta GT", "Nova A"]);
    const copied = page.url();
    const table = (p: Page) => p.locator("[data-compare] table").innerText();
    const before = await table(page);

    const ctx = await browser.newContext();
    const fresh = await ctx.newPage();
    await fresh.goto(copied);
    await expect(names(fresh)).toHaveText(["Bolt Max", "Volta GT", "Nova A"]);
    expect(await table(fresh)).toBe(before);
    await ctx.close();
  });

  test("CA-13: invalid, repeated and excluded versions are ignored with a notice and no error", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const url = `${site}/comparar/?${v("Review")}&${v("Volta", "No such version")}&${v("Volta", "Volta 60")}&${v("Volta", "Volta 60")}&${v("Bolt")}&${v("Old")}`;
    await page.goto(url);
    await expect(names(page)).toHaveText(["Volta 60", "Bolt Eco"]);
    await expect(page.locator("[data-url-notice]")).toContainText("No se ha podido incluir 4 coches del enlace");
    await expect(page.locator("[data-error]")).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("CA-13: a discontinued or needs_review model cannot be chosen in the comparator nor in the catalogue", async ({ page }) => {
    await page.goto(`${site}/comparar/?${v("Volta", "Volta 60")}`);
    await expect(addSelect(page).locator("option", { hasText: "Bolt" })).toHaveCount(1);
    await expect(addSelect(page).locator("option", { hasText: /^(Old|Review)/ })).toHaveCount(0);
    // The «Comparar» action of the catalogue card only exists for comparable models.
    await page.goto(`${site}/coches/`);
    await expect(page.locator("[data-results] a.enlace-comparar[href*='acme%2FBolt'], [data-results] a.enlace-comparar[href*='acme/Bolt']").first()).toBeVisible();
    await expect(page.locator("a.enlace-comparar[href*='Review']")).toHaveCount(0);
    await expect(page.locator("a.enlace-comparar[href*='Old']")).toHaveCount(0);
  });

  for (const [label, query] of [
    ["without a selection", ""],
    ["with a single valid version", `?${v("Bolt")}`],
  ] as const) {
    test(`CA-14: /comparar/ ${label} asks for at least 2 cars, offers to add them and links to /coches`, async ({ page }) => {
      await page.goto(`${site}/comparar/${query}`);
      const chosen = page.locator("[data-chosen]");
      await expect(chosen).toBeVisible();
      await expect(chosen.locator("[data-empty-text]")).toContainText(query ? "al menos un coche más" : "al menos 2 coches");
      await expect(page.locator("[data-add-form]")).toBeVisible();
      await expect(chosen.locator("[data-empty-link]")).toHaveAttribute("href", "/coches");
      await expect(page.locator("[data-compare]")).toBeHidden();
      await expect(page.locator("table")).toHaveCount(0);
    });
  }

  test("CA-17: at 320 px with 3 columns every cell is inside the viewport and the marks are text", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`${site}/comparar/?${v("Volta", "Volta GT")}&${v("Volta", "Volta 60")}&${v("Volta", "Volta 80 AWD")}`);
    await expect(names(page)).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const outside = await page.locator("[data-compare] th, [data-compare] td").evaluateAll((els) =>
      els.filter((e) => e.getBoundingClientRect().right > 320.5).length,
    );
    expect(outside).toBe(0);
    // Without colour: «por confirmar» and «Precio con oferta» are words; the source mark is a number in text.
    await expect(page.locator("[data-compare] td[headers='cmp-col-1 cmp-f-precio']")).toContainText("por confirmar");
    await expect(page.locator("[data-compare] td[headers='cmp-col-3 cmp-f-precio']")).toContainText("Precio con oferta");
    await expect(page.locator("[data-compare] [data-mark]").first()).toContainText(/\[\d+\]/);
  });

  test("CA-19: with JavaScript off and a selection, the notice and the link to /coches are there, and no error", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${site}/comparar/?${v("Bolt")}&${v("Nova")}`);
    const notice = page.locator("[data-no-js]");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("necesita JavaScript");
    await expect(notice.locator("a")).toHaveAttribute("href", "/coches");
    for (const sel of ["[data-error]", "[data-loading]", "[data-compare]"]) await expect(page.locator(sel)).toBeHidden();
    expect(errors).toEqual([]);
    await ctx.close();
  });
});
