/**
 * Retouches one model photo (ADR-0025): the car cut out on a transparent background, a soft ground shadow
 * under it and the license plate covered with a plain rectangle. No other pixel of the car changes.
 * Run by the Retoucher: node factory/retouch-image.ts data/images/<brand>/<slug>/<name>.<jpg|png>
 *   1. Apple Vision (retouch-vision.swift, compiled on first use; macOS 14 or later) finds the foreground
 *      instances and the text. The largest, most centered instance is the car. It fails if there is none
 *      or if the car touches an edge of the photo (it is cut off).
 *   2. Crops to the car with a margin and covers plates: text with a digit in the lower half of the car.
 *   3. Checks that every pixel inside the mask and outside the plates equals the original. Else it fails.
 *   4. Writes <name>.png next to the original, deletes the original, and writes a before/after sheet to
 *      ops/retouch/<run_id>/ for the PR. At most 1280 px wide and 2 MB (ADR-0011).
 * On success it prints one JSON line (file, edits, width, height, bytes, check, sheet). On failure it prints
 * the cause, exits 1 and writes nothing. It writes no YAML: the agent adds `edits` to the image entry.
 * The mask can still be wrong where the check passes (it only compares pixels): the agent looks at the PNG.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import sharp from "sharp";
import { MAX_BYTES, MAX_WIDTH } from "./fetch-image.ts";

const ROOT = resolve(import.meta.dirname, "..");
const SWIFT = join(ROOT, "factory/retouch-vision.swift");
const BINARY = join(ROOT, "factory/retouch-vision"); // gitignored, rebuilt when the source is newer
const PATH = /^data\/images\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\.(jpg|jpeg|png)$/;
const SHADOW_ALPHA = 90; // of 255, at the center of the shadow

export interface Box { x0: number; y0: number; x1: number; y1: number } // inclusive pixel bounds
export interface Text { text: string; x: number; y: number; w: number; h: number }
export type Edit = "background" | "plate";

/** Bounding box of the pixels above half opacity, or null if there are none. */
export function maskBox(mask: Uint8Array, width: number, height: number): Box | null {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] < 128) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** The car: the largest instance, weighted down by its distance from the center. Throws if unusable. */
export function pickInstance(masks: Uint8Array[], width: number, height: number): { index: number; box: Box } {
  let best: { index: number; box: Box; score: number } | null = null;
  masks.forEach((mask, index) => {
    const box = maskBox(mask, width, height);
    if (!box) return;
    const area = mask.reduce((n, v) => n + (v >= 128 ? 1 : 0), 0);
    const dx = ((box.x0 + box.x1) / 2 - width / 2) / width;
    const dy = ((box.y0 + box.y1) / 2 - height / 2) / height;
    const score = area * (1 - Math.hypot(dx, dy));
    if (!best || score > best.score) best = { index, box, score };
  });
  if (!best) throw new Error("Vision found no foreground instance");
  const { index, box } = best as { index: number; box: Box };
  if (box.x0 === 0 || box.y0 === 0 || box.x1 === width - 1 || box.y1 === height - 1) {
    throw new Error("the car touches an edge of the photo (it is cut off)");
  }
  return { index, box };
}

/** Plates: text with a digit and 4+ letters or digits, centered on the car, in its lower half. Padded. */
export function plateBoxes(texts: Text[], mask: Uint8Array, width: number, height: number, car: Box): Box[] {
  const out: Box[] = [];
  for (const t of texts) {
    const chars = t.text.replace(/[^\p{L}\p{N}]/gu, "");
    if (chars.length < 4 || !/\p{N}/u.test(chars)) continue;
    const cx = Math.round(t.x + t.w / 2), cy = Math.round(t.y + t.h / 2);
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    if (cy < (car.y0 + car.y1) / 2 || mask[cy * width + cx] < 128) continue;
    const pad = t.h * 0.25;
    out.push({
      x0: Math.max(0, Math.floor(t.x - pad)), y0: Math.max(0, Math.floor(t.y - pad)),
      x1: Math.min(width - 1, Math.ceil(t.x + t.w + pad)), y1: Math.min(height - 1, Math.ceil(t.y + t.h + pad)),
    });
  }
  return out;
}

