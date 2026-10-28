import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { es } from "../src/lib/i18n.ts";
import { RANKING_SLUGS, startRankingsSite, TERMS, TERMS_URL, type RankingsSite } from "./rankings-site.ts";

/**
 * PRD-005 in the browser (story #378, ADR-0015 details 4 and 6), over a site built from test data
 * (see rankings-site.ts for the data). Covers CA-8 and CA-9 in the browser, the filtered empty state and
 * «Quitar filtros», the RF-15 note and the offer terms when filtering (CA-18), the error when the JSON
 * does not arrive, opening a URL with filters, no JSON request without filters, CA-14 without
 * JavaScript, and CA-2, CA-11, CA-13, CA-17 on the built pages.
 */

const AUTONOMY = "/rankings/mas-autonomia/";
const PRICE = "/rankings/mas-baratos/";
const DATA_PATH = "/rankings/datos/";

let site: RankingsSite;
test.describe.configure({ mode: "serial" }); // one worker builds the site once (see storage.spec.ts)

test.beforeAll(async () => {
  test.setTimeout(240_000);
  site = await startRankingsSite();
});
test.afterAll(() => site?.close());

const places = (page: Page) => page.locator("[data-ranking-list] > li");
const placeNames = (page: Page) => page.locator("[data-ranking-list] > li [data-version]").allTextContents();
const summary = (page: Page) => page.locator("[data-ranking-summary]");
const leftOut = (page: Page) => page.locator("[data-left-out]");
const segmentSelect = (page: Page) => page.locator("[data-filter-segment]");
const priceSelect = (page: Page) => page.locator("[data-filter-price]");

/** Opens a ranking and waits for the script to have mounted the selects. */
async function open(page: Page, path: string) {
  const res = await page.goto(`${site.url}${path}`);
  expect(res?.ok(), `${path} status ${res?.status()}`).toBe(true);
  await expect(priceSelect(page)).toBeVisible();
}

const fuera = (n: number, dato = es["ranking.autonomia.dato"]) =>
  n === 1
    ? es["ranking.fuera.uno"].replace("{dato}", dato)
    : es["ranking.fuera.n"].replace("{n}", String(n)).replace("{dato}", dato);

