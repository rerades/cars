/**
 * Downloads one model image to data/images/<brand>/<slug>/<name>.<ext> (ADR-0012; ADR-0010, "Imágenes").
 * Run by the Researcher: node factory/fetch-image.ts <brand> <slug> <name> <page_url> [file_url]
 *   - Wikimedia Commons: page_url is the File: page; the script asks the API for the 1280 px thumbnail.
 *   - Press room: page_url is the terms page and file_url the image itself.
 * On success it prints one JSON line (file, source_url, page_url, width, height, bytes).
 * On failure it prints the cause, exits 1 and leaves no file. It reads no license and writes no YAML.
 * The write guard hook does not see what this process writes: the path checks below are the only barrier.
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const MAX_WIDTH = 1280;
const MAX_BYTES = 10_000_000;
const USER_AGENT = `siete3-factory/1.0 (https://siete3.com) node/${process.versions.node}`; // Wikimedia UA policy
const SLUG = /^[a-z0-9-]+$/;

export interface ImageInfo {
  type: "jpg" | "png";
  width: number;
  height: number;
}

/** Format from the first bytes and size from the PNG IHDR or the JPEG SOF marker. Null if neither. */
export function imageInfo(buf: Buffer): ImageInfo | null {
  if (buf.length >= 24 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { type: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null;
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; } // fill byte
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { i += 2; continue; } // no length
    const sof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (sof && i + 9 <= buf.length) return { type: "jpg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

/** Why a stored file is not acceptable (wrong format, extension or width), or null if it is. */
export function imageProblem(buf: Buffer, file: string): string | null {
  const info = imageInfo(buf);
  if (!info) return "not a JPEG or PNG";
  const ext = file.split(".").pop()?.toLowerCase();
  if (info.type === "png" ? ext !== "png" : ext !== "jpg" && ext !== "jpeg") return `extension .${ext} does not match ${info.type}`;
  if (info.width > MAX_WIDTH) return `${info.width} px wide, more than ${MAX_WIDTH}`;
  return null;
}

async function get(url: string, fetchImpl: typeof fetch): Promise<Response> {
  const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}

/** The thumbnail of a Commons File: page at MAX_WIDTH, or the original if it is narrower. */
async function commonsUrl(pageUrl: string, fetchImpl: typeof fetch): Promise<string> {
  const title = decodeURIComponent(new URL(pageUrl).pathname.replace(/^\/wiki\//, ""));
  const api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
    + `&iiprop=url|mime|size&iiurlwidth=${MAX_WIDTH}&titles=${encodeURIComponent(title)}`;
  const data: any = await (await get(api, fetchImpl)).json();
  const info = Object.values<any>(data?.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!info?.url) throw new Error(`Commons has no file for ${title}`);
  const url = new URL(info.width <= MAX_WIDTH ? info.url : info.thumburl ?? info.url);
  for (const k of [...url.searchParams.keys()]) if (k.startsWith("utm_")) url.searchParams.delete(k); // tracking only
  return url.toString();
}

export interface FetchArgs {
  brand: string;
  slug: string;
  name: string;
  pageUrl: string;
  fileUrl?: string;
  root?: string; // repo root, for tests
}

export async function fetchImage(a: FetchArgs, fetchImpl: typeof fetch = fetch) {
  for (const [k, v] of Object.entries({ brand: a.brand, slug: a.slug, name: a.name })) {
    if (!SLUG.test(v)) throw new Error(`${k} must match [a-z0-9-]: ${v}`);
  }
  if (new URL(a.pageUrl).protocol !== "https:") throw new Error("page_url must be https");
  const commons = new URL(a.pageUrl).hostname === "commons.wikimedia.org";
  if (!commons && !a.fileUrl) throw new Error("outside Commons, pass the file URL too");
  const sourceUrl = commons ? await commonsUrl(a.pageUrl, fetchImpl) : a.fileUrl!;
  if (new URL(sourceUrl).protocol !== "https:") throw new Error("file URL must be https");

  const buf = Buffer.from(await (await get(sourceUrl, fetchImpl)).arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`${buf.length} bytes, more than ${MAX_BYTES}`);
  const info = imageInfo(buf);
  if (!info) throw new Error("the download is not a JPEG or PNG");
  if (info.width > MAX_WIDTH) throw new Error(`${info.width} px wide, more than ${MAX_WIDTH}`);

  const file = `data/images/${a.brand}/${a.slug}/${a.name}.${info.type}`;
  const target = join(a.root ?? process.cwd(), file);
  mkdirSync(join(target, ".."), { recursive: true });
  const tmp = `${target}.part`;
  try {
    writeFileSync(tmp, buf);
    renameSync(tmp, target);
  } finally {
    rmSync(tmp, { force: true });
  }
  return { file, source_url: sourceUrl, page_url: a.pageUrl, width: info.width, height: info.height, bytes: buf.length };
}

if (import.meta.main) {
  const [brand, slug, name, pageUrl, fileUrl] = process.argv.slice(2);
  if (!pageUrl) {
    console.error("uso: node factory/fetch-image.ts <marca> <slug> <nombre> <page_url> [file_url]");
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(await fetchImage({ brand, slug, name, pageUrl, fileUrl })));
  } catch (e) {
    console.error(`descarga fallida: ${(e as Error).message}`);
    process.exit(1);
  }
}