const inBoxes = (boxes: Box[], x: number, y: number) => boxes.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);

export interface Composed { data: Buffer; width: number; height: number; left: number; top: number }

/**
 * RGBA canvas: the car with the mask as alpha over a soft elliptical shadow, plates filled with their mean
 * color. `rgb` is the original, 3 channels. The canvas is the car box plus a margin; outside the photo it
 * is transparent. Car pixels are copied, never computed, except at the soft mask edge (blended with shadow).
 */
export function compose(rgb: Buffer, mask: Uint8Array, width: number, height: number, car: Box, plates: Box[]): Composed {
  const bw = car.x1 - car.x0 + 1, bh = car.y1 - car.y0 + 1;
  const margin = Math.round(0.04 * Math.max(bw, bh));
  const left = car.x0 - margin, top = car.y0 - margin;
  const cw = bw + 2 * margin, ch = bh + 2 * margin;
  const fills = plates.map((b) => {
    const sum = [0, 0, 0];
    let n = 0;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++, n++) for (let c = 0; c < 3; c++) sum[c] += rgb[(y * width + x) * 3 + c];
    return sum.map((s) => Math.round(s / n));
  });
  const sx = (car.x0 + car.x1) / 2, sy = car.y1 - bh * 0.02, rx = bw * 0.48, ry = Math.max(4, bh * 0.06);
  const data = Buffer.alloc(cw * ch * 4);
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const x = left + i, y = top + j, o = (j * cw + i) * 4;
      const d = ((x - sx) / rx) ** 2 + ((y - sy) / ry) ** 2;
      const shadow = d < 1 ? SHADOW_ALPHA * (1 - d) ** 2 : 0; // black, alpha only
      const inside = x >= 0 && y >= 0 && x < width && y < height;
      const a = inside ? mask[y * width + x] : 0;
      if (a === 0) { data[o + 3] = Math.round(shadow); continue; }
      const p = plates.findIndex((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
      const src = p >= 0 ? fills[p] : [rgb[(y * width + x) * 3], rgb[(y * width + x) * 3 + 1], rgb[(y * width + x) * 3 + 2]];
      // "over": car (alpha a) on black shadow (alpha s). Straight alpha out.
      const fa = a / 255, fs = shadow / 255, outA = fa + fs * (1 - fa);
      for (let c = 0; c < 3; c++) data[o + c] = Math.round((src[c] * fa) / outA);
      data[o + 3] = Math.round(outA * 255);
    }
  }
  return { data, width: cw, height: ch, left, top };
}

/** Pixels inside the mask (fully opaque) and outside the plates that differ from the original. 0 = pass. */
export function carMismatches(out: Composed, rgb: Buffer, mask: Uint8Array, width: number, plates: Box[]): { checked: number; mismatched: number } {
  let checked = 0, mismatched = 0;
  for (let j = 0; j < out.height; j++) {
    for (let i = 0; i < out.width; i++) {
      const x = out.left + i, y = out.top + j;
      if (x < 0 || y < 0 || x >= width || y * width + x >= mask.length) continue;
      if (mask[y * width + x] !== 255 || inBoxes(plates, x, y)) continue;
      checked++;
      const o = (j * out.width + i) * 4, s = (y * width + x) * 3;
      if (out.data[o] !== rgb[s] || out.data[o + 1] !== rgb[s + 1] || out.data[o + 2] !== rgb[s + 2] || out.data[o + 3] !== 255) mismatched++;
    }
  }
  return { checked, mismatched };
}

/** PNG of at most MAX_WIDTH px and MAX_BYTES; narrower in 10 % steps until it fits. */
export async function encode(out: Composed): Promise<{ png: Buffer; width: number; height: number }> {
  let w = Math.min(out.width, MAX_WIDTH);
  for (;;) {
    const png = await sharp(out.data, { raw: { width: out.width, height: out.height, channels: 4 } })
      .resize({ width: w }).png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
    if (png.data.length <= MAX_BYTES) return { png: png.data, width: png.info.width, height: png.info.height };
    w = Math.floor(w * 0.9);
  }
}

