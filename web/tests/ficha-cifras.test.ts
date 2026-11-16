import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { batteryFigure, powerFigure } from "../src/lib/key-figures.ts";
import { sourced } from "./fixtures.ts";

// PRD-002 story #1040: key figures of the model page's first screen (RF-18, RF-9, RF-11).
// CA-22 (static part): the final value of every key figure is in the served HTML.
// CA-9: every figure carries its source and `retrieved` date linked to its url; T3 says «fuente no oficial».

const WEB = join(import.meta.dirname, "..");
const text = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("key figure data (key-figures.ts)", () => {
  const v = (power: number | null, kwh: number | null) =>
    ({ power_kw: power === null ? null : sourced(power), battery_kwh: kwh === null ? null : sourced(kwh, { basis: "usable" }) }) as any;

  test("power: specs.power_max_kw wins, else the highest power_kw of the versions, else null", () => {
    assert.equal(powerFigure([v(100, 1), v(220, 1)], { power_max_kw: sourced(300) } as any)?.value, 300);
    assert.equal(powerFigure([v(100, 1), v(220, 1), v(null, 1)], {})?.value, 220);
    assert.equal(powerFigure([v(null, 1)], {}), null);
  });

  test("battery: the highest battery_kwh of the versions, else null", () => {
    assert.equal(batteryFigure([v(1, 60), v(1, 80), v(1, null)])?.value, 80);
    assert.equal(batteryFigure([v(1, null)]), null);
  });
});

