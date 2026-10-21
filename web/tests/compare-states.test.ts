import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { emptyText, noticeParagraphs, parseEntries, validateSelection, type SelectableModel } from "../src/lib/compare.ts";
import { t } from "../src/lib/i18n.ts";

const model = (slug: string, over: Partial<SelectableModel> = {}): SelectableModel => ({
  brand: "acme", slug, status: { value: "on_sale" }, versions: [{ name: "Base" }], ...over,
});
const models = [
  model("a"), model("b"), model("c"), model("d"),
  model("old", { status: { value: "discontinued" } }),
  model("review", { needs_review: true }),
];
const select = (query: string) => validateSelection(parseEntries(query), models);

describe("URL notice (RF-11, CA-2, CA-13)", () => {
  test("CA-2: 4 valid versions give 3 columns and the maximum notice", () => {
    const sel = select("v=acme/a&v=acme/b&v=acme/c&v=acme/d");
    assert.equal(sel.columns.length, 3);
    assert.deepEqual(noticeParagraphs(sel), [t("comparador.aviso.maximo")]);
  });

  test("CA-13: excluded model, unknown version and repeat beside two valid ones", () => {
    const sel = select("v=acme/a&v=acme/old&v=acme/b/Nope&v=acme/a&v=acme/b");
    assert.deepEqual(sel.columns.map((c) => c.slug), ["a", "b"]);
    assert.deepEqual(noticeParagraphs(sel), [
      t("comparador.aviso.ignoradas.other", { n: 3 }),
    ]);
  });

  test("singular for one ignored value, and the URL's text is never repeated", () => {
    const sel = select("v=acme/a&v=acme/b&v=<script>alert(1)</script>/x");
    const [p] = noticeParagraphs(sel);
    assert.equal(p, t("comparador.aviso.ignoradas.one", { n: 1 }));
    assert.ok(!p!.includes("script"));
  });

  test("both causes: two paragraphs, ignored first", () => {
    const sel = select("v=acme/a&v=acme/b&v=acme/c&v=acme/d&v=acme/zzz");
    assert.deepEqual(noticeParagraphs(sel), [
      t("comparador.aviso.ignoradas.one", { n: 1 }),
      t("comparador.aviso.maximo"),
    ]);
  });

  test("a clean URL has no notice", () => {
    assert.deepEqual(noticeParagraphs(select("v=acme/a&v=acme/b")), []);
    assert.deepEqual(noticeParagraphs(select("")), []);
  });
});

describe("fewer than 2 versions (RF-12, CA-14)", () => {
  test("0 versions: the general text; 1: ask for one more; 2 or more: none", () => {
    assert.equal(emptyText(0), t("comparador.vacio.texto"));
    assert.equal(emptyText(1), t("comparador.vacio.unoMas"));
    assert.equal(emptyText(2), null);
    assert.equal(emptyText(3), null);
  });

  test("CA-14: no selection, or only invalid ones, or one valid, gives fewer than 2 columns without throwing", () => {
    assert.equal(select("").columns.length, 0);
    assert.equal(select("v=acme/old&v=basura").columns.length, 0);
    assert.equal(select("v=acme/a&v=acme/old").columns.length, 1);
    assert.match(t("comparador.vacio.texto"), /al menos 2 coches/);
    assert.match(t("comparador.vacio.unoMas"), /al menos un coche más/);
  });
});

describe("served shell of /comparar/ (RNF-6, CA-14)", () => {
  const page = readFileSync(new URL("../src/pages/comparar.astro", import.meta.url), "utf8");
  const table = readFileSync(new URL("../src/components/ComparisonTable.astro", import.meta.url), "utf8");

  test("loading is a role=status paragraph, hidden until the script shows it", () => {
    assert.match(page, /role="status"[^>]*data-loading hidden/);
    assert.match(page, /messages\.loading/);
  });

  test("error state links to /coches and is hidden by default", () => {
    assert.match(page, /data-error hidden>[\s\S]*?href="\/coches"/);
  });

  test("the URL notice is not a live region and starts with the «Aviso:» prefix", () => {
    const notice = page.slice(page.indexOf("data-url-notice"), page.indexOf("data-chosen hidden"));
    assert.doesNotMatch(notice, /role=|aria-live/);
    assert.match(notice, /comparador\.aviso\.prefijo/);
  });

  test("the catalogue link and the chosen list start hidden; the script never uses innerHTML", () => {
    assert.match(page, /data-empty-link\s+hidden/);
    assert.doesNotMatch(table, /\.innerHTML\s*=|insertAdjacentHTML/);
  });
});
