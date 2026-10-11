import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { homeCountLabel } from "../src/lib/catalog.ts";
import { t } from "../src/lib/i18n.ts";
import { sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");

interface Spec {
  brand: string;
  model: string;
  status?: "on_sale" | "announced" | "discontinued";
  segment?: string;
  review?: boolean;
}

const doc = (s: Spec) => ({
  brand: s.brand,
  brand_name: s.brand.toUpperCase(),
  model: s.model,
  status: sourced(s.status ?? "on_sale"),
  needs_review: s.review === true,
  ...(s.segment ? { segment: sourced(s.segment) } : {}),
  versions: [
    {
      name: `${s.model} 1`,
      price: sourced(39990, { unit: "EUR", price_kind: "pvp" }),
      wltp_km: sourced(470),
    },
  ],
});

/** Builds the site on test data (CARS_DATA_DIR); `broken` adds an unreadable YAML. Returns the output dir and the log. */
function build(root: string, specs: Spec[], broken = false): { out: string; log: string } {
  const data = join(root, "data");
  mkdirSync(data, { recursive: true });
  for (const s of specs) {
    mkdirSync(join(data, s.brand), { recursive: true });
    writeFileSync(join(data, s.brand, `${s.model}.yaml`), stringify(doc(s)));
  }
  if (broken) {
    mkdirSync(join(data, "acme"), { recursive: true });
    writeFileSync(join(data, "acme", "broken.yaml"), "brand: [unclosed");
  }
  const out = join(root, "out");
  const r = spawnSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
    cwd: WEB,
    env: { ...process.env, CARS_DATA_DIR: data },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `build failed:\n${r.stdout}\n${r.stderr}`);
  return { out, log: `${r.stdout}\n${r.stderr}` };
}

