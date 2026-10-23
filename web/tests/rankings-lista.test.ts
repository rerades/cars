import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { loadModels } from "../src/lib/data.ts";
import { formatDate, formatDecimal, formatEur, formatNumber, sourceName } from "../src/lib/format.ts";
import { RANKINGS, candidates, rankPlaces } from "../src/lib/rankings.ts";

const text = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

describe("ranking list of places (#372)", () => {
  let out: string;
  const models = loadModels().models;
  const page = (url: string) => readFileSync(join(out, url, "index.html"), "utf8");
  const items = (html: string) => [...html.matchAll(/<li\b[^>]*data-place=[\s\S]*?<\/li>/g)].map((m) => m[0]);

  before(() => {
    out = mkdtempSync(join(tmpdir(), "cars-rankings-lista-"));
    const env = { ...process.env };
    delete env.CARS_DATA_DIR;
    execFileSync("pnpm", ["exec", "astro", "build", "--outDir", out], {
      cwd: resolve(import.meta.dirname, ".."),
      env,
      stdio: "pipe",
    });
  });
  after(() => rmSync(out, { recursive: true, force: true }));

  test("RF-7, CA-3: an <ol> in the served HTML with the places of rankPlaces, value = number, no padding", () => {
    for (const r of RANKINGS) {
      const html = page(r.url);
      assert.match(html, /<ol\b[^>]*role="list"[^>]*aria-labelledby="resultados"/);
      const expected = rankPlaces(candidates(models, r), r);
      const lis = items(html);
      assert.equal(lis.length, expected.length, r.url);
      assert.ok(lis.length <= 10);
      lis.forEach((li, i) => {
        assert.match(li, new RegExp(`^<li[^>]*value="${expected[i].place}"`));
        const h3 = /<h3[\s\S]*?<\/h3>/.exec(li)![0];
        assert.match(text(h3), new RegExp(`^Puesto ${expected[i].place}\\b`));
      });
    }
  });

  test("CA-3: brand + model linking to /marcas/{brand}/{model}/, version, segment; no status label, image or buy link", () => {
    for (const r of RANKINGS) {
      const expected = rankPlaces(candidates(models, r), r);
      items(page(r.url)).forEach((li, i) => {
        const { model, version } = expected[i].entry as ReturnType<typeof candidates>[number];
        const href = `/marcas/${model.file.replace(/\.yaml$/, "")}/`;
        const a = /<a[^>]*href="([^"]+)"[^>]*data-place-link[^>]*>([\s\S]*?)<\/a>/.exec(li)!;
        assert.equal(a[1], href);
        assert.equal(text(a[2]), `${model.brand_name} ${model.model}`);
        assert.equal(text(/data-version[^>]*>([\s\S]*?)<\/p>/.exec(li)![1]), version.name);
        const seg = text(/data-segment[^>]*>([\s\S]*?)<\/p>/.exec(li)![1]);
        if (model.segment) assert.ok(seg.startsWith("Segmento:") && seg.length > "Segmento:".length);
        else assert.equal(seg, "Segmento: Segmento por confirmar");
        assert.doesNotMatch(li, /<img|<svg|Próximamente|Descatalogado|Comprar/i);
        // the offer label belongs to the price ranking only, and only to financed prices (#373)
        if (r.id !== "precio") assert.doesNotMatch(li, /Precio con oferta/);
        // only one external link (the source); the rest is internal
        assert.equal([...li.matchAll(/href="https?:/g)].length, 1);
      });
    }
  });

  test("CA-16, CA-4: figure identical to the file; source domain, retrieved date and link to its url; T2 says it, T1 does not", () => {
    let t1 = 0;
    let t2 = 0;
    for (const r of RANKINGS) {
      const expected = rankPlaces(candidates(models, r), r);
      items(page(r.url)).forEach((li, i) => {
        const { version, figure } = expected[i].entry as ReturnType<typeof candidates>[number];
        const shown = text(/data-figure-value[^>]*>([\s\S]*?)<\/span>/.exec(li)![1]).replace(/ /g, " ");
        const n = figure.value;
        const want = {
          precio: formatEur(n),
          autonomia: `${formatNumber(n)} km`,
          bateria: `${formatDecimal(n)} kWh, ${{ usable: "útil", gross: "bruta", unknown: "sin especificar si es útil o bruta" }[version.battery_kwh?.basis ?? "unknown"]}`,
          potencia: `${formatDecimal(n)} kW`,
          cargaCc: `${formatDecimal(n)} kW`,
        }[r.id].replace(/ /g, " ");
        assert.equal(shown, want, `${r.url} #${i + 1}`);

        const src = /<p[^>]*data-source[\s>][\s\S]*?<\/p>/.exec(li)![0];
        assert.match(src, new RegExp(`<a[^>]*href="${figure.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
        assert.equal(
          // tags removed without adding spaces: what the reader sees, no gap before the comma
          src.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().replace(" · fuente no oficial", ""),
          `Fuente: ${sourceName(figure.url)}, ${formatDate(figure.retrieved)}`,
        );
        if (figure.tier === "T2") {
          t2++;
          assert.match(text(src), /· fuente no oficial$/);
        } else {
          t1++;
          assert.doesNotMatch(src, /no oficial/);
        }
      });
    }
    assert.ok(t1 > 0, "data has T1 places");
    assert.ok(RANKINGS.every((r) => items(page(r.url)).length > 0), "every ranking lists places");
    console.log(`T1 places: ${t1}, T2 places: ${t2}`);
  });

  test("CA-4: a version whose figure is T3 (or missing) is not listed", () => {
    for (const r of RANKINGS) {
      const listed = new Set(candidates(models, r).map((c) => c.figure));
      for (const m of models) for (const v of m.versions) {
        const f = v[r.field];
        if (f && f.tier === "T3") assert.ok(!listed.has(f as never));
      }
    }
  });

  test("RF-7: ties repeat the number and say «empate» under it; no tie, no word", () => {
    for (const r of RANKINGS) {
      const lis = items(page(r.url));
      const nums = lis.map((li) => Number(/data-place="(\d+)"/.exec(li)![1]));
      lis.forEach((li, i) => {
        const tied = nums.filter((n) => n === nums[i]).length > 1;
        assert.equal(/data-tie/.test(li), tied, `${r.url} #${i + 1}`);
        if (tied) assert.match(text(/<h3[\s\S]*?<\/h3>/.exec(li)![0]), new RegExp(`^Puesto ${nums[i]} empate `));
      });
    }
  });

  test("RF-14: no extra figures in a place beyond the ranking's, source date and the note", () => {
    for (const r of RANKINGS) {
      for (const li of items(page(r.url))) {
        const ps = [...li.matchAll(/<p\b[^>]*\bdata-(\w+)/g)].map((m) => m[1]);
        assert.deepEqual(ps.filter((p) => !["version", "segment", "figure", "source", "note"].includes(p)), []);
        assert.doesNotMatch(li, /medalla|insignia|podio/i);
      }
    }
  });
});
