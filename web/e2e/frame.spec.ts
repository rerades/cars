import { expect, test, type Page } from "@playwright/test";
import { loadModels } from "../src/lib/data.ts";

/**
 * Page frame (docs/design/tokens.md, «Marco de página»): the whole site sits in a centred box at most
 * --width-frame (1440 px) wide. Above that, bands and the fixed menu stay inside it; below, it fills the width.
 * Run over the built site, like the other specs; the model page is the one with the most content.
 */

const FRAME = 1440;
const { models } = loadModels();
const model = [...models].sort((a, b) => b.versions.length + b.images.length - (a.versions.length + a.images.length))[0];
const ficha = model ? `/marcas/${model.file.replace(/\.yaml$/, "")}/` : "";
const pages = [
  { name: "home", url: "/" },
  { name: "catalog", url: "/coches/" },
  { name: "model page", url: ficha },
];

/** Left/right of the frame (body) and of every full-width band and the fixed menu inside it. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const box = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width };
    };
    const bands = [
      ...document.querySelectorAll(".band-dark, .band-light, .band-white, .band-section, .hero-screen, .screen, .screen-box, .screen-photo, [data-section-menu], [data-section-menu] ul"),
    ].map((e) => ({ cls: (e as HTMLElement).className || e.tagName, ...box(e) }));
    return { viewport: document.documentElement.clientWidth, frame: box(document.body), bands };
  });
}

test.describe("at 1920 px", () => {
  test.use({ viewport: { width: 1920, height: 1000 } });

  for (const { name, url } of pages) {
    test(`${name}: the frame is 1440 px, centred, and bands and menu stay inside`, async ({ page }) => {
      test.skip(!url, "no published model");
      await page.goto(url);
      const { viewport, frame, bands } = await measure(page);
      expect(frame.width).toBeCloseTo(FRAME, 0);
      expect(frame.left).toBeCloseTo((viewport - FRAME) / 2, 0);
      expect(frame.right).toBeCloseTo((viewport + FRAME) / 2, 0);
      expect(bands.length).toBeGreaterThan(0);
      for (const b of bands) {
        expect(b.left, `${b.cls} left`).toBeGreaterThanOrEqual(frame.left - 0.5);
        expect(b.right, `${b.cls} right`).toBeLessThanOrEqual(frame.right + 0.5);
      }
      const backdrop = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
      expect(backdrop).toBe("rgb(217, 217, 217)");
    });
  }

  test("model page: the bottom menu is centred and inside the frame", async ({ page }) => {
    test.skip(!ficha, "no published model");
    await page.goto(ficha);
    const { viewport, frame } = await measure(page);
    const nav = (await page.locator("[data-section-menu]").boundingBox())!;
    expect(nav.width).toBeCloseTo(FRAME, 0);
    expect(nav.x).toBeCloseTo(frame.left, 0);
    const ul = (await page.locator("[data-section-menu] ul").boundingBox())!;
    expect(ul.x).toBeGreaterThanOrEqual(frame.left);
    expect(ul.x + ul.width).toBeLessThanOrEqual(frame.right);
    expect(ul.x + ul.width / 2).toBeCloseTo(viewport / 2, 0);
  });
});

test.describe("at 1280 px", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const { name, url } of pages) {
    test(`${name}: the frame fills the whole width`, async ({ page }) => {
      test.skip(!url, "no published model");
      await page.goto(url);
      const { viewport, frame } = await measure(page);
      expect(frame.left).toBeCloseTo(0, 0);
      expect(frame.width).toBeCloseTo(viewport, 0);
    });
  }
});
