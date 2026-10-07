/** Tests for the image downloader (ADR-0010, "Imágenes"). Run: npm test */
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchImage, imageInfo } from "../fetch-image.ts";

const png = (width: number, height = 720) => {
  const size = Buffer.alloc(8);
  size.writeUInt32BE(width, 0);
  size.writeUInt32BE(height, 4);
  return Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d", "hex"), Buffer.from("IHDR"), size, Buffer.alloc(5)]);
};
/** SOI, an APP0 segment before the frame, then SOF0 with height 600 and width 800. */
const JPEG = Buffer.from("ffd8ffe000104a46494600010100000100010000ffc0001108025803200301220002110103110100", "hex");

test("imageInfo lee formato y tamaño de la cabecera", () => {
  assert.deepEqual(imageInfo(png(1280, 853)), { type: "png", width: 1280, height: 853 });
  assert.deepEqual(imageInfo(JPEG), { type: "jpg", width: 800, height: 600 });
  assert.equal(imageInfo(Buffer.from("<!doctype html>")), null);
});

/** A fake fetch: the Commons API answers with `info`, any other URL with `body`. */
const fake = (body: Buffer | string, info: object, seen: string[] = []) => (async (url: string, init?: RequestInit) => {
  seen.push(`${url} ${(init?.headers as Record<string, string>)["User-Agent"]}`);
  if (url.includes("/w/api.php")) return Response.json({ query: { pages: { "1": { imageinfo: [info] } } } });
  return new Response(typeof body === "string" ? body : new Uint8Array(body));
}) as typeof fetch;

const PAGE = "https://commons.wikimedia.org/wiki/File:Acme_Volta.jpg";
const THUMB = "https://upload.wikimedia.org/thumb/Acme_Volta.jpg/1280px-Acme_Volta.jpg";

test("Commons: pide la miniatura de 1280 px con User-Agent y guarda el fichero", async () => {
  const root = mkdtempSync(join(tmpdir(), "fetch-image-"));
  const seen: string[] = [];
  const out = await fetchImage({ brand: "acme", slug: "volta", name: "frontal", pageUrl: PAGE, root },
    fake(png(1280), { url: "https://upload.wikimedia.org/Acme_Volta.jpg", width: 4000, thumburl: THUMB }, seen));
  assert.deepEqual(out, { file: "data/images/acme/volta/frontal.png", source_url: THUMB, page_url: PAGE,
    width: 1280, height: 720, bytes: png(1280).length });
  assert.ok(existsSync(join(root, out.file)));
  assert.match(seen[0], /iiurlwidth=1280&titles=File%3AAcme_Volta\.jpg siete3-factory\/1\.0 \(https:\/\/siete3\.com\)/);
  rmSync(root, { recursive: true, force: true });
});

test("una descarga que no vale no deja ningún fichero", async () => {
  const root = mkdtempSync(join(tmpdir(), "fetch-image-"));
  const run = (body: Buffer | string, args: object = {}) => fetchImage(
    { brand: "acme", slug: "volta", name: "frontal", pageUrl: PAGE, root, ...args },
    fake(body, { url: "https://upload.wikimedia.org/Acme_Volta.jpg", width: 900 }));
  await assert.rejects(run("<html>error</html>"), /not a JPEG or PNG/);
  await assert.rejects(run(png(1920)), /1920 px wide/);
  await assert.rejects(run(png(800), { name: "../../x" }), /name must match/);
  await assert.rejects(run(png(800), { pageUrl: "https://press.acme.example/terms" }), /pass the file URL/);
  assert.deepEqual(readdirSync(root), []);
  rmSync(root, { recursive: true, force: true });
});
