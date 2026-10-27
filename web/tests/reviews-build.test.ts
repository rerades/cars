import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { acme, sourced } from "./fixtures.ts";

/**
 * Story #602 (PRD-006): whole-site checks on the built «Reviews» block. CA-3, CA-4, CA-5, CA-9
 * (RF-3, RF-4, RF-5, RF-10, RNF-1, RNF-3, RNF-5). Fixtures: a published model with reviews, one with
 * needs_review: true and reviews, and one without reviews.
 */
const WEB = join(import.meta.dirname, "..");

const TITLE_OK = "Acme Volta 80 AWD: probamos el SUV eléctrico de 520 km";
const TITLE_HIDDEN = "Acme Pending: primera prueba secreta";
const URL_OK = "https://www.motor.example/pruebas/acme-volta-80-awd";
const URL_HIDDEN = "https://www.motor.example/pruebas/acme-pending-secreta";

const review = (extra: Record<string, unknown> = {}) => ({
  title: TITLE_OK,
  url: URL_OK,
  source_id: "motorejemplo-es",
  retrieved: "2026-09-20",
  tier: "T3",
  ...extra,
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
}

describe("«Reviews» block in the built site (PRD-006, story #602)", () => {
  let root: string;
  let out: string;
  const rel = (p: string) => p.slice(out.length);
  const page = (m: string) => readFileSync(join(out, "marcas", "acme", m, "index.html"), "utf8");
  const block = () => /<section[^>]*data-reviews[\s\S]*?<\/section>/.exec(page("Volta"))![0];
  const write = (model: string, doc: Record<string, unknown>) => {
    mkdirSync(join(root, "data", "acme"), { recursive: true });
    writeFileSync(join(root, "data", "acme", `${model}.yaml`), stringify(doc));
  };
  const base = (name: string, extra: Record<string, unknown>) => ({
    brand: "acme",
    brand_name: "Acme",
    model: name,
    status: sourced("on_sale", { url: "https://www.acme.example/status" }),
    versions: [],
    ...extra,
  });

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-reviews-build-"));
    mkdirSync(join(root, "sources"), { recursive: true });
    writeFileSync(
      join(root, "sources", "motorejemplo-es.yaml"),
      stringify({
        id: "motorejemplo-es",
        brand: "varias",
        name: "Motor Ejemplo",
        tier: "T3",
        market: "ES",
        kind: ["reviews"],
        urls: { home: "https://www.motor.example/" },
        terms_url: "https://www.motor.example/aviso-legal",
        terms_checked: "2026-09-20",
      }),
    );
    const withReviews = acme();
    withReviews.reviews = [review({ version: "Volta 80 AWD" }), review({ title: "Acme Volta, primera prueba", url: "https://videos.motor.example/acme-volta" })];
    write("Volta", withReviews);
    write("Plain", base("Plain", {}));
    write("Pending", base("Pending", { needs_review: true, reviews: [review({ title: TITLE_HIDDEN, url: URL_HIDDEN })] }));
    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: join(root, "data"), CARS_SOURCES_DIR: join(root, "sources") },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("RNF-1: the block is in the served HTML, with no script inside it", () => {
    assert.match(block(), /data-reviews/);
    assert.doesNotMatch(block(), /<script/i);
  });

  test("CA-3: no form, input, textarea, select, button or account link in the block", () => {
    const b = block();
    assert.doesNotMatch(b, /<(form|input|textarea|select|button|label)\b/i);
    assert.doesNotMatch(b, /href="[^"]*(login|signin|sign-in|registr|cuenta|account|voto|vote)/i);
    assert.doesNotMatch(b, /\b(onclick|onsubmit|role="button")/i);
  });

  test("CA-3: the whole page with reviews has no form, text field or vote button", () => {
    assert.doesNotMatch(page("Volta"), /<(form|input|textarea|select)\b/i);
  });

  test("CA-3: the built JavaScript does not touch cookies, localStorage or sessionStorage", () => {
    const js = walk(out).filter((f) => f.endsWith(".js"));
    assert.ok(js.length > 0, "no .js in the build");
    const forbidden = /\b(localStorage|sessionStorage|indexedDB)\b|document\.cookie/;
    for (const f of js) {
      const hit = forbidden.exec(readFileSync(f, "utf8"));
      assert.equal(hit, null, `${rel(f)} contains ${hit?.[0]}`);
    }
    // The HTML of the page does not set cookies either (no inline script, no meta refresh).
    assert.doesNotMatch(page("Volta"), /document\.cookie|http-equiv="set-cookie"/i);
  });

  test("CA-4: reviews of a needs_review model appear in no page nor data file of the build", () => {
    assert.equal(existsSync(join(out, "marcas", "acme", "Pending")), false);
    for (const f of walk(out).filter((p) => /\.(html|json|xml|txt|js)$/.test(p))) {
      const text = readFileSync(f, "utf8");
      assert.ok(!text.includes(TITLE_HIDDEN), `${rel(f)} has the hidden title`);
      assert.ok(!text.includes(URL_HIDDEN), `${rel(f)} has the hidden URL`);
    }
  });

  test("CA-4: the review of a published model is in the page of that model, /marcas/acme/Volta/", () => {
    assert.ok(existsSync(join(out, "marcas", "acme", "Volta", "index.html")));
    assert.ok(page("Volta").includes(TITLE_OK));
  });

  test("CA-5: every link of the block goes to the review's own URL; none has affiliate parameters", () => {
    const hrefs = [...block().matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    // Order is #600's concern (reviews-order.test.ts); CA-5 is only about which URLs.
    assert.deepEqual([...hrefs].sort(), [URL_OK, "https://videos.motor.example/acme-volta"].sort());
    for (const h of hrefs) assert.doesNotMatch(new URL(h).search, /(^|[?&])(utm_[^=]*|aff[^=]*|ref|tag)=/i);
  });

  test("CA-5: links of the page lead only to internal pages, the review source or the brand's official site", () => {
    const hrefs = [...page("Volta").matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length > 0);
    const officialOrSource = /(^|\.)(motor|acme)\.example$/;
    for (const h of hrefs) {
      if (h.startsWith("/") || h.startsWith("#")) continue;
      const u = new URL(h);
      assert.match(u.hostname, officialOrSource, `external link ${h}`);
      assert.doesNotMatch(u.search, /(^|[?&])(utm_[^=]*|aff[^=]*|ref|tag)=/i, `affiliate parameter in ${h}`);
    }
  });

  test("CA-9: reviews appear only in /marcas/acme/Volta/, no other page has the block or the title", () => {
    const holders = walk(out)
      .filter((f) => f.endsWith(".html"))
      .filter((f) => /data-reviews|id="reviews"/.test(readFileSync(f, "utf8")) || readFileSync(f, "utf8").includes(TITLE_OK))
      .map(rel);
    assert.deepEqual(holders, ["/marcas/acme/Volta/index.html"]);
    assert.deepEqual(walk(out).map(rel).filter((p) => /review/i.test(p)), []);
  });

  test("CA-9: the block comes after the rest of the sheet and is the last section of the page", () => {
    const html = page("Volta");
    const at = html.indexOf('<section aria-labelledby="reviews"');
    assert.ok(at > html.indexOf("data-ficha-modelo"));
    assert.ok(at > html.indexOf("data-fuentes"));
    assert.equal(html.slice(at).split("<section").length, 2, "no section after Reviews");
  });

  test("a model without reviews has no block", () => {
    assert.doesNotMatch(page("Plain"), /data-reviews|id="reviews"/);
  });
});