interface Vision { width: number; height: number; instances: string[]; texts: Text[] }

function vision(file: string, dir: string): Vision {
  if (process.platform !== "darwin") throw new Error("Apple Vision only runs on macOS (ADR-0025)");
  if (!existsSync(BINARY) || statSync(BINARY).mtimeMs < statSync(SWIFT).mtimeMs) {
    execFileSync("swiftc", ["-O", SWIFT, "-o", BINARY], { stdio: ["ignore", "ignore", "pipe"] });
  }
  return JSON.parse(execFileSync(BINARY, [file, dir], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
}

async function sheet(original: string, png: Buffer, target: string): Promise<void> {
  const h = 400;
  const before = await sharp(original).resize({ height: h }).toBuffer({ resolveWithObject: true });
  const after = await sharp(png).resize({ height: h }).flatten({ background: "#d8d8d8" }).toBuffer({ resolveWithObject: true });
  await sharp({ create: { width: before.info.width + after.info.width + 30, height: h + 20, channels: 3, background: "#ffffff" } })
    .composite([{ input: before.data, left: 10, top: 10 }, { input: after.data, left: before.info.width + 20, top: 10 }])
    .jpeg({ quality: 85 }).toFile(target);
}

export async function retouch(rel: string, runId: string): Promise<Record<string, unknown>> {
  if (!PATH.test(rel)) throw new Error(`not an image under data/images/<brand>/<slug>/: ${rel}`);
  const file = join(ROOT, rel);
  if (!existsSync(file)) throw new Error(`no such file: ${rel}`);
  const tmp = mkdtempSync(join(tmpdir(), "retouch-"));
  try {
    const v = vision(file, tmp);
    const { data: rgb, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== v.width || info.height !== v.height) throw new Error("Vision and sharp read different sizes");
    const masks = await Promise.all(v.instances.map(async (m) => new Uint8Array(await sharp(m).extractChannel(0).raw().toBuffer())));
    const { index, box } = pickInstance(masks, v.width, v.height);
    const mask = masks[index];
    const plates = plateBoxes(v.texts, mask, v.width, v.height, box);
    const out = compose(rgb, mask, v.width, v.height, box, plates);
    const check = carMismatches(out, rgb, mask, v.width, plates);
    if (check.checked === 0 || check.mismatched > 0) throw new Error(`pixel check failed: ${JSON.stringify(check)}`);
    const { png, width, height } = await encode(out);

    const target = join(dirname(file), basename(file).replace(/\.\w+$/, ".png"));
    const sheetDir = join(ROOT, "ops/retouch", runId);
    const sheetFile = join(sheetDir, rel.split("/").slice(2).join("-").replace(/\.\w+$/, ".jpg"));
    mkdirSync(sheetDir, { recursive: true });
    await sheet(file, png, sheetFile);
    writeFileSync(`${target}.tmp`, png); // same directory, so the rename is atomic
    renameSync(`${target}.tmp`, target);
    if (target !== file) rmSync(file);
    const edits: Edit[] = plates.length ? ["background", "plate"] : ["background"];
    return {
      file: target.slice(ROOT.length + 1), edits, width, height, bytes: png.length,
      check: { ...check, plates: plates.length }, sheet: sheetFile.slice(ROOT.length + 1),
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const [rel] = process.argv.slice(2);
  try {
    if (!rel) throw new Error("usage: node factory/retouch-image.ts data/images/<brand>/<slug>/<name>.<jpg|png>");
    const runId = process.env.FACTORY_RUN_ID ?? new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    console.log(JSON.stringify(await retouch(rel, runId)));
  } catch (err) {
    console.error(`retouch-image: ${(err as Error).message}`);
    process.exit(1);
  }
}
