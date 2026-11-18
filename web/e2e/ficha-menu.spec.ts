import { expect, test } from "@playwright/test";
import { loadModels } from "../src/lib/data.ts";

/**
 * PRD-002 RF-17, CA-21 in a real browser: on a phone, each link of the bottom section menu takes the page to its
 * section, and the start of that section is on screen and not under the menu. Run over the built site, like
 * lcp.spec.ts; the model is the one with the most sections in the menu.
 */

const { models } = loadModels();
const model = [...models].sort((a, b) => b.versions.length + b.images.length - (a.versions.length + a.images.length))[0];
const url = model ? `/marcas/${model.file.replace(/\.yaml$/, "")}/` : "";

test.use({ viewport: { width: 390, height: 844 } });

test("CA-21: every menu link lands on its section, visible and above the menu", async ({ page }) => {
  test.skip(!model, "no published model");
  await page.goto(url);
  const menu = page.locator("[data-section-menu]");
  const links = menu.locator("a");
  const count = await links.count();
  expect(count).toBeGreaterThan(1);
  const menuTop = (await menu.locator("ul").boundingBox())!.y;
  for (let i = 0; i < count; i++) {
    const href = (await links.nth(i).getAttribute("href"))!;
    await links.nth(i).click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const target = (await page.locator(href).boundingBox())!;
    expect(target.y, `${href} starts on screen`).toBeGreaterThanOrEqual(0);
    expect(target.y + Math.min(target.height, 32), `${href} starts above the menu`).toBeLessThanOrEqual(menuTop);
  }
});

test("CA-21: at the end of the page the last content is above the menu", async ({ page }) => {
  test.skip(!model, "no published model");
  await page.goto(url);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const menuTop = (await page.locator("[data-section-menu] ul").boundingBox())!.y;
  const last = await page.evaluate(() => {
    const els = [...document.querySelectorAll("main *")].filter((e) => e.getBoundingClientRect().height > 0);
    return Math.max(...els.map((e) => e.getBoundingClientRect().bottom));
  });
  expect(last).toBeLessThanOrEqual(menuTop);
});
