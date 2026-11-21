import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { RANKINGS } from "../src/lib/rankings.ts";

/** Story #1191: the four bands, header and filter shape of a ranking page (rankings.md, "Dirección visual"). */
describe("ranking bands, header and filters (#1191)", () => {
  let out: string;
  const page = (url: string) => readFileSync(join(out, url, "index.html"), "utf8");
  const withoutTemplates = (html: string) => html.replace(/<template[\s\S]*?<\/template>/g, "");
  const classes = (html: string) =>
    [...html.matchAll(/<(?:div|header|section)\b[^>]*class="([^"]*\bband-(?:dark|light|white)\b[^"]*)"/g)].map(
      (m) => /band-(dark|light|white)/.exec(m[1])![1],
    );

  before(() => {
    out = mkdtempSync(join(tmpdir(), "cars-rankings-franjas-"));
    const env = { ...process.env };
    delete env.CARS_DATA_DIR;
    execFileSync("pnpm", ["exec", "astro", "build", "--outDir", out], {
      cwd: resolve(import.meta.dirname, ".."),
      env,
      stdio: "pipe",
    });
  });
  after(() => rmSync(out, { recursive: true, force: true }));

  test("four bands in order: dark, light, dark, white (the light one only with places)", () => {
    for (const r of RANKINGS) {
      const html = withoutTemplates(page(r.url));
      if (/data-ranking-list/.test(html)) assert.deepEqual(classes(html), ["dark", "light", "dark", "white"], r.url);
      else assert.deepEqual(classes(html), ["dark", "dark", "white"], r.url);
    }
  });

  test("header: h1 at --text-screen, max 18ch, «Coches» link in the dark header", () => {
    for (const r of RANKINGS) {
      const html = page(r.url);
      const header = /<header class="band-dark"[\s\S]*?<\/header>/.exec(html)![0];
      assert.match(header, /<h1 class="[^"]*\btext-screen\b/);
      assert.match(header, /<h1 class="[^"]*max-w-\[18ch\]/);
      assert.doesNotMatch(header, /text-display/);
      assert.match(header, /data-ranking-ruta[\s\S]*href="\/coches"[^>]*underline/);
      for (const attr of ["data-intro", "data-order", "data-scope"]) assert.ok(header.includes(attr), attr);
    }
  });

  test("filters: pill selects with touch height and a 5.5rem label; no chips or apply button", () => {
    const html = page("/rankings/mas-autonomia");
    const tpl = /<template data-filters-template>([\s\S]*?)<\/template>/.exec(html)![1];
    assert.equal((tpl.match(/<select\b[^>]*class="[^"]*rounded-pill[^"]*border-line[^"]*min-h-touch|<select\b[^>]*class="[^"]*min-h-touch[^"]*rounded-pill/g) ?? []).length, 2);
    assert.equal((tpl.match(/min-w-\[5\.5rem\]/g) ?? []).length, 2);
    assert.match(tpl, /md:flex-row/);
    assert.doesNotMatch(tpl, /<button|type="submit"|role="dialog"/);
  });

  test("the list heading is --text-block and the list no longer uses --width-ranking", () => {
    for (const r of RANKINGS) {
      const html = page(r.url);
      assert.match(html, /<h2 id="resultados"[^>]*class="[^"]*\btext-block\b/);
      assert.doesNotMatch(html, /width-ranking/);
    }
  });

  test("the filtered-empty button uses ink-950 on the dark band colours", () => {
    const html = page("/rankings/mas-autonomia");
    const tpl = /<template data-filtered-empty-template>([\s\S]*?)<\/template>/.exec(html)![1];
    assert.match(tpl, /<button[^>]*text-ink-950/);
    assert.doesNotMatch(tpl, /text-on-brand/);
  });
});