const text = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const h1s = (html: string) => [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]));
const introOf = (html: string) => /<p[^>]*data-intro[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1];
const titleOf = (html: string) => /<title>([^<]*)<\/title>/.exec(html)![1];
const navOf = (html: string) => /<nav[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
const allPages = (out: string) =>
  (readdirSync(out, { recursive: true, encoding: "utf8" }) as string[])
    .filter((f) => f.endsWith("index.html") && !f.startsWith("_astro"))
    .map((f) => ({ path: "/" + f.slice(0, -"index.html".length), html: readFileSync(join(out, f), "utf8") }));

test("homeCountLabel: plural by Intl.PluralRules, es-ES number format", () => {
  assert.equal(homeCountLabel(1), "1 modelo en el catálogo");
  assert.equal(homeCountLabel(36), "36 modelos en el catálogo");
  assert.equal(homeCountLabel(1234), "1.234 modelos en el catálogo");
});

describe("home page with models", () => {
  const SPECS: Spec[] = [
    { brand: "acme", model: "sale", status: "on_sale", segment: "suv_compacto" },
    { brand: "acme", model: "soon", status: "announced" },
    { brand: "zeta", model: "old", status: "discontinued", segment: "urbano" },
    { brand: "ghost", model: "hidden", segment: "berlina", review: true },
  ];
  let root: string;
  let out: string;
  let log: string;
  let home: string;
  let coches: string;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-home-"));
    ({ out, log } = build(root, SPECS, true));
    home = readFileSync(join(out, "index.html"), "utf8");
    coches = readFileSync(join(out, "coches", "index.html"), "utf8");
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-1: a single h1 with the site name, the intro about electric cars and the counter", () => {
    assert.deepEqual(h1s(home), [t("sitio.nombre")]);
    assert.equal(text(introOf(home)!), t("pagina.portada.entrada"));
    assert.match(text(introOf(home)!), /coches eléctricos/);
    assert.match(home, /<p[^>]*data-count[^>]*>\s*3 modelos en el catálogo\s*<\/p>/);
    assert.equal(titleOf(home), t("pagina.portada.tituloDocumento"));
    assert.match(home, /<html lang="es">/);
  });

  test("CA-2: counter is 3 (sale, announced, discontinued; needs_review left out) and equals the cards of /coches", () => {
    const results = coches.slice(coches.indexOf('id="resultados"'));
    const cards = [...results.matchAll(/<h3\b/g)].length;
    assert.equal(cards, 3);
    assert.match(text(/<p[^>]*data-count[^>]*>([\s\S]*?)<\/p>/.exec(home)![1]), /^3 modelos/);
    assert.doesNotMatch(home, /hidden|GHOST/i);
  });

  test("CA-3: same strip as /coches plus «Todos los coches» to /coches, no aria-current, only existing pages", () => {
    const nav = navOf(home);
    const withoutAll = squash(nav.replace(/<p\b[^>]*>\s*<a[^>]*href="\/coches\/"[\s\S]*?<\/p>/, ""));
    assert.equal(withoutAll, squash(navOf(coches)));
    assert.match(nav, /<h2 id="explorar"[^>]*>Explorar<\/h2>/);
    assert.match(nav, /aria-labelledby="explorar"/);
    assert.deepEqual([...nav.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]), [
      "Marcas",
      "Segmentos",
      "Precio",
      "Autonomía",
    ]);
    const links = hrefs(nav);
    assert.equal(links.at(-1), "/coches/");
    assert.match(nav, /<a[^>]*>\s*Todos los coches\s*<\/a>/);
    assert.doesNotMatch(home, /aria-current/);
    for (const href of links) assert.ok(existsSync(join(out, href, "index.html")), `${href} is not built`);
    assert.ok(!links.includes("/marcas/ghost/"));
    assert.ok(!links.includes("/segmentos/berlina/"));
    assert.equal(home.match(/<h2\b/g)?.length, 1);
  });

  test("CA-4: every published model is reachable as / -> /marcas/{brand}/ -> its sheet", () => {
    const fromHome = hrefs(home);
    for (const s of SPECS.filter((x) => !x.review)) {
      const brandHref = `/marcas/${s.brand}/`;
      assert.ok(fromHome.includes(brandHref), `home does not link ${brandHref}`);
      const brandPage = readFileSync(join(out, "marcas", s.brand, "index.html"), "utf8");
      const sheet = hrefs(brandPage).find((h) => h.toLowerCase() === `/marcas/${s.brand}/${s.model}/`);
      assert.ok(sheet, `${brandHref} does not link the sheet of ${s.model}`);
      assert.ok(existsSync(join(out, sheet, "index.html")), `${sheet} is not built`);
    }
  });

  test("CA-5: no prices, ranges, versions, statuses, source_id or read-error notice on the page; the notice goes to the build log", () => {
    // The band links of the strip ("Hasta 30.000 €", "Más de 400 km") are not car data: look for the fixture's values.
    assert.doesNotMatch(text(home), /39\.?990|\b470\b|Precio desde|WLTP máxima|Hasta \d+ km|acme-es|retrieved/);
    assert.doesNotMatch(home, /acme-es|No se pudieron leer|Próximamente|Descatalogado|A la venta|<img|<svg/);
    assert.match(log, /No se pudieron leer 1 ficheros/);
  });

  test("CA-7: title and intro of / differ from those of every other page", () => {
    const others = allPages(out).filter((p) => p.path !== "/");
    assert.ok(others.length > 5);
    for (const p of others) {
      assert.notEqual(titleOf(p.html), titleOf(home), `title repeated in ${p.path}`);
      const i = introOf(p.html);
      if (i) assert.notEqual(text(i), text(introOf(home)!), `intro repeated in ${p.path}`);
    }
  });

  test("CA-8: no form, input, textarea, select or button", () => {
    assert.doesNotMatch(home, /<(form|input|textarea|select|button)\b/i);
  });

  test("CA-9: the served HTML already holds the intro, the counter and every Explorar link; no script", () => {
    assert.doesNotMatch(home, /<script\b/i);
    assert.ok(home.includes(t("pagina.portada.entrada")));
    assert.match(home, /3 modelos en el catálogo/);
    const links = hrefs(navOf(home));
    // 2 brands, 2 segments, 3 price bands, 2 range bands, plus «Todos los coches»
    assert.equal(links.length, 2 + 2 + 3 + 2 + 1);
  });

  test("CA-10: nothing that could create a cookie or write to storage (the browser check lives in e2e/storage.spec.ts)", () => {
    assert.doesNotMatch(home, /<script\b|localStorage|sessionStorage|document\.cookie|set-cookie/i);
  });
});

describe("home page with no published models", () => {
  let root: string;
  let home: string;
  let out: string;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-home-empty-"));
    // The only model is under review: nothing is published.
    ({ out } = build(root, [{ brand: "ghost", model: "hidden", segment: "berlina", review: true }]));
    home = readFileSync(join(out, "index.html"), "utf8");
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("CA-6: h1, intro and the empty notice; no counter, no strip, no links, and the build did not fail", () => {
    assert.deepEqual(h1s(home), [t("sitio.nombre")]);
    assert.equal(text(introOf(home)!), t("pagina.portada.entrada"));
    assert.match(home, new RegExp(`<p[^>]*>\\s*${t("vacio.catalogo.texto")}\\s*</p>`));
    assert.doesNotMatch(home, /<nav\b|data-explore|data-count|<a\b|<h2\b|Explorar|modelos en el catálogo/);
    assert.doesNotMatch(home, /<(form|input|button)\b/i);
  });
});
