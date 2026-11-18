import { expect, test, type Page } from "@playwright/test";
import { loadModels } from "../src/lib/data.ts";

/**
 * PRD-002 RF-18, CA-22 in a real browser: the key figures count up when the visitor allows motion, and with
 * prefers-reduced-motion: reduce they never change from the final value the HTML serves. Run over the built site,
 * like lcp.spec.ts; the model comes from the same data the build used.
 */

const { models } = loadModels();
const model = models.find((m) => m.versions.some((v) => v.price?.value));
const url = model ? `/marcas/${model.file.replace(/\.yaml$/, "")}/` : "";

/** Counts every change to the figures' text from the first byte of the page, and returns the final texts. */
async function watch(page: Page) {
  await page.addInitScript(() => {
    (window as any).__changes = 0;
    new MutationObserver((list) => {
      for (const r of list) if ((r.target as Node).parentElement?.closest?.("[data-cifras]")) (window as any).__changes++;
    }).observe(document, { subtree: true, characterData: true });
  });
  await page.goto(url);
  await page.waitForTimeout(1500); // longer than the 900 ms count
  return {
    changes: await page.evaluate(() => (window as any).__changes as number),
    texts: await page.locator("[data-cifras] .cifra__valor").allTextContents(),
  };
}

test.describe("key figures count-up (CA-22)", () => {
  test.skip(!model, "no published model with a price");
  let served: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(url);
    served = await page.locator("[data-cifras] .cifra__valor").allTextContents();
    await ctx.close();
    expect(served.length).toBeGreaterThan(0);
  });

  test("with reduced motion the figures never change from the served value", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const { changes, texts } = await watch(await ctx.newPage());
    expect(changes).toBe(0);
    expect(texts).toEqual(served);
    await ctx.close();
  });

  test("without reduced motion they count up and end on the served value", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "no-preference" });
    const { changes, texts } = await watch(await ctx.newPage());
    expect(changes).toBeGreaterThan(0);
    expect(texts).toEqual(served);
    await ctx.close();
  });
});
