import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { sourced } from "./fixtures.ts";

// PRD-002 story #1043: bottom section menu of the model page (RF-17).
// CA-21: with JavaScript off, every menu link reaches an existing section; the menu never covers a title.

const WEB = join(import.meta.dirname, "..");

describe("section menu of the model page (built HTML)", () => {
  let root: string;
  let out: string;
  const page = (model: string) => readFileSync(join(out, "marcas", "acme", model, "index.html"), "utf8");
  const menu = (html: string) => /<nav[^>]*data-section-menu[\s\S]*?<\/nav>/.exec(html)![0];
  const links = (html: string) => [...menu(html).matchAll(/<a href="#([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]);

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-menu-"));
    const data = join(root, "data");
    const images = join(root, "images");
    mkdirSync(images, { recursive: true });
    mkdirSync(join(data, "acme"), { recursive: true });
    const write = (model: string, doc: Record<string, any>) =>
      writeFileSync(
        join(data, "acme", `${model}.yaml`),
        stringify({ brand: "acme", brand_name: "Acme", model, status: sourced("on_sale"), images: [], versions: [], ...doc }),
      );
    write("Full", {
      specs: { power_max_kw: sourced(250) },
      versions: [{ name: "Full 60", wltp_km: sourced(446) }],
    });
    write("Bare", {});
    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data, CARS_IMAGES_DIR: images },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-21: a labelled nav after main, with no script, whose every link targets an id that exists once", () => {
    const html = page("Full");
    assert.match(menu(html), /aria-label="Secciones de la página"/);
    assert.ok(html.indexOf("</main>") < html.indexOf("data-section-menu"));
    assert.doesNotMatch(menu(html), /<script/);
    const found = links(html);
    assert.ok(found.length >= 3);
    for (const [id] of found) {
      assert.equal([...html.matchAll(new RegExp(`id="${id}"`, "g"))].length, 1, `#${id}`);
    }
  });

  test("entries follow the page order and only exist for sections that exist", () => {
    const labels = (m: string) => links(page(m)).map(([, l]) => l);
    assert.deepEqual(labels("Full"), ["Cifras", "Versiones", "Datos", "Fuentes"]);
    assert.deepEqual(labels("Bare"), ["Cifras", "Versiones"]);
  });

  test("CA-21: the menu leaves --menu-clearance free and scroll-padding keeps titles out from under it", () => {
    const css = readFileSync(join(WEB, "src/components/SectionMenu.astro"), "utf8");
    assert.match(css, /scroll-padding-bottom:\s*var\(--menu-clearance\)/);
    assert.match(css, /body\s*\{[^}]*padding-bottom:\s*var\(--menu-clearance\)/);
    assert.match(css, /position:\s*fixed/);
  });
});