test.describe("filters in the browser (RF-8, RF-9, RF-15)", () => {
  test("no request for the JSON on load without filters; the first focus asks for it (ADR-0015, detail 3)", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes(DATA_PATH)) requests.push(new URL(r.url()).pathname);
    });
    await open(page, AUTONOMY);
    await page.waitForLoadState("networkidle");
    expect(requests, "requests for data on load without filters").toEqual([]);
    expect(await places(page).count()).toBe(5);

    await priceSelect(page).focus();
    await expect.poll(() => requests).toEqual([`${DATA_PATH}mas-autonomia.json`]);
  });

  test("the HTML list without filters: 1..5, no segment for Beta, summary and note", async ({ page }) => {
    await open(page, AUTONOMY);
    expect(await placeNames(page)).toEqual(["Beta Max", "Alpha Uno", "Alpha Dos", "Alpha Tres", "Gamma Mini"]);
    await expect(summary(page)).toHaveText("5 versiones");
    await expect(leftOut(page)).toHaveText(fuera(3));
  });

  test("CA-8: segment filter in the URL: only that segment, numbered 1..n; a model without segment is out", async ({ page }) => {
    await open(page, `${AUTONOMY}?segmento=suv_compacto`);
    await expect(segmentSelect(page)).toHaveValue("suv_compacto");
    await expect.poll(() => placeNames(page)).toEqual(["Alpha Uno", "Alpha Dos", "Alpha Tres"]);
    const numbers = await page.locator("[data-ranking-list] > li [data-place-value]").allTextContents();
    expect(numbers).toEqual(["1", "2", "3"]);
    const links = await page.locator("[data-place-link]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(links.every((h) => h === "/marcas/alfa/alpha/" || h === "/marcas/alfa/Alpha/"), links.join()).toBe(true);
    // Beta Max (700 km) has the most autonomy but no segment: not in the filtered ranking.
    expect(await placeNames(page)).not.toContain("Beta Max");
  });

  test("CA-9: price bands with 30,000, 30,001 and 45,000 €, and a version without price", async ({ page }) => {
    await open(page, `${AUTONOMY}?precio=hasta-30000-euros`);
    await expect.poll(() => placeNames(page)).toEqual(["Beta Max", "Alpha Uno"]); // 20,000 and 30,000
    await open(page, `${AUTONOMY}?precio=de-30000-a-45000-euros`);
    await expect.poll(() => placeNames(page)).toEqual(["Alpha Dos", "Alpha Tres"]); // 30,001 and 45,000
    await open(page, `${AUTONOMY}?precio=mas-de-45000-euros`);
    await expect(page.locator("[data-filtered-empty]")).toBeVisible(); // none of the three
    // Gamma Mini has the figure but no price: in no band, but in the unfiltered ranking (checked above).
    for (const q of ["hasta-30000-euros", "de-30000-a-45000-euros", "mas-de-45000-euros"]) {
      await open(page, `${AUTONOMY}?precio=${q}`);
      await page.waitForLoadState("networkidle");
      expect(await placeNames(page)).not.toContain("Gamma Mini");
    }
  });

  test("an invalid value in the query string is ignored: the HTML list stays and no JSON is asked for", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => r.url().includes(DATA_PATH) && requests.push(r.url()));
    await open(page, `${AUTONOMY}?segmento=nave_espacial&precio=gratis`);
    await page.waitForLoadState("networkidle");
    expect(requests).toEqual([]);
    expect(await places(page).count()).toBe(5);
    await expect(segmentSelect(page)).toHaveValue("");
    await expect(priceSelect(page)).toHaveValue("");
  });

  test("changing a select: list, URL, summary, RF-15 note and focus stay consistent; summary is the only live region", async ({ page }) => {
    await open(page, AUTONOMY);
    // The live region exists before the first change, so the first change is announced.
    await expect(summary(page)).toHaveAttribute("role", "status");
    await expect(summary(page)).toHaveAttribute("aria-live", "polite");
    expect(await page.locator("[role=status], [aria-live]").count()).toBe(1);

    await segmentSelect(page).focus(); // a visitor focuses the select before choosing; selectOption does not
    await segmentSelect(page).selectOption("suv_compacto");
    await expect.poll(() => placeNames(page)).toEqual(["Alpha Uno", "Alpha Dos", "Alpha Tres"]);
    await expect(summary(page)).toHaveText("3 versiones");
    // CA-18 with filters: the left-out versions of the filtered set (Alpha Sin, Alpha T3), not the 3 of the page.
    await expect(leftOut(page)).toHaveText(fuera(2));
    expect(new URL(page.url()).search).toBe("?segmento=suv_compacto");
    await expect(segmentSelect(page)).toBeFocused();

    await priceSelect(page).selectOption("de-30000-a-45000-euros");
    await expect.poll(() => placeNames(page)).toEqual(["Alpha Dos", "Alpha Tres"]);
    await expect(summary(page)).toHaveText("2 versiones");
    expect(new URL(page.url()).search).toBe("?segmento=suv_compacto&precio=de-30000-a-45000-euros");

    await segmentSelect(page).selectOption("urbano");
    await priceSelect(page).selectOption("");
    await expect.poll(() => placeNames(page)).toEqual(["Gamma Mini"]);
    await expect(summary(page)).toHaveText(es["ranking.resumen.uno"]);
    await expect(leftOut(page)).toHaveText(fuera(1));
    expect(new URL(page.url()).search).toBe("?segmento=urbano");
  });

  test("filtered empty state and «Quitar filtros»: selects, URL and focus on «Puestos»", async ({ page }) => {
    await open(page, `${AUTONOMY}?segmento=urbano&precio=mas-de-45000-euros`);
    const empty = page.locator("[data-filtered-empty]");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(es["ranking.vacioFiltros.texto"]);
    await expect(page.locator("[data-ranking-list]")).toBeHidden();
    await expect(summary(page)).toHaveText(es["ranking.resumen.ninguna"]);

    await page.getByRole("button", { name: es["ranking.filtros.quitar"] }).click();
    await expect(page.locator("[data-filtered-empty]")).toHaveCount(0);
    await expect(segmentSelect(page)).toHaveValue("");
    await expect(priceSelect(page)).toHaveValue("");
    expect(new URL(page.url()).search).toBe("");
    await expect(page.locator("#resultados")).toBeFocused();
    expect(await places(page).count()).toBe(5);
    await expect(summary(page)).toHaveText("5 versiones");
    await expect(leftOut(page)).toHaveText(fuera(3));
  });

  test("error when the JSON does not arrive: select goes back, list and URL unchanged, live region says so, retry works", async ({ page }) => {
    await open(page, AUTONOMY);
    await page.route(`**${DATA_PATH}*`, (route) => route.abort());
    await segmentSelect(page).focus();
    await segmentSelect(page).selectOption("suv_compacto");

    await expect(summary(page)).toHaveText(es["ranking.filtros.error"]);
    await expect(segmentSelect(page)).toHaveValue(""); // back to its previous value
    await expect(segmentSelect(page)).toBeFocused();
    expect(await places(page).count()).toBe(5); // the list never contradicts the selects
    expect(new URL(page.url()).search).toBe("");

    await page.unroute(`**${DATA_PATH}*`);
    await segmentSelect(page).selectOption("suv_compacto"); // the next change asks for the JSON again
    await expect.poll(() => placeNames(page)).toEqual(["Alpha Uno", "Alpha Dos", "Alpha Tres"]);
    await expect(summary(page)).toHaveText("3 versiones");
    await expect(segmentSelect(page)).toHaveValue("suv_compacto");
  });

  test("error when opening a URL with filters: the selects go back to match the HTML list", async ({ page }) => {
    await page.route(`**${DATA_PATH}*`, (route) => route.abort());
    await open(page, `${AUTONOMY}?segmento=suv_compacto`);
    await expect(summary(page)).toHaveText(es["ranking.filtros.error"]);
    await expect(segmentSelect(page)).toHaveValue("");
    expect(await places(page).count()).toBe(5);
  });

  test("offer terms are rebuilt for the places shown, with working links (RF-5 with filters)", async ({ page }) => {
    await open(page, PRICE);
    const terms = page.locator("[data-condiciones]");
    await expect(terms).toContainText(TERMS);
    await expect(terms.locator(`a[href="${TERMS_URL}"]`)).toHaveCount(1);

    await segmentSelect(page).selectOption("suv_compacto");
    await expect(summary(page)).toHaveText("5 versiones");
    await expect(terms).toContainText(TERMS);
    await expect(terms.locator("li")).toHaveCount(1);
    const refs = await page.locator("[data-terms-ref]").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    expect(refs).toHaveLength(1);
    await expect(page.locator(refs[0]!)).toHaveCount(1); // the anchor exists: the id is derived from the version

    // Alpha Dos (the financed one) is out of this band: no deal badge, no terms section.
    await priceSelect(page).selectOption("hasta-30000-euros");
    await expect.poll(() => placeNames(page)).toEqual(["Alpha Uno"]); // the segment filter is still on
    await expect(page.locator("[data-condiciones]")).toHaveCount(0);
    await expect(page.locator("[data-deal-badge]")).toHaveCount(0);

    await segmentSelect(page).selectOption("");
    await priceSelect(page).selectOption("");
    await expect(page.locator("[data-condiciones]")).toContainText(TERMS); // the HTML block is put back
  });
});

