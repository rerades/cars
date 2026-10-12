import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { chunkVersions, sortVersions } from "../src/lib/versions.ts";

const v = (name: string, value?: number, kind = "pvp") => ({
  name,
  price: value === undefined ? null : { value, price_kind: kind },
});
const names = (list: readonly any[]): string[] => list.map((x) => x.name);

describe("sortVersions (RF-3, CA-3)", () => {
  test("by price ascending, financed included", () => {
    const sorted = sortVersions([v("c", 50000), v("a", 30000, "financed"), v("b", 40000)] as any);
    assert.deepEqual(names(sorted), ["a", "b", "c"]);
  });

  test("equal prices and versions without price keep the file order; those without price go last", () => {
    const sorted = sortVersions([v("n1"), v("x", 40000), v("n2"), v("y", 40000), v("z", 30000)] as any);
    assert.deepEqual(names(sorted), ["z", "x", "y", "n1", "n2"]);
  });

  test("does not mutate the input and handles an empty list", () => {
    const input = [v("b", 2), v("a", 1)] as any;
    sortVersions(input);
    assert.deepEqual(names(input), ["b", "a"]);
    assert.deepEqual(sortVersions([]), []);
  });

  test("does not deduplicate names (the schema already forbids repeats)", () => {
    assert.equal(sortVersions([v("a", 1), v("a", 2)] as any).length, 2);
  });
});

describe("chunkVersions", () => {
  test("up to 5 columns per table, with 1-based ranges", () => {
    assert.deepEqual(chunkVersions([1, 2, 3, 4]).map((c) => [c.from, c.to]), [[1, 4]]);
    assert.deepEqual(chunkVersions([1, 2, 3, 4, 5, 6, 7]).map((c) => [c.from, c.to, c.items.length]), [
      [1, 5, 5],
      [6, 7, 2],
    ]);
    assert.deepEqual(chunkVersions([]), []);
  });
});
