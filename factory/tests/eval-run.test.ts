/** Tests for the prompt evals of ADR-0016 (no network, no claude). Run: pnpm test */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { proposedLabel, reviewedSha, storyNumber } from "../dataset-case.ts";
import { caseProblem, type Case } from "../dataset-sync.ts";
import {
  budgetBlocker, codeScores, compare, judgeScores, totals, writesOutside, type CaseResult, type EvalsConfig, type Summary,
} from "../eval-run.ts";
import { fakeGh, isForbidden, readLog } from "../fake-gh.ts";
import { toOtlp } from "../langfuse.ts";

const dir = mkdtempSync(join(tmpdir(), "eval-test-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const SHA = "abcdef1234567890abcdef1234567890abcdef12";
writeFileSync(join(dir, "pr.json"), JSON.stringify({
  number: 464, title: "Compare action", body: "Closes #324", url: "https://github.com/o/r/pull/464",
  headRefOid: SHA, labels: [], comments: [], files: [{ path: "web/a.ts", additions: 3, deletions: 0 }],
  statusCheckRollup: [
    { name: "test", status: "COMPLETED", conclusion: "SUCCESS" },
    { name: "a11y", status: "COMPLETED", conclusion: "FAILURE" },
  ],
}));
writeFileSync(join(dir, "diff.patch"), "diff --git a/web/a.ts b/web/a.ts\n");
writeFileSync(join(dir, "issue.json"), JSON.stringify({ number: 324, title: "Story", body: "CA-8 y CA-13", comments: [] }));

const c: Case = {
  case_id: "pr-0464", pr: 464, reviewed_sha: SHA, base_sha: "0".repeat(40), issue: 324, synthetic: false, confirmed: true,
  expected: { label: "review:changes", findings: ["a11y en rojo", "falta Closes"], ca: [{ id: "CA-8", covered: true }, { id: "CA-13", covered: false }] },
};

describe("fake gh", () => {
  const log = join(dir, "gh.jsonl");
  const gh = (...argv: string[]) => fakeGh(argv, dir, log);

  test("sirve la instantánea con --json y --jq, sin etiquetas", () => {
    assert.equal(gh("pr", "view", "464", "--json", "headRefOid", "--jq", ".headRefOid").stdout.trim(), SHA);
    assert.deepEqual(JSON.parse(gh("pr", "view", "464", "--json", "labels,title").stdout), { labels: [], title: "Compare action" });
    assert.match(gh("pr", "diff", "464").stdout, /web\/a\.ts/);
    assert.equal(gh("issue", "view", "324", "--json", "body", "-q", ".body").stdout.trim(), "CA-8 y CA-13");
  });

  test("pr checks sale con 1 si algo falló, como gh", () => {
    const r = gh("pr", "checks", "464");
    assert.equal(r.code, 1);
    assert.match(r.stdout, /a11y\tfail/);
  });

  test("guarda el comentario y las etiquetas en vez de publicarlos", () => {
    assert.equal(gh("pr", "comment", "464", "--body", "🏭 Veredicto: ok").code, 0);
    gh("pr", "edit", "464", "--add-label", "review:ok");
    gh("pr", "edit", "464", "--remove-label", "review:ok", "--add-label", "review:changes");
    assert.deepEqual(JSON.parse(gh("pr", "view", "464", "--json", "labels").stdout).labels, [{ name: "review:changes" }]);
    assert.deepEqual(readLog(log)[0], { cmd: "comment", body: "🏭 Veredicto: ok" });
  });

  test("rechaza otra PR, otra issue y cualquier otro subcomando, y lo apunta", () => {
    assert.equal(gh("pr", "view", "999").code, 1);
    assert.equal(gh("issue", "view", "1").code, 1);
    assert.equal(gh("pr", "merge", "464").code, 1);
    const refused = readLog(log).filter((e) => e.cmd === "refused");
    assert.equal(refused.length, 3);
    assert.equal(refused.filter(isForbidden).length, 1); // only the merge is forbidden; the others are just errors
  });
});

describe("puntuación con código", () => {
  test("false_ok: review:ok cuando se esperaba otra cosa", () => {
    const { scores } = codeScores(c, [{ cmd: "edit", add: ["review:ok"], remove: [] }], []);
    assert.equal(scores.false_ok, 1);
    assert.equal(scores.label_match, 0);
    assert.equal(scores.one_label, 1);
  });

  test("formato, SHA, CA citados y escrituras fuera de write_paths", () => {
    const body = `🏭 Veredicto: hay que cambiar algo. SHA revisado: ${SHA.slice(0, 7)}\nCA-8 cubierto, CA-13 no`;
    const log = [{ cmd: "comment" as const, body }, { cmd: "edit" as const, add: ["review:changes"], remove: [] }];
    const { scores } = codeScores(c, log, []);
    assert.deepEqual([scores.label_match, scores.false_ok, scores.format, scores.ca_listed, scores.forbidden], [1, 0, 1, 1, 0]);
    assert.equal(codeScores(c, [{ cmd: "comment", body: "Veredicto: …" }], []).scores.format, 0);
    assert.equal(codeScores(c, log, ["web/a.ts"]).scores.forbidden, 1);
  });

  test("writesOutside lee las llamadas Write y Edit de la traza", () => {
    const tool = (name: string, file_path: string) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name, input: { file_path } }] } });
    const stdout = [tool("Write", "/wt/docs/bitacora/x.md"), tool("Edit", "/wt/web/a.ts"), tool("Read", "/wt/factory/run.ts")].join("\n");
    assert.deepEqual(writesOutside(stdout, "/wt", ["docs/bitacora/"]), ["web/a.ts"]);
  });
});

