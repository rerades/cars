/** Tests for the retro trigger (ADR-0022, "Agente retro"; PRD-007 CA-13). Run: pnpm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runEvals } from "../evals.ts";
import { datasetAgents, MIN_SIGNALS, retroBlocker, retroSignals, retroSince, retroTask, type LabeledPr, type TrustEvent } from "../retro.ts";

const NOW = new Date("2026-11-23T02:45:00+01:00");
const row = (agent: string, started: string, outcome = "success", run_id = `${agent}-${started}`) => ({ agent, started, outcome, run_id, pr: null });

test("no corre con STOP ni si ya corrió en la semana; sí a la misma hora de la semana siguiente", () => {
  assert.match(retroBlocker([], NOW, true) ?? "", /parada/);
  assert.equal(retroBlocker([], NOW, false), null);
  assert.match(retroBlocker([row("retro", "2026-11-20T02:45:05+01:00", "error")], NOW, false) ?? "", /menos de 7 días/);
  assert.equal(retroBlocker([row("retro", "2026-11-16T02:45:05+01:00")], NOW, false), null);
});

test("el periodo empieza en el último retro que salió bien, o hace 7 días", () => {
  assert.equal(retroSince([], NOW).toISOString(), "2026-11-16T01:45:00.000Z");
  const rows = [row("retro", "2026-11-09T02:45:00+01:00"), row("retro", "2026-11-16T02:45:00+01:00", "error")];
  assert.equal(retroSince(rows, NOW).toISOString(), "2026-11-09T01:45:00.000Z");
});

test("cuenta fallos, review:changes y defectos escapados desde el inicio del periodo (CA-13)", () => {
  const since = new Date("2026-11-16T00:00:00Z");
  const rows = [
    row("developer", "2026-11-17T01:00:00+01:00", "max_turns", "r1"),
    row("developer", "2026-11-17T01:00:00+01:00", "max_turns", "r1"), // same run twice: one signal
    row("developer", "2026-11-18T01:00:00+01:00", "success"),
    row("retro", "2026-11-18T02:00:00+01:00", "error"), // its own failures do not count
    row("researcher", "2026-11-10T01:00:00+01:00", "error"), // before the period
  ];
  const prs: LabeledPr[] = [
    { url: "https://x/pull/7", headRefName: "agent/researcher/r2", labeled: ["2026-11-19T06:40:00Z", "2026-11-21T06:40:00Z", "2026-11-01T06:40:00Z"] },
    { url: "https://x/pull/8", headRefName: "chore/factory-state", labeled: ["2026-11-19T06:40:00Z"] },
  ];
  const trust: TrustEvent[] = [
    { type: "unclean", reason: "escaped defect", at: "2026-11-20T07:30:00Z", agent: "developer", pr: 612, evidence: "#661 cites #612" },
    { type: "unclean", reason: "review:changes", at: "2026-11-20T07:30:00Z", agent: "developer", pr: 618 },
  ];
  const signals = retroSignals(rows, prs, trust, since);
  assert.deepEqual(signals.map((s) => s.kind), ["fallo", "review:changes", "defecto escapado", "review:changes"]);
  assert.ok(signals.length >= MIN_SIGNALS);
  assert.equal(retroSignals(rows.slice(0, 3), [], [], since).length < MIN_SIGNALS, true); // a quiet week: no retro

  const task = retroTask(signals, ["reviewer"], since, "2026-11-23", "/nowhere");
  assert.match(task, /docs\/bitacora\/retro\/2026-11-23\.md/);
  assert.match(task, /run r1 \(max_turns\)/);
  assert.match(task, /https:\/\/x\/pull\/7 .* run r2/);
  assert.match(task, /con dataset en factory\/datasets\/: reviewer\./);
});

test("los agentes con dataset salen de los directorios de factory/datasets/ (ADR-0026, punto 6)", () => {
  const dir = mkdtempSync(join(tmpdir(), "datasets-"));
  try {
    mkdirSync(join(dir, "reviewer"));
    mkdirSync(join(dir, "researcher"));
    writeFileSync(join(dir, "README.md"), "");
    assert.deepEqual(datasetAgents(dir), ["researcher", "reviewer"]);
    assert.deepEqual(datasetAgents(join(dir, "missing")), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("el retro solo deja su fichero de docs/bitacora/retro/ y su entrada (CA-13: nada en .claude/)", () => {
  const ok = ["docs/bitacora/retro/2026-11-23.md", "docs/bitacora/2026-11/2026-11-23T0250-ab12cd34.md"];
  const failed = (files: string[]) => runEvals("retro", tmpdir(), files, ["docs/bitacora/"], "2026-11-23").failed;
  assert.deepEqual(failed(ok), []);
  assert.ok(failed([ok[1]]).some((f) => /exactly one/.test(f)));
  assert.ok(failed([...ok, ".claude/agents/reviewer.md"]).length >= 2); // write_paths and retroOnly
  assert.ok(failed([...ok, "docs/bitacora/retro/notas.md"]).some((f) => /only its retro file/.test(f)));
});
