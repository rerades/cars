import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sortReviews } from "../src/lib/reviews.ts";

type E = { id: string; outlet: string; version?: string; retrieved?: string };
const e = (id: string, outlet: string, version?: string, retrieved = "2026-01-01"): E => ({ id, outlet, version, retrieved });
const ids = (xs: E[]) => xs.map((x) => x.id);
const sort = (xs: E[], versions: string[] = ["A", "B"]) => sortReviews(xs, versions, (x) => x.outlet);

describe("sortReviews (PRD-006 RF-5, RF-7; ficha-modelo.md «Orden de las entradas»)", () => {
  test("entries without version come before those with one", () => {
    assert.deepEqual(ids(sort([e("1", "Aa", "A"), e("2", "Zz"), e("3", "Mm", "B")])), ["2", "1", "3"]);
  });

  test("versions follow the order of the «Versiones» block, not alphabetical or file order", () => {
    const out = sort([e("1", "Aa", "B"), e("2", "Aa", "A")], ["Z", "B", "A"]);
    assert.deepEqual(ids(out), ["1", "2"]);
  });

  test("outlets in Spanish alphabetical order: accents and case do not push entries to the end", () => {
    const out = sort([e("1", "Zeta"), e("2", "álvarez"), e("3", "Ñandú"), e("4", "Motor")]);
    assert.deepEqual(ids(out), ["2", "4", "3", "1"]);
  });

  test("same outlet keeps the file order", () => {
    assert.deepEqual(ids(sort([e("1", "Motor"), e("2", "Auto"), e("3", "Motor"), e("4", "Motor")])), ["2", "1", "3", "4"]);
  });

  test("retrieved is not used", () => {
    const out = sort([e("1", "Motor", undefined, "2020-01-01"), e("2", "Motor", undefined, "2026-10-01"), e("3", "Auto", undefined, "2030-01-01")]);
    assert.deepEqual(ids(out), ["3", "1", "2"]);
  });

  test("a version the block does not know goes after the known ones, grouped", () => {
    const out = sort([e("1", "A1", "X"), e("2", "A2", "B"), e("3", "A3", "Y"), e("4", "B1", "X")]);
    assert.deepEqual(ids(out), ["2", "1", "4", "3"]);
  });

  test("no cap: 30 entries come out whole, and the input is not mutated", () => {
    const input = Array.from({ length: 30 }, (_, i) => e(String(i), `Medio ${30 - i}`));
    const copy = [...input];
    assert.equal(sort(input).length, 30);
    assert.deepEqual(input, copy);
  });

  test("empty input", () => {
    assert.deepEqual(sort([]), []);
  });
});