test.describe("page without JavaScript (CA-14, RNF-1)", () => {
  test.use({ javaScriptEnabled: false });

  for (const slug of RANKING_SLUGS) {
    test(`/rankings/${slug}/ has the whole list with figures and sources`, async ({ page }) => {
      await page.goto(`${site.url}/rankings/${slug}/?segmento=suv_compacto`);
      // The test data only has a figure in the autonomy and price rankings; the rest show the empty state.
      if (slug === "mas-autonomia" || slug === "mas-baratos") {
        const items = page.locator("[data-ranking-list] > li");
        expect(await items.count()).toBeGreaterThanOrEqual(5);
        for (const li of await items.all()) {
          await expect(li.locator("[data-figure-value]")).not.toBeEmpty();
          await expect(li.locator("[data-source-link]")).toHaveAttribute("href", /^https:\/\/www\.acme\.example\//);
          await expect(li.locator("[data-source-date]")).toHaveText(/\d{4}/);
        }
        // The query string does not filter without a script: it is the complete list.
        await expect(page.locator("[data-filter-price]")).toHaveCount(0);
        // (The `<noscript>` text is checked on the served HTML below: Playwright's "JavaScript off"
        // keeps the parser in scripting mode, so it does not render `<noscript>` content.)
      } else {
        await expect(page.locator("[data-ranking-empty]")).toBeVisible();
      }
    });
  }
});

test.describe("built HTML (CA-2, CA-11, CA-13)", () => {
  const html = (slug: string) => readFileSync(join(site.out, "rankings", slug, "index.html"), "utf8");
  const dataUrls = () => {
    const urls = new Set<string>([TERMS_URL]);
    for (const slug of ["mas-autonomia", "mas-baratos"]) {
      const json = readFileSync(join(site.out, "rankings", "datos", `${slug}.json`), "utf8");
      for (const m of json.matchAll(/"url":"([^"]+)"/g)) urls.add(m[1]!);
    }
    return urls;
  };

  test("CA-14: the served HTML says in a <noscript> that filtering needs JavaScript, and has no controls", async () => {
    for (const slug of ["mas-autonomia", "mas-baratos"]) {
      const page = html(slug);
      expect(page, slug).toMatch(new RegExp(`<noscript>[\\s\\S]*${es["ranking.filtros.sinJs"].replace(/[.]/g, "\\.")}[\\s\\S]*</noscript>`));
      // The selects live in a <template> the script clones; outside it there are none.
      expect(page.replace(/<template[\s\S]*?<\/template>/g, ""), slug).not.toMatch(/<select\b/);
    }
  });

  test("CA-11: no form, text field, account or rating elements; the controls only change the URL", async () => {
    for (const slug of RANKING_SLUGS) {
      const page = html(slug);
      expect(page, slug).not.toMatch(/<(form|input|textarea)\b/i);
      expect(page, slug).not.toMatch(/type=["']?(submit|text|search|email|password)/i);
      expect(page, slug).not.toMatch(/\b(iniciar sesión|mi cuenta|valora|reseña de usuario)\b/i);
    }
  });

  test("CA-2: no scores, averages, «mejor», «recomendado» nor badges; only the figures of the data", async () => {
    for (const slug of RANKING_SLUGS) {
      const text = html(slug).replace(/<(script|style|template)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ");
      expect(text, slug).not.toMatch(/\b(mejor(es)?|recomendad[oa]s?|puntuaci[oó]n|media|promedio|insignia)\b/i);
    }
    // Every figure on the autonomy page is one of the YAML values (RNF-6) and in km (one field only).
    const noTemplates = (slug: string) => html(slug).replace(/<template[\s\S]*?<\/template>/g, "");
    const figures = [...noTemplates("mas-autonomia").matchAll(/data-figure-value[^>]*>([^<]*)</g)].map((m) => m[1]!.trim());
    expect(figures.length).toBe(5);
    for (const f of figures) expect(f).toMatch(/^(700|500|450|400|300) km$/);
    const prices = [...noTemplates("mas-baratos").matchAll(/data-figure-value[^>]*>([^<]*)</g)].map((m) => m[1]!.replace(/\s/g, " ").trim());
    expect(prices.length).toBe(6);
    for (const p of prices) expect(p).toMatch(/^(20|30|31|32|45)[.  ]?(000|001) ?€$/);
  });

  test("CA-13: links go only to model pages, the catalog, the sources of the data and anchors", async () => {
    const allowed = dataUrls();
    for (const slug of RANKING_SLUGS) {
      const hrefs = [...html(slug).matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]!);
      expect(hrefs.length, slug).toBeGreaterThan(0);
      for (const href of hrefs) {
        if (href.startsWith("http")) expect(allowed.has(href), `${slug}: external link ${href} is not a source of the data`).toBe(true);
        else expect(href, slug).toMatch(/^(#|\/coches\/?|\/marcas\/[\w-]+\/[\w-]+\/?|\/comparar\/?(\?.*)?)/);
      }
    }
  });
});

test.describe("320 px wide (CA-17, RNF-3)", () => {
  test.use({ viewport: { width: 320, height: 700 }, isMobile: true });

  const noHorizontalScroll = async (page: Page) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  test("no horizontal scroll, with and without filters, and the marks are text, not colour", async ({ page }) => {
    for (const slug of RANKING_SLUGS) {
      // Without data (battery, power, charging in the test data) the page is the empty state: no controls.
      const res = await page.goto(`${site.url}/rankings/${slug}/`, { waitUntil: "networkidle" });
      expect(res?.ok(), slug).toBe(true);
      await noHorizontalScroll(page);
    }
    await open(page, AUTONOMY);
    // «fuente no oficial» is written (Beta Max is T2), next to its figure.
    await expect(page.getByText(es["ranking.noOficial"].replace("· ", ""), { exact: false }).first()).toBeVisible();
    await page.goto(`${site.url}${AUTONOMY}?segmento=suv_compacto&precio=de-30000-a-45000-euros`);
    await expect.poll(() => placeNames(page)).toEqual(["Alpha Dos", "Alpha Tres"]);
    await noHorizontalScroll(page);

    await open(page, PRICE);
    await expect(page.locator("[data-deal-badge]").first()).toHaveText(es["ficha.precio.oferta"]); // «Precio con oferta»
    await expect(page.locator("[data-condiciones]")).toBeVisible();
    await noHorizontalScroll(page);
    await page.goto(`${site.url}${AUTONOMY}?segmento=urbano&precio=mas-de-45000-euros`);
    await expect(page.locator("[data-filtered-empty]")).toBeVisible();
    await noHorizontalScroll(page);
  });
});
