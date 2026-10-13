import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "../src/lib/data.ts";
import { relatedModels } from "../src/lib/related.ts";
import { acme, sourced } from "./fixtures.ts";

function make(brand: string, model: string, opts: { price?: number; segment?: string | null; launch?: string } = {}) {
  const raw = acme();
  raw.brand = brand;
  raw.brand_name = brand;
  raw.model = model;
  raw.images = [];
  if (opts.segment === null) delete raw.segment;
  else raw.segment = sourced(opts.segment ?? "suv_compacto");
  if (opts.launch) raw.launch = sourced(opts.launch);
  else delete raw.launch;
  raw.versions = opts.price === undefined ? [] : [{ name: model, price: sourced(opts.price, { unit: "EUR", price_kind: "pvp" }) }];
  return normalize(raw, `${brand}/${model}.yaml`);
}
const names = (list: { file: string }[]) => list.map((m) => m.file.replace(/\.yaml$/, ""));

test("RF-15: same segment, other brand, 3 closest by price_from", () => {
  const me = make("acme", "Me", { price: 40000 });
  const all = [
    me,
    make("acme", "Sibling", { price: 40000 }),
    make("b", "Far", { price: 80000 }),
    make("c", "Near", { price: 41000 }),
    make("d", "Below", { price: 38000 }),
    make("e", "Mid", { price: 45000 }),
    make("f", "OtherSegment", { price: 40000, segment: "berlina" }),
  ];
  assert.deepEqual(names(relatedModels(me, all)), ["c/Near", "d/Below", "e/Mid"]);
});

test("models without price go last; ties follow the Novedad order", () => {
  const me = make("acme", "Me", { price: 40000 });
  const all = [
    make("b", "NoPrice", { launch: "2026-12" }),
    make("c", "OldTie", { price: 41000, launch: "2024-01" }),
    make("d", "NewTie", { price: 39000, launch: "2026-01" }),
  ];
  assert.deepEqual(names(relatedModels(me, all)), ["d/NewTie", "c/OldTie", "b/NoPrice"]);
});

test("a model without price uses the Novedad order", () => {
  const me = make("acme", "Me");
  const all = [
    make("b", "Old", { price: 10000, launch: "2023-01" }),
    make("c", "New", { price: 90000, launch: "2026-05" }),
  ];
  assert.deepEqual(names(relatedModels(me, all)), ["c/New", "b/Old"]);
});

test("no segment or no candidates gives []", () => {
  const noSeg = make("acme", "NoSeg", { segment: null, price: 40000 });
  assert.deepEqual(relatedModels(noSeg, [noSeg, make("b", "X", { segment: null })]), []);
  const me = make("acme", "Me", { price: 40000 });
  assert.deepEqual(relatedModels(me, [me, make("acme", "Sib", { price: 1 })]), []);
});
