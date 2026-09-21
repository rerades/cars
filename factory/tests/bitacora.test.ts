/** Pruebas de la bitácora. Ejecutar: npm test */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import * as bit from "../bitacora.ts";

describe("bitácora", () => {
  const orig = bit.paths.diary;
  beforeEach(() => {
    bit.paths.diary = mkdtempSync(join(tmpdir(), "bitacora-"));
  });
  afterEach(() => {
    rmSync(bit.paths.diary, { recursive: true, force: true });
    bit.paths.diary = orig;
  });

  const when = (day: number, hour = 10) =>
    `2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00+00:00`;
  const contenido = (mes = "2026-09") => readFileSync(join(bit.paths.diary, `${mes}.md`), "utf8");

  test("crea fichero del mes con cabecera", () => {
    bit.addEntry("primera", "nota", { when: when(21) });
    assert.match(contenido(), /# Bitácora 2026-09/);
    assert.match(contenido(), /primera/);
  });

  test("no duplica la misma marca", () => {
    assert.ok(bit.addEntry("x", "commit", { mark: "git:abc", when: when(21) }));
    assert.ok(!bit.addEntry("x", "commit", { mark: "git:abc", when: when(21) }));
    assert.equal(contenido().split("git:abc").length - 1, 1);
  });

  test("entrada sin marca siempre se añade", () => {
    bit.addEntry("nota suelta", "nota", { when: when(21) });
    bit.addEntry("nota suelta", "nota", { when: when(21) });
    assert.equal(contenido().split("nota suelta").length - 1, 2);
  });

  test("ordena por fecha aunque se añada desordenado", () => {
    bit.addEntry("tercera", "nota", { when: when(23) });
    bit.addEntry("primera", "nota", { when: when(21) });
    bit.addEntry("segunda", "nota", { when: when(22) });
    const cuerpo = contenido();
    assert.ok(cuerpo.indexOf("primera") < cuerpo.indexOf("segunda"));
    assert.ok(cuerpo.indexOf("segunda") < cuerpo.indexOf("tercera"));
  });

  test("separa por mes", () => {
    bit.addEntry("de septiembre", "nota", { when: when(21) });
    bit.addEntry("de octubre", "nota", { when: "2026-10-01T00:00:00+00:00" });
    assert.match(contenido("2026-09"), /de septiembre/);
    assert.match(contenido("2026-10"), /de octubre/);
  });

  test("marcas se buscan en todos los meses", () => {
    bit.addEntry("x", "commit", { mark: "git:zzz", when: when(21) });
    assert.ok(!bit.addEntry("x", "commit", { mark: "git:zzz", when: "2026-10-01T00:00:00+00:00" }));
  });

  test("incluye tipo, referencias y hora de pared", () => {
    bit.addEntry("algo", "decision", { refs: ["ADR-0002", "PR#2"], when: "2026-09-21T09:49:00+02:00" });
    const linea = contenido();
    assert.match(linea, /\*\*2026-09-21 09:49\*\* · 🧭 Decisión — algo \(ADR-0002, PR#2\)/);
  });
});
