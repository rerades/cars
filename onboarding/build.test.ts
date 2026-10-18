/** Tests for the parsers of the onboarding page. Run: pnpm test */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { adrStatus, agentPurpose, frontMatter, parseLogLine } from "./build.ts";

describe("onboarding", () => {
  test("front matter", () => {
    assert.deepEqual(frontMatter("---\nname: reviewer\ntools: Read, Bash\n---\n\nbody"), { name: "reviewer", tools: "Read, Bash" });
    assert.deepEqual(frontMatter("# no front matter"), {});
  });

  test("agent purpose drops the boilerplate sentence", () => {
    assert.equal(agentPurpose("Agente Revisor de la web de coches eléctricos. Úsalo para revisar una PR."), "Úsalo para revisar una PR.");
  });

  test("ADR status and date", () => {
    assert.deepEqual(adrStatus("- **Estado:** aceptada (2026-10-01). Enmienda «Imágenes»: aceptada (2026-10-12)"), { status: "aceptada", date: "2026-10-01" });
    assert.deepEqual(adrStatus("sin línea de estado"), { status: "sin estado", date: null });
  });

  test("logbook line", () => {
    assert.deepEqual(parseLogLine("- **2026-10-18 12:52** · 📝 Nota — Encoladas tres tareas (PRD-006)"),
      { when: "2026-10-18 12:52", kind: "Nota", text: "Encoladas tres tareas (PRD-006)" });
    assert.equal(parseLogLine("otra cosa"), null);
  });
});
