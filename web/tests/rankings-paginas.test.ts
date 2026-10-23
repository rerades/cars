import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { es } from "../src/lib/i18n.ts";
import { RANKINGS } from "../src/lib/rankings.ts";

const text = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const h1 = (html: string) => text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1]);
const docTitle = (html: string) => /<title>([^<]*)<\/title>/.exec(html)![1];
const introOf = (html: string) => text(/<p[^>]*data-intro[^>]*>([\s\S]*?)<\/p>/.exec(html)![1]);

describe("ranking pages (#371)", () => {
  let out: string;
  const slugOf = (url: string) => url.split("/").pop()!;
  const page = (url: string) => readFileSync(join(out, url, "index.html"), "utf8");

  before(() => {
    out = mkdtempSync(join(tmpdir(), "cars-rankings-"));
    const env = { ...process.env };
    delete env.CARS_DATA_DIR;
    execFileSync("pnpm", ["exec", "astro", "build", "--outDir", out], {
      cwd: resolve(import.meta.dirname, ".."),
      env,
      stdio: "pipe",
    });
  });
  after(() => rmSync(out, { recursive: true, force: true }));

  test("RF-13: five pages at their stable URLs and no /rankings index (404)", () => {
    assert.deepEqual(
      RANKINGS.map((r) => r.url),
      [
        "/rankings/mas-baratos",
        "/rankings/mas-autonomia",
        "/rankings/mas-bateria",
        "/rankings/mas-potencia",
        "/rankings/carga-mas-rapida-en-continua",
      ],
    );
    for (const r of RANKINGS) assert.ok(existsSync(join(out, r.url, "index.html")), r.url);
    // `datos/` holds the JSON for the filters (#447), not a page.
    assert.deepEqual(
      readdirSync(join(out, "rankings")).filter((f) => f !== "datos").sort(),
      RANKINGS.map((r) => slugOf(r.url)).sort(),
    );
    assert.equal(existsSync(join(out, "rankings", "index.html")), false);
  });

  test("CA-1 (header): h1, intro and the order line with field and direction, in the served HTML", () => {
    const orders: Record<string, string> = {
      precio: "Ordenadas por precio, de menor a mayor.",
      autonomia: "Ordenadas por autonomía WLTP, de mayor a menor.",
      bateria: "Ordenadas por capacidad de batería, de mayor a menor.",
      potencia: "Ordenadas por potencia, de mayor a menor.",
      cargaCc: "Ordenadas por potencia máxima de carga en continua, de mayor a menor.",
    };
    for (const r of RANKINGS) {
      const html = page(r.url);
      assert.equal(h1(html), es[`${r.textKey}.titulo` as keyof typeof es]);
      assert.equal(introOf(html), es[`${r.textKey}.entrada` as keyof typeof es]);
      const order = text(/<p[^>]*data-order[^>]*>([\s\S]*?)<\/p>/.exec(html)![1]);
      assert.equal(order, orders[r.id]);
      assert.equal(text(/<p[^>]*data-scope[^>]*>([\s\S]*?)<\/p>/.exec(html)![1]), es["ranking.alcance"]);
      // DOM order: skip link, route, h1, intro, order, scope, results heading
      const at = (s: string) => html.indexOf(s);
      const seq = [at('href="#resultados"'), at("data-ranking-ruta"), at("<h1"), at("data-intro"), at("data-order"), at("data-scope"), at('id="resultados"')];
      assert.ok(seq.every((n, i) => n >= 0 && (i === 0 || n > seq[i - 1])), `${r.url}: order ${seq}`);
    }
  });

  test("route «Coches» → /coches and the title as current page; skip link to the list", () => {
    for (const r of RANKINGS) {
      const html = page(r.url);
      const nav = /<nav[^>]*data-ranking-ruta[\s\S]*?<\/nav>/.exec(html)![0];
      assert.match(nav, /aria-label="Ruta de navegación"/);
      assert.match(nav, /<a[^>]*href="\/coches"[^>]*>\s*Coches\s*<\/a>/);
      assert.match(nav, /<li[^>]*aria-current="page"[^>]*>[^<]*<\/li>/);
      assert.equal(text(/<li[^>]*aria-current="page"[^>]*>([^<]*)<\/li>/.exec(nav)![1]), h1(html));
      assert.match(html, /<a[^>]*href="#resultados"[^>]*>Saltar a los resultados<\/a>/);
      assert.match(html, /<h2 id="resultados"[^>]*>Puestos<\/h2>/);
    }
  });

  test("RF-13, CA-12: title with pagina.tituloDocumento, canonical without query string, no noindex", () => {
    for (const r of RANKINGS) {
      const html = page(r.url);
      assert.equal(docTitle(html), `${h1(html)} · siete3`);
      const links = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)].map((m) => m[0]);
      assert.equal(links.length, 1);
      assert.match(links[0], new RegExp(`href="https://siete3\\.com${r.url}/"`));
      assert.doesNotMatch(links[0], /\?/);
      assert.doesNotMatch(html, /noindex/i);
    }
  });

  test("CA-12: titles, h1 and intros differ from each other and from every other page; no tramo/segmento openings", () => {
    const all = (readdirSync(out, { recursive: true, encoding: "utf8" }) as string[])
      .filter((f) => f.endsWith("index.html") && !f.startsWith("_astro") && f !== "index.html")
      .map((f) => ({ path: "/" + f, html: readFileSync(join(out, f), "utf8") }));
    const rankingPaths = new Set(RANKINGS.map((r) => `${r.url}/index.html`));
    const others = all.filter((p) => !rankingPaths.has(p.path));
    assert.ok(others.length > 1);
    const rankings = all.filter((p) => rankingPaths.has(p.path));
    assert.equal(rankings.length, 5);
    for (const pick of [docTitle, (h: string) => h1(h)]) {
      const mine = rankings.map((p) => pick(p.html));
      assert.equal(new Set(mine).size, 5);
      const theirs = new Set(others.flatMap((p) => (/<h1/.test(p.html) ? [pick(p.html)] : [])));
      for (const m of mine) assert.ok(!theirs.has(m), `"${m}" repeats another page`);
    }
    const intros = rankings.map((p) => introOf(p.html));
    assert.equal(new Set(intros).size, 5);
    const otherIntros = new Set(others.flatMap((p) => (/data-intro/.test(p.html) ? [introOf(p.html)] : [])));
    for (const i of intros) assert.ok(!otherIntros.has(i));
    for (const p of rankings) {
      assert.doesNotMatch(h1(p.html), /^Coches eléctricos (hasta|de más de|de \d)/);
      assert.doesNotMatch(introOf(p.html), /^(Coches eléctricos (hasta|de más de)|Modelos eléctricos con al menos)/);
    }
  });

  test("CA-2 (texts): no scores, averages, «mejor», «recomendado» nor badges in the header; RF-12 no form", () => {
    for (const r of RANKINGS) {
      // header only: the list of places (#372) carries figures and dates
      const body = text(/<main[\s\S]*?<\/header>/.exec(page(r.url))![0]);
      assert.doesNotMatch(body, /\b(mejor(es)?|recomendad[oa]s?|puntuaci[oó]n|media|valoraci[oó]n|insignia|medalla)\b/i);
      assert.doesNotMatch(page(r.url), /<form\b|<script\b/i);
      // the only digits are the 10-place limit of the shared scope line
      assert.deepEqual(body.replace(es["ranking.alcance"], "").match(/\d+/g) ?? [], []);
    }
  });
});
