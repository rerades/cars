import { expect, test, type Page } from "@playwright/test";
import { isComparable } from "../src/lib/compare.ts";
import { loadModels } from "../src/lib/data.ts";

/**
 * RNF-2 of every PRD: LCP < 2.5 s on mobile 4G. Run over the built site served by `astro preview`,
 * like the a11y tests. Conditions mirror Lighthouse's "Slow 4G" mobile profile: 412 x 823 viewport,
 * 150 ms RTT, 1.6 Mbit/s down, 750 kbit/s up, and a 4x CPU slowdown.
 *
 * Routes come from the same data the build used (loadModels), not from a fixed list.
 *
 * TODO(#378): the rankings page (PRD-005) does not exist yet. Its page, with and without
 * filters, is added to PAGES with story #378.
 */

const LCP_BUDGET_MS = 2500;
const VIEWPORT = { width: 412, height: 823 };
// Lighthouse "Slow 4G": throughput is in bytes per second.
const NETWORK = {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};
const CPU_SLOWDOWN = 4;

/** ADR-0015 asks to measure a URL with filters too; the same parameter the a11y test uses. */
const FILTERS_QUERY = "?precio_max=60000";

const { models } = loadModels();
const stem = (file: string) => file.replace(/\.yaml$/, "");

const withImage = models.find((m) => m.images.length > 0);
const comparable = models.filter((m) => isComparable(m));

interface PageToMeasure {
  name: string;
  url: string | null;
  skipReason: string;
}

const PAGES: PageToMeasure[] = [
  { name: "home", url: "/", skipReason: "" },
  { name: "listing", url: "/coches/", skipReason: "" },
  { name: "listing with filters", url: `/coches/${FILTERS_QUERY}`, skipReason: "" },
  {
    name: "model page with image",
    url: withImage ? `/marcas/${stem(withImage.file)}/` : null,
    skipReason: "no published model has an image",
  },
  {
    name: "comparison with three versions",
    url: comparable.length >= 3 ? `/comparar/?${comparable.slice(0, 3).map((m) => `v=${encodeURIComponent(stem(m.file))}`).join("&")}` : null,
    skipReason: "fewer than three comparable models",
  },
];

/** Largest Contentful Paint in ms, read from buffered entries once the page has settled. */
async function readLcp(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        let last = -1;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) last = e.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        // Buffered entries are delivered asynchronously; give them a moment.
        setTimeout(() => (last >= 0 ? resolve(last) : reject(new Error("no LCP entry"))), 500);
      }),
  );
}

test.describe.configure({ mode: "serial" }); // parallel runs would compete for CPU and skew the numbers

test.describe("LCP on mobile 4G (RNF-2)", () => {
  test.use({ viewport: VIEWPORT, isMobile: true, hasTouch: true });

  for (const p of PAGES) {
    test(p.name, async ({ page }) => {
      test.skip(p.url === null, p.skipReason);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", NETWORK);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });

      const response = await page.goto(p.url!, { waitUntil: "load" });
      expect(response?.ok(), `${p.url} did not respond OK (status ${response?.status()})`).toBe(true);
      await page.waitForLoadState("networkidle");

      const lcp = await readLcp(page);
      console.log(`[lcp] ${p.name} | ${p.url} | ${Math.round(lcp)} ms`);
      expect(lcp, `LCP of ${p.url}`).toBeLessThan(LCP_BUDGET_MS);
    });
  }
});
