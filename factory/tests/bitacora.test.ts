/** Pruebas de la bitácora. Ejecutar: npm test */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const ficheros = (mes = "2026-09") => readdirSync(join(bit.paths.diary, mes)).sort();
  /** The month as a reader sees it: `cat docs/bitacora/<mes>/*.md`. */
  const contenido = (mes = "2026-09") =>
    ficheros(mes).map((f) => readFileSync(join(bit.paths.diary, mes, f), "utf8")).join("");

  test("one file per entry, inside the month folder", () => {
    bit.addEntry("primera", "nota", { when: when(21) });
    bit.addEntry("segunda", "nota", { when: when(21) });
    assert.equal(ficheros().length, 2);
    assert.match(contenido(), /primera/);
    assert.match(contenido(), /segunda/);
  });

  test("no duplica la misma marca", () => {
    assert.ok(bit.addEntry("x", "commit", { mark: "git:abc", when: when(21) }));
    assert.ok(!bit.addEntry("x", "commit", { mark: "git:abc", when: when(21) }));
    assert.equal(contenido().split("git:abc").length - 1, 1);
  });

  test("a marked entry gets a name derived from its mark", () => {
    bit.addEntry("x", "commit", { mark: "git:abc", when: when(21, 9) });
    assert.deepEqual(ficheros(), ["2026-09-21T0900-git-abc.md"]);
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

  test("marks in the old monthly files still count", () => {
    writeFileSync(join(bit.paths.diary, "2026-09.md"), "# Bitácora 2026-09\n\n- **2026-09-21 10:00** · x <!-- id:git:old -->\n");
    assert.ok(!bit.addEntry("x", "commit", { mark: "git:old", when: when(22) }));
  });

  test("incluye tipo, referencias y hora de pared", () => {
    bit.addEntry("algo", "decision", { refs: ["ADR-0002", "PR#2"], when: "2026-09-21T09:49:00+02:00" });
    assert.match(contenido(), /\*\*2026-09-21 09:49\*\* · 🧭 Decisión — algo \(ADR-0002, PR#2\)/);
  });

  test("two branches that each add entries merge with no conflict", () => {
    const repo = bit.paths.diary;
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args], { cwd: repo, encoding: "utf8" });
    git("init", "-q", "-b", "trunk");
    bit.paths.diary = join(repo, "docs", "bitacora");
    mkdirSync(bit.paths.diary, { recursive: true });
    bit.addEntry("base", "nota", { when: when(20) });
    git("add", "-A");
    git("commit", "-qm", "base");
    git("checkout", "-qb", "a");
    bit.addEntry("de la rama a", "decision", { when: when(21) });
    bit.addEntry("commit compartido", "commit", { mark: "git:shared", when: when(21) });
    git("add", "-A");
    git("commit", "-qm", "a");
    git("checkout", "-q", "trunk");
    git("checkout", "-qb", "b");
    bit.addEntry("de la rama b", "nota", { when: when(21) });
    bit.addEntry("commit compartido", "commit", { mark: "git:shared", when: when(21) });
    git("add", "-A");
    git("commit", "-qm", "b");
    git("rebase", "-q", "a"); // throws on a conflict
    assert.match(contenido(), /de la rama a[\s\S]*de la rama b|de la rama b[\s\S]*de la rama a/);
    assert.equal(contenido().split("git:shared").length - 1, 1);
    bit.paths.diary = repo; // afterEach removes the whole temp repo
  });
});
