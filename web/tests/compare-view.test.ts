import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FIELDS, cellView, conditionTitle, headerView, modelsToFetch, parseEntries, projectModel } from "../src/lib/compare.ts";
import { normalize } from "../src/lib/data.ts";
import { sourced } from "./fixtures.ts";

const price = (value: number, extra: Record<string, unknown> = {}) => ({
  ...sourced(value), unit: "EUR", price_kind: "pvp", ...extra,
});
const battery = (value: number, basis: string) => ({ ...sourced(value), basis });

/** A model published the way the build does it, so the test sees the browser's input. */
function published(over: Record<string, any>) {
  const d = {
    brand: "acme", brand_name: "Acme", model: "Volta", status: sourced("on_sale"), versions: [], ...over,
  };
  return projectModel(normalize(d, `${d.brand}/${d.model}.yaml`), d.model);
}

describe("cellView (RF-2, RF-3, RF-5)", () => {
  const full = published({
    versions: [{
      name: "Full", price: price(36273), wltp_km: sourced(533), battery_kwh: battery(77.5, "gross"),
      power_kw: sourced(150, { note: "publicado: 190 CV" }), drivetrain: sourced("rwd"),
      dc_max_kw: sourced(135), ac_max_kw: sourced(11),
    }, { name: "Bare" }],
  });
  const [fullV, bareV] = full.versions;

  test("CA-3: seven rows in the design's order", () => {
    assert.deepEqual([...FIELDS], ["precio", "autonomia", "bateria", "potencia", "traccion", "cargaCc", "cargaCa"]);
    const texts = FIELDS.map((f) => cellView(f, fullV!).text);
    assert.deepEqual(texts, ["36.273 €", "533 km", "77,5 kWh, bruta", "150 kW", "Trasera", "135 kW", "11 kW"]);
  });

  test("CA-3: the battery states its basis", () => {
    const text = (basis: string) =>
      cellView("bateria", published({ versions: [{ name: "x", battery_kwh: battery(58, basis) }] }).versions[0]!).text;
    assert.equal(text("usable"), "58 kWh, útil");
    assert.equal(text("gross"), "58 kWh, bruta");
    assert.equal(text("unknown"), "58 kWh, sin especificar si es útil o bruta");
  });

  test("CA-4: a missing datum says «por confirmar» and carries no figure", () => {
    for (const f of FIELDS) {
      const c = cellView(f, bareV!);
      assert.equal(c.missing, true);
      assert.doesNotMatch(c.text, /\d/);
      assert.equal(c.note, null);
      assert.equal(c.source, null);
    }
    assert.equal(cellView("cargaCa", bareV!).text, "por confirmar");
    assert.equal(cellView("precio", bareV!).text, "Precio por confirmar");
  });

  test("CA-6: a note travels verbatim with its datum", () => {
    assert.equal(cellView("potencia", fullV!).note, "publicado: 190 CV");
    assert.equal(cellView("autonomia", fullV!).note, null);
  });

  test("CA-6: financed price gets the badge and the literal terms; pvp gets neither", () => {
    const terms = "Entrada 3.000 €,\nfinanciado a 48 meses.";
    const m = published({
      versions: [
        { name: "Deal", price: price(29900, { price_kind: "financed", price_terms: terms, price_terms_url: "https://acme.example/oferta" }) },
        { name: "Pvp", price: price(31900) },
      ],
    });
    const deal = cellView("precio", m.versions[0]!);
    assert.equal(deal.deal, "Precio con oferta");
    assert.deepEqual(deal.terms, { text: terms, url: "https://acme.example/oferta" });
    assert.equal(deal.source?.name, "acme.example");
    assert.equal(deal.source?.date, "20 sep 2026");
    const pvp = cellView("precio", m.versions[1]!);
    assert.equal(pvp.deal, null);
    assert.equal(pvp.terms, null);
  });

  test("CA-17: «fuente no oficial» is computed from the tier, not T1", () => {
    const of = (t: string) =>
      cellView("autonomia", published({ versions: [{ name: "x", wltp_km: sourced(400, { tier: t }) }] }).versions[0]!)
        .unofficial;
    assert.equal(of("T1"), false);
    assert.equal(of("T2"), true);
    assert.equal(of("T3"), true);
  });

  test("CA-15: no «better/worse», score or difference in any cell", () => {
    for (const f of FIELDS) {
      const keys = Object.keys(cellView(f, fullV!)).sort();
      assert.deepEqual(keys, ["deal", "missing", "note", "source", "terms", "text", "unofficial"]);
    }
  });
});

describe("headerView and conditionTitle (RF-1, RF-2, CA-1)", () => {
  const m = published({ model: "Soon", status: sourced("announced"), launch: sourced("2026-10"), versions: [{ name: "S 1" }] });
  test("brand, model, name, link to the model page and the «Próximamente» badge", () => {
    const h = headerView(m, m.versions[0]!);
    assert.deepEqual(
      [h.brand, h.model, h.name, h.href, h.srSuffix, h.badge],
      ["Acme", "Soon", "S 1", "/marcas/acme/Soon/", "(ficha del modelo)", "Próximamente · oct 2026"],
    );
  });
  test("an on-sale model has no badge", () => {
    const v = published({ versions: [{ name: "V" }] });
    assert.equal(headerView(v, v.versions[0]!).badge, null);
  });
  test("announced without launch: plain «Próximamente»", () => {
    const v = published({ status: sourced("announced"), versions: [{ name: "V" }] });
    assert.equal(headerView(v, v.versions[0]!).badge, "Próximamente");
  });
  test("condition title", () => {
    assert.equal(conditionTitle(m, m.versions[0]!), "Acme Soon, S 1");
  });
});

describe("modelsToFetch (ADR-0014: only the models the URL names)", () => {
  test("distinct models in URL order, malformed values skipped", () => {
    const e = parseEntries("v=a/b/one&v=a/b/two&v=nonsense&v=c/d");
    assert.deepEqual(modelsToFetch(e), [{ brand: "a", slug: "b" }, { brand: "c", slug: "d" }]);
  });
  test("a hand-made URL cannot ask for an unbounded number of files", () => {
    const q = Array.from({ length: 50 }, (_, i) => `v=m/x${i}/n`).join("&");
    assert.equal(modelsToFetch(parseEntries(q)).length, 12);
  });
});