describe("key figures of the model page (built HTML)", () => {
  let root: string;
  let out: string;
  const page = (model: string) => readFileSync(join(out, "marcas", "acme", model, "index.html"), "utf8");
  const cifras = (html: string) => /<section[^>]*data-cifras[\s\S]*?<\/section>/.exec(html)![0];
  const figure = (html: string, id: string) => new RegExp(`<div[^>]*data-figure="${id}"[\\s\\S]*?</dd>(?:\\s*<dd class="cifra__detalle"[\\s\\S]*?</dd>)?\\s*</div>`).exec(cifras(html))![0];

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-cifras-"));
    const data = join(root, "data");
    const images = join(root, "images");
    mkdirSync(images, { recursive: true });
    mkdirSync(join(data, "acme"), { recursive: true });
    const write = (model: string, doc: Record<string, any>) =>
      writeFileSync(
        join(data, "acme", `${model}.yaml`),
        stringify({ brand: "acme", brand_name: "Acme", model, status: sourced("on_sale"), images: [], versions: [], ...doc }),
      );
    const url = (u: string) => ({ url: `https://${u}/x` });
    const price = (value: number, extra: Record<string, unknown> = {}) => ({ ...sourced(value, url("www.acme.example")), unit: "EUR", price_kind: "pvp", ...extra });
    write("Full", {
      specs: { power_max_kw: sourced(250, url("www.acme.example")) },
      versions: [
        { name: "Full 60", price: price(36273), wltp_km: sourced(446), battery_kwh: sourced(60, { basis: "usable" }), power_kw: sourced(150) },
        { name: "Full 77", price: price(45000), wltp_km: sourced(557, url("www.acme.example")), battery_kwh: sourced(77.4, { basis: "gross" }), power_kw: sourced(210) },
      ],
    });
    write("Deal", {
      versions: [
        {
          name: "Deal 1",
          price: price(24900, { price_kind: "financed", price_terms: "Con financiación.", price_terms_url: "https://www.acme.example/terms" }),
        },
      ],
    });
    write("Unofficial", {
      versions: [{ name: "U 1", wltp_km: sourced(400, { tier: "T3", url: "https://www.blog.example/post" }) }],
    });
    write("Empty", { versions: [{ name: "E 1" }] });

    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data, CARS_IMAGES_DIR: images },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("the section is #cifras, named «Cifras clave», inside the dark first screen, after the h1, with a dl and no heading", () => {
    const html = page("Full");
    const header = /<header[^>]*data-ficha-header[\s\S]*?<\/header>/.exec(html)![0];
    const section = /<section[^>]*data-cifras[^>]*>/.exec(header)![0];
    assert.match(section, /id="cifras"/);
    assert.match(section, /aria-label="Cifras clave"/);
    assert.ok(header.indexOf("<h1") < header.indexOf("data-cifras"));
    assert.match(cifras(html), /<dl\b/);
    assert.doesNotMatch(cifras(html), /<h[1-6]\b/);
    assert.equal([...html.matchAll(/id="cifras"/g)].length, 1);
  });

  test("CA-22 (static): the final value of each figure is in the HTML, the label is the max/greater one", () => {
    const html = page("Full");
    const f = (id: string) => text(figure(html, id));
    assert.match(f("price"), /^Desde 36\.273 €/);
    assert.match(f("range"), /Autonomía WLTP máxima/);
    assert.match(text(figure(html, "range")), /557 km/);
    assert.match(text(figure(html, "power")), /250 kW/);
    assert.match(text(figure(html, "battery")), /77,4 kWh/);
    assert.match(text(figure(html, "power")), /Potencia máxima/);
    assert.match(text(figure(html, "battery")), /Batería mayor/);
    // The number is real text in the dd, not an attribute or a script.
    assert.doesNotMatch(cifras(html), /<script|data-count|data-target/);
  });

  test("the label (dt) comes before the value (dd) in the DOM", () => {
    const p = figure(page("Full"), "range");
    assert.ok(p.indexOf("<dt") < p.indexOf("<dd"));
  });

  test("CA-9: the price shows «Fuente: {name}, {date}» linked to its url; the other figures carry a note mark", () => {
    const html = page("Full");
    const price = figure(html, "price");
    assert.match(text(price), /Fuente: acme\.example ?, 20 sep 2026/);
    assert.match(price, /<a[^>]*href="https:\/\/www\.acme\.example\/x"[^>]*data-source-link/);
    for (const id of ["range", "power", "battery"]) {
      const m = /data-source-mark="(\d+)"/.exec(figure(html, id));
      assert.ok(m, `${id} has a mark`);
      // The mark leads to an existing entry of «Fuentes» with that source's date and url.
      const entry = new RegExp(`<li[^>]*data-fuente="${m![1]}"[\\s\\S]*?</li>`).exec(html)![0];
      assert.match(entry, /20 sep 2026/);
      assert.match(entry, /href="https:\/\/[^"]+"/);
    }
  });

  test("CA-9: a T3 figure says «fuente no oficial»", () => {
    const html = page("Unofficial");
    assert.match(text(figure(html, "range")), /fuente no oficial/);
    assert.match(figure(html, "range"), /data-unofficial/);
    assert.match(html, /blog\.example/);
  });

  test("a financed price is labelled «Desde · Precio con oferta»", () => {
    assert.match(text(figure(page("Deal"), "price")), /Desde · Precio con oferta/);
    assert.match(text(figure(page("Deal"), "price")), /24\.900 €/);
  });

  test("RF-11: a missing figure keeps its place as «Por confirmar» with no source", () => {
    const html = page("Empty");
    const c = cifras(html);
    assert.equal([...c.matchAll(/data-figure="/g)].length, 4);
    for (const id of ["price", "range", "power", "battery"]) {
      const f = figure(html, id);
      assert.match(f, /data-missing/);
      assert.match(text(f), /por confirmar/i);
      assert.doesNotMatch(f, /data-source|data-source-mark/);
    }
  });

  test("the key figures use --text-figure-xl through the Cifra component", () => {
    const src = readFileSync(join(WEB, "src/pages/marcas/[marca]/[modelo].astro"), "utf8");
    assert.match(src, /import Cifra from/);
    assert.match(src, /<Cifra\s+size="xl"/);
    assert.match(readFileSync(join(WEB, "src/styles/global.css"), "utf8"), /\.cifra--xl \{ --cifra-size: var\(--text-figure-xl\)/);
  });
});
