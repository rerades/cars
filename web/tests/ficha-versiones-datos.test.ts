import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { formatDecimal } from "../src/lib/format.ts";
import { acme, sourced } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");
const text = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/[ \t\r\n]+/g, " ").replace(/ ,/g, ",").trim();

function writeModel(dir: string, model: string, doc: Record<string, any>) {
  mkdirSync(join(dir, "acme"), { recursive: true });
  writeFileSync(join(dir, "acme", `${model}.yaml`), stringify(doc));
}

const base = (name: string, versions: unknown[], specs?: Record<string, unknown>) => ({
  brand: "acme",
  brand_name: "Acme",
  model: name,
  status: sourced("on_sale"),
  ...(specs ? { specs } : {}),
  versions,
});

describe("technical fields of each version (RF-5, RF-6, CA-5, CA-6)", () => {
  let root: string;
  let out: string;
  const page = (m: string) => readFileSync(join(out, "marcas", "acme", m, "index.html"), "utf8");
  const versions = (html: string) => /<section[^>]*data-ficha-versiones[\s\S]*?<\/section>/.exec(html)![0];
  const blocks = (html: string) => /<ol[^>]*data-versiones-bloques[\s\S]*?<\/ol>/.exec(versions(html))![0];
  // The text of a table row (th scope=row) in each block, in block order.
  const rowOf = (blocksHtml: string, label: string) =>
    blocksHtml.split(/<li /).slice(1).map((li) => {
      const m = new RegExp(`<tr[^>]*>\\s*<th scope="row"[^>]*>\\s*${label}\\s*</th>([\\s\\S]*?)</tr>`).exec(li);
      return m ? text(m[1]!) : null;
    });
  // The range figure of each block: from its cifra up to the price cifra.
  const rangeOf = (blocksHtml: string) =>
    blocksHtml.split(/<li /).slice(1).map((li) => text(/<div[^>]*data-figure="range"[\s\S]*?(?=<div[^>]*data-figure="price")/.exec(li)![0]));

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-ficha-datos-"));
    const data = join(root, "data");
    writeModel(data, "Volta", acme());
    // No version carries wltp_km, but specs does (CA-5, second half). Decimal battery.
    writeModel(data, "NoRange", base("NoRange", [
      { name: "NR A", battery_kwh: sourced(77.5, { basis: "unknown" }), price: null },
      { name: "NR B", price: null },
    ], { wltp_max_km: sourced(557) }));
    writeModel(data, "OneRange", base("OneRange", [
      { name: "OR A", wltp_km: sourced(441), price: null },
      { name: "OR B", price: null },
    ], { wltp_max_km: sourced(441) })); // data-model rule 8: equals the maximum of the versions
    // CA-9: one T3 and one T1 datum in a version block, and the same in «Datos del modelo».
    writeModel(data, "Tiers", base("Tiers", [
      {
        name: "T A",
        power_kw: sourced(200, { tier: "T3", url: "https://unofficial.example/power" }),
        drivetrain: sourced("awd", { url: "https://www.acme.example/es/drive" }),
        price: null,
      },
      { name: "T B", power_kw: sourced(150, { url: "https://www.acme.example/es/power-b" }), price: null },
    ], {
      dc_max_kw: sourced(150, { tier: "T3", url: "https://unofficial.example/dc" }),
      ac_max_kw: sourced(11, { url: "https://www.acme.example/es/ac" }),
    }));
    out = join(root, "out");
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", out], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("formatDecimal keeps decimals in es-ES", () => {
    assert.equal(formatDecimal(77.5), "77,5");
    assert.equal(formatDecimal(58), "58");
  });

  test("each block: range and price figures, then the table rows in the order of «Campos y formato»", () => {
    const html = blocks(page("Volta"));
    const dts = [...html.matchAll(/<dt[^>]*>([^<]*)/g)].map((m) => m[1]);
    assert.deepEqual(dts.slice(0, 2), ["Autonomía WLTP", "Precio"]);
    const labels = [...html.split(/<li /)[1]!.matchAll(/<th scope="row"[^>]*>\s*([^<]*?)\s*<\/th>/g)].map((m) => m[1]);
    assert.deepEqual(labels, ["Batería", "Potencia", "Tracción", "Carga máxima en CC", "Carga máxima en CA"]);
    assert.equal((html.match(/<table\b/g) ?? []).length, 3);
  });

  test("CA-5: each version shows its range in km", () => {
    const r = rangeOf(blocks(page("Volta")));
    assert.match(r[0]!, /470 km/);
    assert.match(r[1]!, /520 km/);
    assert.match(r[2]!, /490 km/);
  });

  test("CA-5: no version range -> «por confirmar» in each version, the figure only as model data", () => {
    const html = page("NoRange");
    for (const r of rangeOf(blocks(html))) assert.match(r, /^Autonomía WLTP por confirmar$/);
    assert.doesNotMatch(text(versions(html)), /557/);
    const model = /<section[^>]*data-ficha-modelo[\s\S]*?<\/section>/.exec(html)![0];
    assert.match(text(model), /Autonomía WLTP máxima del modelo (?:\[\d+\] )?557 km/);
  });

  test("CA-5: with some version range, specs.wltp_max_km does not fill the others", () => {
    const r = rangeOf(blocks(page("OneRange")));
    assert.match(r[0]!, /441 km/);
    assert.match(r[1]!, /por confirmar/);
  });

  test("CA-6: battery basis is shown (útil, bruta, sin especificar) and decimals are kept", () => {
    const volta = rowOf(blocks(page("Volta")), "Batería");
    assert.match(volta[0]!, /^60 kWh, útil/);
    assert.match(volta[1]!, /^80 kWh, bruta/);
    assert.equal(volta[2], "por confirmar");
    const nr = rowOf(blocks(page("NoRange")), "Batería");
    assert.match(nr[0]!, /^77,5 kWh, sin especificar si es útil o bruta/);
  });

  test("CA-6: a version without dc_max_kw says «por confirmar», not a value", () => {
    const row = rowOf(blocks(page("Volta")), "Carga máxima en CC");
    assert.equal(row[0], "por confirmar"); // Volta 60
    assert.match(row[1]!, /^150 kW/);
    assert.equal(row[2], "por confirmar");
    // AC: nobody has it; the row is still there.
    assert.deepEqual(rowOf(blocks(page("Volta")), "Carga máxima en CA"), ["por confirmar", "por confirmar", "por confirmar"]);
  });

  test("CA-8: a note sits next to its datum, identical; drivetrain label in Spanish", () => {
    const html = blocks(page("Volta"));
    assert.match(rowOf(html, "Potencia")[1]!, /^220 kW \[2\] publicado: 299 CV/);
    assert.deepEqual(rowOf(html, "Tracción").map((x) => x!.split(" ")[0]), ["Trasera", "Total", "Total"]);
  });

  test("CA-9: «fuente no oficial» goes with a T3 datum, not a T1 one, in versions and in model data", () => {
    const html = page("Tiers");
    const unofficial = (s: string) => (s.match(/data-unofficial/g) ?? []).length;
    const marks = (s: string) => (s.match(/data-source-mark=/g) ?? []).length;
    // Version A: a T3 power and a T1 drivetrain -> two marks, one «no oficial», next to the power.
    const [a, b] = blocks(html).split(/<li /).slice(1);
    assert.equal(marks(a!), 2);
    assert.equal(unofficial(a!), 1);
    assert.match(rowOf(blocks(html), "Potencia")[0]!, /fuente no oficial/);
    assert.doesNotMatch(rowOf(blocks(html), "Tracción")[0]!, /no oficial/);
    // Version B: only a T1 datum -> a mark, no «no oficial».
    assert.equal(marks(b!), 1);
    assert.equal(unofficial(b!), 0);
    assert.doesNotMatch(rowOf(blocks(html), "Potencia")[1]!, /no oficial/);
    // Model data: T3 dc_max_kw says it, T1 ac_max_kw does not.
    const model = /<section[^>]*data-ficha-modelo[\s\S]*?<\/section>/.exec(html)![0];
    assert.equal(marks(model), 2);
    assert.equal(unofficial(model), 1);
    assert.match(text(model), /Carga máxima en CC \[\d+\] fuente no oficial 150 kW/);
    assert.doesNotMatch(text(model), /Carga máxima en CA \[\d+\] fuente no oficial/);
  });

  test("«por confirmar» carries no mark; valued fields carry a mark to «Fuentes»", () => {
    const html = page("Volta");
    for (const m of blocks(html).matchAll(/<p[^>]*data-missing[^>]*>[\s\S]*?<\/p>/g)) {
      assert.doesNotMatch(m[0], /<a\b|Fuente/);
    }
    assert.match(blocks(html), /<a href="#fuente-2"[^>]*data-source-mark="2"/);
  });
});
