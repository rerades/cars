import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { easeOut, formatEsNumber, frameText, parseEsNumber } from "../src/lib/count-up.ts";

// PRD-002 story #1041: count-up of the key figures (RF-18, CA-22, CA-15).

const SRC = join(import.meta.dirname, "..", "src");
const component = readFileSync(join(SRC, "components", "CifrasCountUp.astro"), "utf8");
const page = readFileSync(join(SRC, "pages", "marcas", "[marca]", "[modelo].astro"), "utf8");

describe("count-up helpers", () => {
  test("parses Spanish-formatted numbers and rejects anything else", () => {
    assert.deepEqual(parseEsNumber("32.800"), { value: 32800, decimals: 0, grouped: true });
    assert.deepEqual(parseEsNumber("77,4"), { value: 77.4, decimals: 1, grouped: false });
    assert.equal(parseEsNumber("446")?.value, 446);
    assert.equal(parseEsNumber("por confirmar"), null);
    assert.equal(parseEsNumber(""), null);
  });

  test("formatting round-trips with parsing", () => {
    for (const s of ["32.800", "77,4", "446", "5.000", "1.234.567"]) {
      const p = parseEsNumber(s)!;
      assert.equal(formatEsNumber(p.value, p.decimals, p.grouped), s);
    }
  });

  test("the animation starts at 0, moves up and the last frame is exactly the final text (CA-22)", () => {
    assert.equal(frameText("32.800", 0, 900), "0");
    assert.equal(easeOut(1), 1);
    const mid = parseEsNumber(frameText("32.800", 450, 900))!.value;
    assert.ok(mid > 0 && mid < 32800);
    assert.equal(frameText("32.800", 900, 900), "32.800");
    assert.equal(frameText("77,4", 5000, 900), "77,4");
    assert.equal(frameText("por confirmar", 100, 900), "por confirmar");
  });
});

describe("count-up script", () => {
  test("CA-22: it does nothing with prefers-reduced-motion: reduce, and only runs as an enhancement", () => {
    assert.match(component, /prefers-reduced-motion: reduce/);
    assert.match(component, /matches\) return/);
    // The component renders no markup: the values come from the served HTML (`Cifra`), never from the script.
    assert.doesNotMatch(component.replace(/<script>[\s\S]*<\/script>/, ""), /<(div|span|dd|dt)/);
  });

  test("CA-22: it only touches the key figures of the first screen", () => {
    assert.match(component, /\[data-cifras\] \.cifra__valor/);
    assert.match(page, /<CifrasCountUp \/>/);
  });

  test("CA-15: it writes no cookie and nothing in localStorage or sessionStorage", () => {
    assert.doesNotMatch(component.replace(/\/\*\*[\s\S]*?\*\//, ""), /document\.cookie|localStorage|sessionStorage|indexedDB/);
  });
});
