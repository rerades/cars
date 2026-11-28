import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { stringify } from "yaml";
import { imageEntry, sourced } from "../tests/fixtures.ts";
import { buildSite } from "./build-site.ts";

/**
 * PRD-002 RF-12 / CA-12 (story #1247): the retouched image of «Más imágenes» shows the whole car at 390 and 1280 px.
 * The test image is a tall opaque red block (aspect 1.2) with a transparent-free outline: with `object-fit: cover`
 * in the 16:9 box it would be cropped top and bottom (visible red aspect ~1.78); `contain` keeps its 1.2 aspect.
 */

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };
const RATIO = 1.2;
let tmp = "";
let server: Server;
let base = "";

test.beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), "cars-more-cutout-e2e-"));
  const data = join(tmp, "data");
  const images = join(tmp, "images");
  const out = join(tmp, "out");
  mkdirSync(join(data, "acme"), { recursive: true });
  mkdirSync(join(images, "acme/cut"), { recursive: true });
  const car = await sharp({ create: { width: 1200, height: 1000, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
  writeFileSync(join(images, "acme/cut/car.png"), car);
  const file = "data/images/acme/cut/car.png";
  const main = imageEntry({ file });
  const cut = imageEntry({ file, edits: ["background"], attribution: "Ann Author, CC BY-SA 4.0" });
  writeFileSync(
    join(data, "acme", "Cut.yaml"),
    stringify({ brand: "acme", brand_name: "Acme", model: "Cut", status: sourced("on_sale"), versions: [], images: [main, cut] }),
  );
  buildSite(out, { CARS_DATA_DIR: data, CARS_IMAGES_DIR: images });
  server = createServer((req, res) => {
    let f = join(out, normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname)));
    try {
      if (statSync(f).isDirectory()) f = join(f, "index.html");
      res.writeHead(200, { "content-type": MIME[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
test.afterAll(() => {
  server?.close();
  rmSync(tmp, { recursive: true, force: true });
});

for (const width of [390, 1280]) {
  test(`the retouched image is shown whole at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/marcas/acme/Cut/`);
    const box = page.locator("[data-more-cutout]");
    await box.scrollIntoViewIfNeeded();
    await page.locator("[data-more-cutout] img").evaluate((i: HTMLImageElement) => i.decode());
    const shot = await box.screenshot();
    const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    let [x0, y0, x1, y1] = [info.width, info.height, -1, -1];
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        // The filter dims the red: any clearly red pixel counts as the car.
        if (data[i]! > 100 && data[i + 1]! < 60 && data[i + 2]! < 60) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    }
    expect(x1, "car found").toBeGreaterThan(x0);
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    expect(w / h, "car keeps its own aspect: not cropped").toBeCloseTo(RATIO, 1);
    expect(y0, "room above the roof").toBeGreaterThanOrEqual(8); // 0.75 rem padding at 16 px = 12 px, minus rounding
    expect(y1, "resting on the bottom").toBeGreaterThanOrEqual(info.height - 8);
  });
}
