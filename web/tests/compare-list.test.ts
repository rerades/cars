import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  addGroups,
  announce,
  canAdd,
  focusAfterRemove,
  parseEntries,
  versionOptions,
  withAdded,
  withVersion,
  withoutColumn,
  writeSearch,
  type ColumnKey,
  type IndexEntry,
} from "../src/lib/compare.ts";
import { t } from "../src/lib/i18n.ts";

const col = (slug: string, name: string, brand = "acme"): ColumnKey => ({ brand, slug, name });
const entry = (over: Partial<IndexEntry> & Pick<IndexEntry, "slug" | "model">): IndexEntry => ({
  brand: "acme", brand_name: "Acme", status: "on_sale", versions: ["Base"], default_version: "Base", ...over,
});
const priced = (name: string, value: number) => ({ name, price: { value } });

describe("change version (RF-8, RF-10, CA-9)", () => {
  const model = { brand: "acme", slug: "a", versions: [priced("Big", 42000), priced("Small", 35000), { name: "NoPrice" }] };

  test("options follow the sheet order, all versions, the one taken by another column disabled with text", () => {
    const cols = [col("a", "Small"), col("a", "Big"), col("b", "Base")];
    const opts = versionOptions(model, cols, 0);
    assert.deepEqual(opts.map((o) => o.name), ["Small", "Big", "NoPrice"]);
    const big = opts.find((o) => o.name === "Big")!;
    assert.equal(big.disabled, true);
    assert.equal(big.label, `Big ${t("comparador.version.yaIncluida")}`);
    assert.equal(opts.find((o) => o.name === "Small")!.disabled, false); // the column's own version
    assert.equal(opts.find((o) => o.name === "NoPrice")!.label, "NoPrice");
  });

  test("CA-9: the column changes in place, keeps its position and the URL follows", () => {
    const next = withVersion([col("a", "Small"), col("b", "Base")], 0, "Big");
    assert.deepEqual(next, [col("a", "Big"), col("b", "Base")]);
    assert.deepEqual(parseEntries(writeSearch(next))[0], { brand: "acme", slug: "a", name: "Big" });
  });

  test("RF-9: a version already in another column is refused", () => {
    const cols = [col("a", "Small"), col("a", "Big")];
    assert.deepEqual(withVersion(cols, 0, "Big"), cols);
  });

  test("the same version name in another model is not a repeat", () => {
    assert.deepEqual(withVersion([col("a", "X"), col("b", "Y")], 0, "Y")[0], col("a", "Y"));
  });

  test("announcement and accessible names come from i18n", () => {
    assert.equal(
      announce("cambio", { brand_name: "Cupra", model: "Tavascan" }, "VZ", 2),
      "Columna 2: Cupra Tavascan, VZ.",
    );
    assert.match(t("comparador.version.sr", { marca: "Cupra", modelo: "Tavascan", n: 2 }), /^Versión de Cupra Tavascan, columna 2$/);
    assert.equal(
      `${t("comparador.quitar")} ${t("comparador.quitarSr", { marca: "Cupra", modelo: "Tavascan", nombre: "VZ" })}`,
      "Quitar Cupra Tavascan, VZ, de la comparación",
    );
  });
});

describe("remove (RF-9, CA-10)", () => {
  test("CA-10: 3 columns, remove one: 2 remain in order and the removed one is gone from the URL", () => {
    const cols = [col("a", "A1"), col("b", "B1"), col("c", "C1")];
    const next = withoutColumn(cols, 1);
    assert.deepEqual(next, [col("a", "A1"), col("c", "C1")]);
    assert.ok(!writeSearch(next).includes("B1"));
    assert.equal(canAdd(next.length), true);
  });

  test("focus goes to the «Quitar» now at that position, else the previous, else «Añadir»", () => {
    assert.deepEqual(focusAfterRemove(0, 2), { kind: "remove", index: 0 });
    assert.deepEqual(focusAfterRemove(1, 2), { kind: "remove", index: 1 });
    assert.deepEqual(focusAfterRemove(2, 2), { kind: "remove", index: 1 }); // it was the last
    assert.deepEqual(focusAfterRemove(0, 0), { kind: "add" });
  });

  test("announcement says what was removed and how many remain", () => {
    assert.equal(
      announce("quitado", { brand_name: "Kia", model: "EV3" }, "Air", 2),
      "Se ha quitado Kia EV3, Air. Quedan 2.",
    );
  });
});

