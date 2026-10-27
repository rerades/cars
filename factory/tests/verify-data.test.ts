/** Tests for the data verifier (ADR-0020 and its amendment «Versión y unidad»). Run: pnpm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { changedItems, numberPattern, report, summary, verify, type Changes } from "../verify-data.ts";

const HOSTS = new Set(["acme.es"]);
const PRICES = "https://www.acme.es/precios";
const SPECS = "https://www.acme.es/ficha";
const FILE = "data/raw/acme/volta.yaml";
const src = (value: unknown, url = PRICES) => ({ value, source_id: "acme-es", url, retrieved: "2026-10-27", tier: "T1" });
const price = (value: number, url = PRICES) => ({ ...src(value, url), unit: "EUR", price_kind: "pvp" });
const doc = (versions: unknown[], extra = {}) => ({ brand: "acme", model: "Volta", status: src("on_sale"), versions, ...extra });

/** A fake fetch: robots.txt from `robots`, each page from `pages` (a number is an HTTP status). */
const fake = (pages: Record<string, string | number>, robots = "") => (async (u: URL) => {
  if (u.pathname === "/robots.txt") return new Response(robots);
  const page = pages[u.href];
  if (page === undefined) return new Response("", { status: 404 });
  return typeof page === "number" ? new Response("", { status: page }) : new Response(page);
}) as typeof fetch;
const run = (changes: Changes, pages: Record<string, string | number>, robots = "") =>
  verify(changes, { fetchImpl: fake(pages, robots), hosts: HOSTS, sleep: async () => {} });
const versionsOf = (...v: [string, number][]) => doc(v.map(([name, p]) => ({ name, price: price(p) })));

test("changedItems: only new values or values whose value or url changed; enums are not verifiable", () => {
  const base = versionsOf(["Volta 60", 39990], ["Volta 80", 45990]);
  const head = doc([{ name: "Volta 60", price: price(39990) }, { name: "Volta 80", price: price(44990) },
    { name: "Volta 80 AWD", price: price(49990), wltp_km: src(470, SPECS) }], { segment: src("suv_compacto") });
  const { items, unverifiable } = changedItems(FILE, base, head);
  assert.deepEqual(items.map((i) => [i.path, i.value, i.version ?? null]), [
    ["versions[Volta 80].price", 44990, "Volta 80"],
    ["versions[Volta 80 AWD].price", 49990, "Volta 80 AWD"],
    ["versions[Volta 80 AWD].wltp_km", 470, null],
  ]);
  assert.deepEqual(unverifiable.map((u) => u.path), ["segment"]);
  const terms = { ...price(299), price_kind: "financed", price_terms: "Cuota de 299 €/mes.", price_terms_url: SPECS };
  const t = changedItems(FILE, null, doc([{ name: "Volta 60", price: terms }]));
  assert.deepEqual(t.items.map((i) => [i.field, i.url]), [["price", PRICES], ["price_terms", SPECS]]);
});

test("numberPattern: the usual Spanish spellings, never inside another figure", () => {
  const hits = (v: number, s: string) => numberPattern(v).test(s);
  for (const s of ["39990", "39.990 €", "39 990 €", "39.990,00 €"]) assert.ok(hits(39990, s), s);
  assert.ok(hits(77.4, "77,4 kWh") && hits(77.4, "77.40") && hits(77, "77,0 kWh"));
  assert.ok(!hits(399, "39990") && !hits(990, "39.990") && !hits(39990, "39.990,50") && !hits(77, "77,4"));
});

