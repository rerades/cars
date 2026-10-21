import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  numberNotes,
  type PublishedDatum,
  type PublishedModel,
  type PublishedVersion,
} from "../src/lib/compare.ts";
import { noteLine } from "../src/lib/notes.ts";

/** PRD-003 story #319 (RF-4, CA-5): numbering and grouping of source notes, in table reading order. */

const d = <T>(value: T, over: Partial<PublishedDatum<T>> = {}): PublishedDatum<T> => ({
  value,
  source_id: "brand",
  url: "https://www.brand.example/a",
  retrieved: "2026-09-24",
  tier: "T1",
  note: null,
  ...over,
});
const B = { url: "https://www.other.example/b", source_id: "other", retrieved: "2026-09-28" };
const C = { url: "https://hibridosyelectricos.com/c", source_id: "hye", retrieved: "2026-10-01", tier: "T3" };

const version = (over: Partial<PublishedVersion> = {}): PublishedVersion => ({
  name: "V",
  price: { ...d(30000), price_kind: "pvp", price_terms: null, price_terms_url: null },
  wltp_km: d(400),
  battery_kwh: { ...d(60), basis: "usable" },
  power_kw: d(150),
  drivetrain: d("rwd"),
  dc_max_kw: d(120),
  ac_max_kw: d(11),
  ...over,
});
const model = (over: Partial<PublishedModel> = {}): PublishedModel => ({
  brand: "b", slug: "m", brand_name: "B", model: "M",
  status: d("on_sale"), launch: null, versions: [], ...over,
});
const col = (m: PublishedModel, v: PublishedVersion) => ({ model: m, version: v });

describe("numberNotes: reading order of the table (comparador.md, «Fuentes y notas»)", () => {
  test("same source everywhere: one note, every row marked 1, price never marked", () => {
    const r = numberNotes([col(model(), version()), col(model(), version())]);
    assert.equal(r.notes.length, 1);
    assert.equal(r.notes[0]!.n, 1);
    for (const c of r.columns) {
      assert.deepEqual(c.header, []);
      assert.equal(c.cells.precio, undefined);
      assert.deepEqual(Object.values(c.cells), [1, 1, 1, 1, 1, 1]);
    }
  });

  test("header first (columns left to right), then rows top to bottom, columns left to right", () => {
    const announced = model({ status: d("announced", B), launch: d("2026-10", { ...B, retrieved: "2026-09-30" }) });
    const r = numberNotes([
      col(model(), version({ wltp_km: d(400, C), power_kw: d(150, { retrieved: "2026-09-25" }) })),
      col(announced, version({ wltp_km: d(500), drivetrain: d("awd", { retrieved: "2026-09-26" }) })),
    ]);
    // Header: only the 2nd column is announced → status = 1, launch = 2.
    assert.deepEqual(r.columns[0]!.header, []);
    assert.deepEqual(r.columns[1]!.header, [1, 2]);
    // Row autonomia: col 1 (C) = 3, col 2 (default source) = 4.
    assert.equal(r.columns[0]!.cells.autonomia, 3);
    assert.equal(r.columns[1]!.cells.autonomia, 4);
    // Row bateria: default source, already 4 for both.
    assert.equal(r.columns[0]!.cells.bateria, 4);
    // Row potencia: col 1 has retrieved 09-25 → 5; col 2 default → 4.
    assert.equal(r.columns[0]!.cells.potencia, 5);
    assert.equal(r.columns[1]!.cells.potencia, 4);
    // Row traccion: col 1 default → 4; col 2 retrieved 09-26 → 6.
    assert.equal(r.columns[1]!.cells.traccion, 6);
    assert.deepEqual(r.notes.map((n) => n.n), [1, 2, 3, 4, 5, 6]);
  });

  test("numbers grow in the order they are read (no number is read before a smaller one is missing)", () => {
    const r = numberNotes([
      col(model(), version({ wltp_km: d(1, C), battery_kwh: { ...d(2, B), basis: "gross" } })),
      col(model(), version()),
    ]);
    const read: number[] = [];
    for (const f of ["autonomia", "bateria", "potencia", "traccion", "cargaCc", "cargaCa"] as const) {
      for (const c of r.columns) if (c.cells[f] !== undefined) read.push(c.cells[f]!);
    }
    const firsts = read.filter((n, i) => read.indexOf(n) === i);
    assert.deepEqual(firsts, [...firsts].sort((a, b) => a - b));
  });

  test("grouping uses source_id + url + retrieved + tier: a different tier is another note", () => {
    const r = numberNotes([
      col(model(), version({ power_kw: d(150, { tier: "T2" }) })),
      col(model(), version()),
    ]);
    assert.notEqual(r.columns[0]!.cells.potencia, r.columns[0]!.cells.autonomia);
    assert.equal(r.columns[0]!.cells.autonomia, r.columns[1]!.cells.autonomia);
  });

  test("«por confirmar» (null datum) takes no number and no note", () => {
    const r = numberNotes([col(model(), version({ dc_max_kw: null })), col(model(), version({ dc_max_kw: null }))]);
    assert.equal(r.columns[0]!.cells.cargaCc, undefined);
    assert.equal(r.columns[1]!.cells.cargaCc, undefined);
  });

  test("an on_sale model has no header marks, even with a launch date", () => {
    const m = model({ launch: d("2025-03", B) });
    const r = numberNotes([col(m, version()), col(m, version())]);
    assert.deepEqual(r.columns[0]!.header, []);
    assert.equal(r.notes.length, 1);
  });

  test("announced model: status and launch from the same source share one header number", () => {
    const m = model({ status: d("announced"), launch: d("2026-10") });
    const r = numberNotes([col(m, version()), col(model(), version())]);
    assert.deepEqual(r.columns[0]!.header, [1]);
  });

  test("recomputing for another selection renumbers from scratch", () => {
    const a = col(model(), version({ wltp_km: d(1, C) }));
    const b = col(model(), version());
    assert.equal(numberNotes([a, b]).columns[1]!.cells.autonomia, 2);
    assert.equal(numberNotes([b, a]).columns[1]!.cells.autonomia, 2);
    assert.equal(numberNotes([b, col(model(), version())]).notes.length, 1);
  });

  test("unofficial is true for non-T1 notes only (CA-5)", () => {
    const r = numberNotes([col(model(), version({ wltp_km: d(1, C) })), col(model(), version())]);
    const byN = (n: number) => r.notes.find((x) => x.n === n)!;
    assert.equal(byN(r.columns[0]!.cells.autonomia!).unofficial, true);
    assert.equal(byN(r.columns[1]!.cells.autonomia!).unofficial, false);
  });
});

describe("noteLine (shared with the model page)", () => {
  test("domain, short-month date, and «Fuente no oficial.» only when not T1", () => {
    const r = numberNotes([col(model(), version({ wltp_km: d(1, C) })), col(model(), version())]);
    const t1 = r.notes.find((n) => !n.unofficial)!;
    const t3 = r.notes.find((n) => n.unofficial)!;
    assert.equal(noteLine(t1), "brand.example, consultado el 24 sep 2026.");
    assert.equal(noteLine(t3), "hibridosyelectricos.com, consultado el 1 oct 2026. Fuente no oficial.");
  });
});