describe("add (RF-8, RF-9, RF-11, CA-9, CA-10, CA-13)", () => {
  test("CA-9: a model with 35.000 € and 42.000 € enters with the 35.000 € one, at the end", () => {
    const model = { brand: "acme", slug: "a", versions: [priced("Big", 42000), priced("Small", 35000)] };
    assert.deepEqual(withAdded([col("b", "Base")], model), [col("b", "Base"), col("a", "Small")]);
  });

  test("CA-10: the same version is not added twice, another version of the same model is", () => {
    const model = { brand: "acme", slug: "a", versions: [priced("Big", 42000), priced("Small", 35000)] };
    assert.deepEqual(withAdded([col("a", "Small")], model), [col("a", "Small"), col("a", "Big")]);
    const both = [col("a", "Small"), col("a", "Big")];
    assert.deepEqual(withAdded(both, model), both);
  });

  test("CA-10: with 3 columns nothing is added and the form is not offered", () => {
    const three = [col("a", "A"), col("b", "B"), col("c", "C")];
    assert.equal(canAdd(three.length), false);
    assert.deepEqual(withAdded(three, { brand: "acme", slug: "d", versions: [{ name: "D" }] }), three);
    assert.equal(canAdd(2), true);
    assert.equal(
      t("comparador.maximo"),
      "Ya comparas 3 coches, el máximo. Quita uno para añadir otro.",
    );
  });

  test("groups: a group per brand and models in alphabetical order, announced marked", () => {
    const index = [
      entry({ slug: "z", model: "Zeta" }),
      entry({ slug: "b", model: "Beta", status: "announced" }),
      entry({ brand: "bmw", brand_name: "BMW", slug: "i4", model: "i4" }),
    ];
    const groups = addGroups(index, []);
    assert.deepEqual(groups.map((g) => g.label), ["Acme", "BMW"]);
    assert.deepEqual(groups[0]!.options.map((o) => o.label), [`Beta ${t("comparador.anadir.proximamente")}`, "Zeta"]);
    assert.equal(groups[0]!.options[0]!.value, "acme/b");
  });

  test("a model with all versions present is disabled with its suffix; one with a free version is not", () => {
    const index = [
      entry({ slug: "one", model: "One" }),
      entry({ slug: "two", model: "Two", versions: ["A", "B"], default_version: "A" }),
    ];
    const opts = addGroups(index, [col("one", "Base"), col("two", "A")])[0]!.options;
    assert.equal(opts[0]!.disabled, true);
    assert.equal(opts[0]!.label, `One ${t("comparador.anadir.completo")}`);
    assert.equal(opts[1]!.disabled, false);
  });

  test("CA-13: models that are not comparable are left out, not disabled", () => {
    const index = [
      entry({ slug: "old", model: "Old", status: "discontinued" }),
      entry({ slug: "empty", model: "Empty", versions: [] }),
      entry({ slug: "ok", model: "Ok" }),
    ];
    const labels = addGroups(index, []).flatMap((g) => g.options.map((o) => o.label));
    assert.deepEqual(labels, ["Ok"]);
  });

  test("texts of the form", () => {
    assert.equal(t("comparador.anadir.elige"), "Elige un coche");
    assert.equal(t("comparador.anadir.sinEleccion"), "Elige un coche de la lista.");
    assert.equal(
      announce("anadido", { brand_name: "Kia", model: "EV3" }, "Air", 3),
      "Se ha añadido Kia EV3, Air, en la columna 3.",
    );
  });
});

describe("markup of «Coches comparados» (RF-8, RF-9, CA-14)", () => {
  const page = readFileSync(new URL("../src/pages/comparar.astro", import.meta.url), "utf8");
  const table = readFileSync(new URL("../src/components/ComparisonTable.astro", import.meta.url), "utf8");

  test("«Añadir» is a form with an empty first option, hidden until the script decides", () => {
    assert.match(page, /<form[^>]*data-add-form[^>]*hidden/);
    assert.match(page, /<option value="">\{t\("comparador\.anadir\.elige"\)\}/);
    assert.match(page, /data-max-text hidden>\{t\("comparador\.maximo"\)\}/);
  });

  test("the add message is wired with aria-invalid and aria-describedby", () => {
    assert.match(table, /setAttribute\("aria-invalid", "true"\)/);
    assert.match(table, /setAttribute\("aria-describedby", "cmp-anadir-msg"\)/);
    assert.match(page, /id="cmp-anadir-msg"/);
  });

  test("the URL is rewritten with replaceState and nothing is stored", () => {
    assert.match(table, /history\.replaceState/);
    assert.doesNotMatch(table, /pushState|localStorage|sessionStorage|document\.cookie/);
    assert.doesNotMatch(table, /\.innerHTML\s*=/);
  });

  test("the item template has the «Quitar» button and a select, and the index failure reuses comparador.error", () => {
    assert.match(table, /data-tpl="chosen"[\s\S]*data-slot="select"[\s\S]*data-slot="remove"/);
    assert.match(table, /setAddMessage\(t\("comparador\.error"\)\)/);
  });
});