test("CA-10: a price that is not in its page sends the PR to a person, with the value and its URL", async () => {
  const v = await run(changedItems(FILE, null, versionsOf(["Volta 60", 39990])), { [PRICES]: "<h2>Volta 60</h2><p>Desde 38.990 €</p>" });
  assert.equal(v.blocking, true);
  const text = report(v);
  assert.match(text, /No coincide: .*`versions\[Volta 60\]\.price` = `39990` no está en https:\/\/www\.acme\.es\/precios \(HTTP 200/);
  assert.match(text, /JavaScript/);
  assert.match(text, /«Desde 38\.990 €»/);
});

test("the price in another spelling, under its version, is found and the PR goes on", async () => {
  const v = await run(changedItems(FILE, null, versionsOf(["Volta 60", 39990])), { [PRICES]: "<h3>Volta 60</h3><p>PVP</p><p>39.990&nbsp;€</p>" });
  assert.equal(v.blocking, false);
  assert.equal(summary(v).found, 1);
});

test("a 403 or a robots.txt that forbids the page does not block; a 404 or an unregistered host does", async () => {
  const changes = changedItems(FILE, null, versionsOf(["Volta 60", 39990]));
  assert.equal((await run(changes, { [PRICES]: 403 })).blocking, false);
  const robots = await run(changes, { [PRICES]: "<p>39.990</p>" }, "User-agent: *\nDisallow: /precios");
  assert.equal(robots.blocking, false);
  assert.equal(summary(robots).unchecked, 1);
  assert.equal((await run(changes, {})).blocking, true, "404 is broken");
  const other = changedItems(FILE, null, doc([{ name: "Volta 60", price: price(39990, "https://www.otra.es/p") }]));
  assert.match(report(await run(other, {})), /rechazada por las reglas de fetch-page\.ts/);
});

test("IDAE values are not checkable: their page is a query form", async () => {
  const idae = "https://coches.idae.es/base-datos/marca-y-modelo";
  const v = await run(changedItems(FILE, null, doc([{ name: "Volta 60", wltp_km: src(470, idae) }])), {});
  assert.equal(v.blocking, false);
  assert.match(report(v), /No comprobables \(1\):\n- https:\/\/coches\.idae\.es\/base-datos\/marca-y-modelo \(datos de una consulta/);
});

test("a price in the row of another version blocks, with both paragraphs", async () => {
  const changes = changedItems(FILE, null, versionsOf(["Volta 60", 45990], ["Volta 80", 49990]));
  const page = "<table><tr><td>Volta 60</td><td>39.990 €</td></tr><tr><td>Volta 80</td><td>45.990 €</td></tr></table><p>49.990 € en Volta 80</p>";
  const v = await run(changes, { [PRICES]: page });
  assert.equal(v.blocking, true);
  const text = report(v);
  assert.match(text, /No coincide \(otra versión\): .*`versions\[Volta 60\]\.price` = `45990`/);
  assert.match(text, /aparece bajo «Volta 80»: «Volta 80 45\.990 €»/);
  assert.match(text, /la versión está en: «Volta 60 39\.990 €»/);
});

test("two cards in a row, each price under its own name, go on", async () => {
  const changes = changedItems(FILE, null, versionsOf(["Volta 60", 39990], ["Volta 80", 45990]));
  const page = "<h3>Volta 60</h3><p>470 km</p><p>Desde 39.990 €</p><h3>Volta 80</h3><p>520 km</p><p>Desde 45.990 €</p>";
  const v = await run(changes, { [PRICES]: page });
  assert.equal(v.blocking, false);
  assert.equal(summary(v).found, 2);
});

test("a table with one version per column does not block, and a page without names gives «sin versión»", async () => {
  const changes = changedItems(FILE, null, versionsOf(["Volta 60", 39990], ["Volta 80", 45990]));
  const columns = await run(changes, { [PRICES]: "<table><tr><th>Volta 60</th><th>Volta 80</th></tr><tr><td>39.990 €</td><td>45.990 €</td></tr></table>" });
  assert.equal(columns.blocking, false);
  const nameless = await run(changes, { [PRICES]: "<p>Desde 39.990 €</p><p>Hasta 45.990 €</p>" });
  assert.equal(nameless.blocking, false);
  assert.equal(summary(nameless).unanchored, 2);
  assert.match(report(nameless), /Encontrados sin versión \(2\)/);
});

test("«Volta 80» and «Volta 80 AWD» on the same page are not mixed up", async () => {
  const changes = changedItems(FILE, null, versionsOf(["Volta 80", 45990], ["Volta 80 AWD", 49990]));
  const ok = await run(changes, { [PRICES]: "<p>Volta 80: 45.990 €</p><p>Volta 80 AWD: 49.990 €</p>" });
  assert.equal(ok.blocking, false);
  const swapped = await run(changes, { [PRICES]: "<p>Volta 80 AWD: 45.990 €</p><p>Volta 80: 49.990 €</p>" });
  assert.equal(swapped.blocking, true);
});

test("a one- or two-digit number counts as found only with its unit; without it, «sin unidad», no block", async () => {
  const changes = changedItems(FILE, null, doc([{ name: "Volta 60", ac_max_kw: src(11, SPECS) }]));
  const bare = await run(changes, { [SPECS]: "<p>Carga en alterna</p><p>11</p>" });
  assert.equal(bare.blocking, false);
  assert.equal(summary(bare).no_unit, 1);
  const unit = await run(changes, { [SPECS]: "<p>Carga en alterna: 11&nbsp;kW</p>" });
  assert.equal(summary(unit).found, 1);
  assert.equal(summary(await run(changes, { [SPECS]: "<p>Batería de 11 kWh</p>" })).no_unit, 1, "kW is not kWh");
  assert.equal((await run(changes, { [SPECS]: "<p>Carga en alterna</p>" })).blocking, true, "absent still blocks");
});

test("price_terms is searched literally, with spaces collapsed", async () => {
  const terms = { ...price(299), price_kind: "financed", price_terms: "Cuota de 299 €/mes.  TAE 7,9 %.", price_terms_url: SPECS };
  const changes = changedItems(FILE, null, doc([{ name: "Volta 60", price: { ...terms, url: SPECS } }]));
  assert.equal((await run(changes, { [SPECS]: "<p>Volta 60</p><p>Cuota de 299 €/mes. TAE 7,9 %.</p>" })).blocking, false);
  assert.equal((await run(changes, { [SPECS]: "<p>Volta 60</p><p>Cuota de 299 €/mes. TAE 8,9 %.</p>" })).blocking, true);
});

test("at most 10 URLs, prices first and then by URL; the rest is listed as out of the sample", async () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ name: `V${i}`, wltp_km: src(400 + i, `https://www.acme.es/f${String(i).padStart(2, "0")}`) }));
  const changes = changedItems(FILE, null, doc([...many, { name: "Z", price: price(39990, "https://www.acme.es/zz") }]));
  const v = await run(changes, {});
  assert.equal(v.urls.length, 10);
  assert.equal(v.urls[0].url, "https://www.acme.es/zz");
  assert.deepEqual(v.outOfSample.map((i) => i.url), ["https://www.acme.es/f09", "https://www.acme.es/f10", "https://www.acme.es/f11"]);
});
