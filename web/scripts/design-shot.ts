/**
 * Screenshots for visual design (ADR-0024). Serves the site with `astro dev` and DESIGN_PROTO=1,
 * and writes one PNG per width of every prototype in web/design-proto/ or of the given pages.
 *
 *   node web/scripts/design-shot.ts                   every prototype
 *   node web/scripts/design-shot.ts tarjeta-a         one prototype
 *   node web/scripts/design-shot.ts /coches/ /        real pages
 *   node web/scripts/design-shot.ts --out <dir> ...   output dir (default docs/design/refs)
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { createServer } from "node:net";
import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const WEB = resolve(import.meta.dirname, "..");
const REPO = resolve(WEB, "..");
export const WIDTHS = [390, 1280];
// A longer page is cut here: past this height the agent reading the image sees it scaled down.
const MAX_HEIGHT = 2400;

/** A target starting with "/" is a page; anything else is a prototype. */
export function urlOf(target: string): string {
  return target.startsWith("/") ? target : `/proto/${target}/`;
}

/** Output file name of a target: `/marcas/tesla/` -> `marcas-tesla-390.png`, `/` -> `portada-390.png`. */
export function fileOf(target: string, width: number): string {
  const slug = target.split("/").filter(Boolean).join("-") || "portada";
  return `${slug}-${width}.png`;
}

/** A free port, because a busy one would make `astro dev` silently move to another. */
function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => ok(port));
    });
  });
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: { out: { type: "string", default: "docs/design/refs" } },
    allowPositionals: true,
  });
  const out = isAbsolute(values.out!) ? values.out! : resolve(REPO, values.out!);
  const protoDir = join(WEB, "design-proto");
  const targets = positionals.length
    ? positionals
    : (existsSync(protoDir) ? readdirSync(protoDir) : [])
        .filter((f) => f.endsWith(".astro"))
        .map((f) => f.replace(/\.astro$/, ""));
  if (!targets.length) throw new Error("No hay prototipos en web/design-proto/ ni páginas en los argumentos");

  // An agent's worktree starts without dependencies.
  if (!existsSync(join(WEB, "node_modules"))) {
    execFileSync("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: WEB, stdio: "inherit" });
  }
  // Imported late: they do not exist until the install above.
  const { chromium } = await import("@playwright/test");
  const { default: sharp } = await import("sharp");

  mkdirSync(out, { recursive: true });
  const port = await freePort();
  const base = `http://localhost:${port}`;
  const server = spawn(join(WEB, "node_modules/.bin/astro"), ["dev", "--port", String(port), "--ignore-lock"], {
    cwd: WEB,
    env: { ...process.env, DESIGN_PROTO: "1" },
    stdio: "ignore",
  });
  const browser = await chromium.launch();
  try {
    const deadline = Date.now() + 60_000;
    for (;;) {
      const up = await fetch(base).then(() => true, () => false);
      if (up) break;
      if (Date.now() > deadline) throw new Error("astro dev no ha arrancado en 60 s");
      await new Promise((r) => setTimeout(r, 500));
    }
    for (const target of targets) {
      for (const width of WIDTHS) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const res = await page.goto(base + urlOf(target), { waitUntil: "networkidle", timeout: 120_000 });
        if (!res?.ok()) throw new Error(`${target}: HTTP ${res?.status()}`);
        // Lazy images load only when scrolled to, and a full-page shot does not scroll.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 100));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForLoadState("networkidle");
        const shot = await page.screenshot({ fullPage: true, animations: "disabled" });
        const { height = 0 } = await sharp(shot).metadata();
        const file = join(out, fileOf(target, width));
        await sharp(shot)
          .extract({ left: 0, top: 0, width, height: Math.min(height, MAX_HEIGHT) })
          .png({ palette: true, quality: 80, compressionLevel: 9 })
          .toFile(file);
        const cut = height > MAX_HEIGHT ? ` (recortada: medía ${height} px)` : "";
        console.log(`${file}${cut}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error((e as Error).message);
    process.exit(1);
  });
}
