import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * ADR-0006: axe-core over the built site, one page per template of PRD-001.
 * critical/serious violations fail the test; moderate/minor are printed (rule, element, URL).
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Documented exceptions (false positives). Each one needs: rule, URL, reason, date.
 * None so far.
 */
const EXCLUSIONS: { rule: string; url: string; reason: string; date: string }[] = [];

/** A query string that matches no model: nothing costs 1 EUR or less. The test checks the empty state shows. */
const EMPTY_QUERY = "?precio_max=1";

/** Links of the "Explorar" strip of /coches/ whose href starts with `prefix`: the pages that exist. */
async function exploreLinks(page: Page, prefix: string): Promise<string[]> {
  const hrefs = await page.locator("[data-explore] a").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  return hrefs.filter((h) => h.startsWith(prefix));
}

/** First link whose page answers 200 and lists at least one model card. */
async function firstWithModels(request: APIRequestContext, links: string[]): Promise<string> {
  for (const href of links) {
    const res = await request.get(href);
    if (res.ok() && (await res.text()).includes("data-results")) return href;
  }
  throw new Error(`No page with models among: ${links.join(", ") || "(none)"}`);
}

async function checkA11y(page: Page, url: string, ready?: () => Promise<void>) {
  const response = await page.goto(url);
  expect(response?.ok(), `${url} did not respond OK (status ${response?.status()})`).toBe(true);
  await ready?.();

  const builder = new AxeBuilder({ page }).withTags(TAGS);
  const excluded = EXCLUSIONS.filter((e) => e.url === url).map((e) => e.rule);
  if (excluded.length) builder.disableRules(excluded);
  const { violations } = await builder.analyze();

  const report = (v: (typeof violations)[number]) =>
    v.nodes.map((n) => `${v.id} | ${n.target.join(" ")} | ${url} | ${v.impact}`).join("\n");

  const minor = violations.filter((v) => v.impact === "moderate" || v.impact === "minor");
  for (const v of minor) console.log(`[a11y ${v.impact}] ${report(v)}`);

  const blocking = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(blocking.map(report).join("\n"), `critical/serious violations on ${url}`).toBe("");
}

test.describe("accessibility (ADR-0006)", () => {
  let brandUrl = "";
  let segmentUrl = "";
  let bandUrl = "";

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const base = test.info().project.use.baseURL!;
    await page.goto(`${base}/coches/`);
    const request = page.context().request;
    const abs = (links: string[]) => links.map((l) => new URL(l, base).toString());
    brandUrl = await firstWithModels(request, abs(await exploreLinks(page, "/marcas/")));
    segmentUrl = await firstWithModels(request, abs(await exploreLinks(page, "/segmentos/")));
    bandUrl = await firstWithModels(
      request,
      abs([...(await exploreLinks(page, "/precio/")), ...(await exploreLinks(page, "/autonomia/"))]),
    );
    await page.close();
  });

  test("listing /coches/", async ({ page }) => {
    await checkA11y(page, "/coches/");
  });

  test("brand page", async ({ page }) => {
    await checkA11y(page, brandUrl);
  });

  test("segment page", async ({ page }) => {
    await checkA11y(page, segmentUrl);
  });

  test("band page (price or range)", async ({ page }) => {
    await checkA11y(page, bandUrl);
  });

  test("empty state of /coches/", async ({ page }) => {
    // The query must still match nothing, or this would be checking another view.
    await checkA11y(page, `/coches/${EMPTY_QUERY}`, () => expect(page.locator("[data-empty]")).toBeVisible());
  });
});