describe("juez", () => {
  test("las fracciones salen de respuestas sí/no", () => {
    const s = judgeScores(c, {
      findings: [{ index: 0, mentioned: true, why: "" }, { index: 1, mentioned: false, why: "" }, { index: 7, mentioned: true, why: "" }],
      invented: { answer: false, why: "" },
      concrete: [{ finding: "a", concrete: true }, { finding: "b", concrete: false }],
      ca: [{ id: "CA-8", covered: true, why: "" }, { id: "CA-13", covered: true, why: "" }],
    });
    assert.deepEqual(s, { finding_recall: 0.5, invented: 0, concrete: 0.5, ca_correct: 0.5 });
  });
});

describe("presupuesto y aprobación", () => {
  const ev: EvalsConfig = { max_usd_per_experiment: 15, max_usd_per_month: 40, max_units_per_month: 40000, judge_model: "j", estimate_usd_per_case: { sonnet: 0.3 } };

  test("para antes del caso que pasaría de cualquiera de los dos topes", () => {
    assert.equal(budgetBlocker(ev, 14, 20, 0.5), null);
    assert.match(budgetBlocker(ev, 14.8, 20, 0.5)!, /experimento/);
    assert.match(budgetBlocker(ev, 1, 39.8, 0.5)!, /mes/);
  });

  const result = (scores: Partial<CaseResult["scores"]>, usd = 0.3): CaseResult => ({
    case_id: "x", pr: 1, expected_label: "review:ok", labels: [], agent_usd: usd, judge_usd: 0, turns: 10, units: 100, notes: [],
    scores: { label_match: 1, false_ok: 0, one_label: 1, format: 1, ca_listed: 1, forbidden: 0, finding_recall: 1, invented: 0, concrete: 1, ca_correct: 1, ...scores },
  });
  const summary = (cases: CaseResult[], started = "2026-10-20T03:00:00+02:00"): Summary => ({
    experiment: "e", agent: "reviewer", model: "m", prompt_sha: "p", dataset_sha: "d", judge_model: "j", rubric_sha: "r",
    started, ended: started, complete: true, stopped: null, cases, totals: totals(cases),
  });

  test("un solo false_ok tumba la candidata aunque gane en lo demás", () => {
    const base = summary([result({ label_match: 0 }), result({})]);
    const cand = summary([result({ false_ok: 1, label_match: 0 }), result({})]);
    const { approved, reasons } = compare(base, cand);
    assert.equal(approved, false);
    assert.match(reasons.join("\n"), /false_ok/);
  });

  test("se aprueba si no empeora, y no si el coste sube más de un 25 %", () => {
    const base = summary([result({}), result({})]);
    assert.equal(compare(base, summary([result({}), result({})])).approved, true);
    assert.match(compare(base, summary([result({}, 0.4), result({}, 0.4)])).reasons.join(), /coste/);
    assert.match(compare(base, summary([result({}), result({})], "2026-12-01T03:00:00+01:00")).reasons.join(), /30 días/);
  });
});

describe("congelar casos", () => {
  test("SHA del último veredicto, etiqueta propuesta y historia", () => {
    const comments = [
      { body: "🏭 Veredicto: cambia algo. SHA revisado: 1111111aaaa" },
      { body: `🏭 Veredicto: puede entrar. SHA revisado: ${SHA}` },
      { body: "🏭 Espera a una persona (ADR-0011): toca web/." },
    ];
    assert.equal(reviewedSha(comments), SHA);
    assert.equal(proposedLabel(["review:ok", "review:needs-human"], comments), "review:ok");
    assert.equal(proposedLabel(["review:needs-human"], []), "review:needs-human");
    assert.equal(storyNumber("developer: Historia #154 (épica #145)", "sin closes"), 154);
    assert.equal(storyNumber("x", "Closes #324\nHistoria #1"), 324);
  });

  test("un caso sin confirmar o con un CA sin decidir no se usa", () => {
    assert.equal(caseProblem(c), null);
    assert.equal(caseProblem({ ...c, confirmed: false }), "sin confirmar");
    assert.match(caseProblem({ ...c, expected: { ...c.expected, ca: [{ id: "CA-1", covered: null }] } })!, /CA/);
  });
});

describe("traza del experimento", () => {
  test("atributos de traza en todos los spans y los del ítem solo en la raíz", () => {
    const record = { run_id: "e/pr-0464", agent: "reviewer", task: "t", started: "2026-10-20T01:00:00Z", ended: "2026-10-20T01:01:00Z", outcome: "success" };
    const tool = JSON.stringify({ type: "assistant", timestamp: "2026-10-20T01:00:10Z", message: { id: "m1", content: [{ type: "tool_use", id: "t1", name: "Bash", input: {} }] } });
    const spans = toOtlp(record, tool, undefined, {
      trace: { "langfuse.environment": "evals", "langfuse.experiment.id": "e" },
      root: { "langfuse.experiment.item.expected_output": "{}" },
    }).resourceSpans[0].scopeSpans[0].spans;
    const attr = (s: (typeof spans)[number], k: string) => s.attributes.find((a) => a.key === k)?.value.stringValue;
    assert.ok(spans.length > 1);
    assert.ok(spans.every((s) => attr(s, "langfuse.environment") === "evals" && attr(s, "langfuse.experiment.id") === "e"));
    assert.deepEqual(spans.map((s) => attr(s, "langfuse.experiment.item.expected_output") !== undefined), spans.map((s) => !s.parentSpanId));
  });
});
