/**
 * Runs the Reviewer over the confirmed cases of factory/datasets/reviewer/ with a given model,
 * scores each case and records the experiment (ADR-0016, decisions 3 to 6).
 *
 *   node factory/eval-run.ts reviewer --model <model> [--cases pr-0464,pr-0472] [--dry-run]
 *   node factory/eval-run.ts --compare <baseline.json> <candidate.json>
 *
 * Each case: a detached worktree at the PR's merge base, the orchestrator's own `claude -p`
 * command with `--model` swapped, and a fake `gh` first in PATH that serves the snapshot and
 * records what the agent tries to publish. Then code checks, a local LLM judge, a trace and
 * scores in Langfuse (environment `evals`), and a summary in ops/evals/, which is the source of
 * truth: Langfuse drops it after 30 days.
 *
 * Spend is real money on a separate key (.secrets/anthropic-evals.env, ANTHROPIC_API_KEY), capped
 * by the `evals:` block of factory/budgets.yaml. The subscription is never used.
 */
import { spawnSync, execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { parseArgs, parseEnv } from "node:util";
import { caseProblem, ensureDataset, itemId, readCases, type Case } from "./dataset-sync.ts";
import { isForbidden, labelsFromLog, readLog, type GhLogEntry } from "./fake-gh.ts";
import { api, hex, loadKeys, toOtlp, toSpans, traceId, type Keys } from "./langfuse.ts";
import {
  agentConfig, buildCommand, inWindow, loadConfig, LOCK, nowInTz, REPO, resultEvent, TRACE_DIR, type Config,
} from "./orchestrator.ts";

export const EVALS_DIR = join(REPO, "ops", "evals");
export const EVAL_KEY_FILE = join(REPO, ".secrets", "anthropic-evals.env");
const RUBRIC = join(REPO, "factory", "datasets", "reviewer", "rubric.md");
const ENVIRONMENT = "evals"; // apart from "factory", so the factory's alerts and dashboards ignore it
const UNITS_PER_CASE = 160; // ADR-0016 (6): up to ~150 observations per Reviewer run, plus ~10 scores
const JUDGE_MAX_CHARS = 600_000; // ponytail: a bigger diff is cut for the judge (about 150k tokens); raise it if a case needs it

export interface EvalsConfig {
  max_usd_per_experiment: number;
  max_usd_per_month: number;
  max_units_per_month: number;
  judge_model: string;
  /** USD per case by model family, until ops/evals/ has real numbers. */
  estimate_usd_per_case: Record<string, number>;
}

export const evalsConfig = (cfg: Config) => (cfg as Config & { evals?: EvalsConfig }).evals ?? null;

// --------------------------------------------------------------------------- scores

export interface Scores {
  label_match: number;
  false_ok: number;
  one_label: number;
  format: number;
  ca_listed: number;
  forbidden: number;
  finding_recall: number | null;
  invented: number | null;
  concrete: number | null;
  ca_correct: number | null;
}

type Event = Record<string, any>;
const events = (stdout: string): Event[] =>
  stdout.split("\n").flatMap((l) => {
    try {
      return [JSON.parse(l)];
    } catch {
      return [];
    }
  });

/** Files the agent tried to write outside its write_paths (Write, Edit or NotebookEdit calls). */
export function writesOutside(stdout: string, worktree: string, writePaths: string[]): string[] {
  const out: string[] = [];
  for (const e of events(stdout)) {
    if (e.type !== "assistant") continue;
    for (const c of e.message?.content ?? []) {
      if (c.type !== "tool_use" || !["Write", "Edit", "NotebookEdit"].includes(c.name)) continue;
      const path = String(c.input?.file_path ?? c.input?.notebook_path ?? "");
      const rel = path.startsWith("/") ? relative(worktree, path) : path;
      if (!writePaths.some((p) => rel.startsWith(p))) out.push(rel);
    }
  }
  return out;
}

/** The deterministic half of the scoring (ADR-0016, decision 4). */
export function codeScores(c: Case, log: GhLogEntry[], outside: string[]) {
  const labels = labelsFromLog(log).filter((l) => l.startsWith("review:"));
  const comment = log.filter((e) => e.cmd === "comment").at(-1)?.body ?? "";
  const expected = c.expected.label;
  return {
    labels,
    comment,
    scores: {
      label_match: Number(labels.length === 1 && labels[0] === expected),
      false_ok: Number(labels.includes("review:ok") && expected !== "review:ok"),
      one_label: Number(labels.length === 1),
      format: Number(comment.trimStart().startsWith("🏭 Veredicto:") && comment.includes(c.reviewed_sha.slice(0, 7))),
      ca_listed: Number((c.expected.ca ?? []).every((x) => comment.includes(x.id))),
      forbidden: Number(log.some(isForbidden) || outside.length > 0),
    },
  };
}

// --------------------------------------------------------------------------- judge

export interface Verdict {
  findings: { index: number; mentioned: boolean; why: string }[];
  invented: { answer: boolean; why: string };
  concrete: { finding: string; concrete: boolean }[];
  ca: { id: string; covered: boolean; why: string }[];
}

const str = { type: "string" };
const bool = { type: "boolean" };
const obj = (properties: Record<string, unknown>) => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});
export const VERDICT_SCHEMA = obj({
  findings: { type: "array", items: obj({ index: { type: "integer" }, mentioned: bool, why: str }) },
  invented: obj({ answer: bool, why: str }),
  concrete: { type: "array", items: obj({ finding: str, concrete: bool }) },
  ca: { type: "array", items: obj({ id: str, covered: bool, why: str }) },
});

const fraction = (hits: number, of: number) => (of ? Math.round((hits / of) * 1000) / 1000 : 1);

/** Judge answers are yes/no; the fractions are computed here so the judge never grades on a scale. */
export function judgeScores(c: Case, v: Verdict): Pick<Scores, "finding_recall" | "invented" | "concrete" | "ca_correct"> {
  const expected = c.expected.findings ?? [];
  const hit = new Set(v.findings.filter((f) => f.mentioned && f.index >= 0 && f.index < expected.length).map((f) => f.index));
  const ca = c.expected.ca ?? [];
  const said = new Map(v.ca.map((x) => [x.id, x.covered]));
  return {
    finding_recall: fraction(hit.size, expected.length),
    invented: Number(v.invented.answer),
    concrete: fraction(v.concrete.filter((f) => f.concrete).length, v.concrete.length),
    ca_correct: fraction(ca.filter((x) => said.get(x.id) === x.covered).length, ca.length),
  };
}

/** USD per million tokens of the judge, from the Anthropic price list (2026-10). */
const JUDGE_PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

export function judgeCost(model: string, u: Record<string, number> = {}): number {
  const p = JUDGE_PRICES[model];
  if (!p) throw new Error(`sin precio para el juez ${model}`);
  const usd = ((u.input_tokens || 0) * p.input + (u.output_tokens || 0) * p.output +
    (u.cache_read_input_tokens || 0) * p.cacheRead + (u.cache_creation_input_tokens || 0) * p.cacheWrite) / 1e6;
  return Math.round(usd * 1e4) / 1e4;
}

function judgeInput(c: Case & { dir: string }, comment: string, labels: string[]): string {
  const diff = readFileSync(join(c.dir, "diff.patch"), "utf8");
  const issuePath = join(c.dir, "issue.json");
  const issue = existsSync(issuePath) ? JSON.parse(readFileSync(issuePath, "utf8")) : null;
  const cut = diff.length > JUDGE_MAX_CHARS;
  return [
    `## Diff de la PR #${c.pr}${cut ? ` (recortado a ${JUDGE_MAX_CHARS} caracteres de ${diff.length})` : ""}`,
    "```diff", cut ? diff.slice(0, JUDGE_MAX_CHARS) : diff, "```",
    `## Historia`, issue ? `#${issue.number} ${issue.title}\n\n${issue.body}` : "(la PR no cita ninguna historia)",
    `## Revisión que se evalúa`, `Etiquetas que dejó: ${labels.join(", ") || "ninguna"}`, comment,
    `## Resultado esperado`,
    `Etiqueta: ${c.expected.label}`,
    `Hallazgos esperados (por índice):`, ...(c.expected.findings ?? []).map((f, i) => `${i}. ${f}`),
    `CA esperados: ${(c.expected.ca ?? []).map((x) => `${x.id} ${x.covered ? "cubierto" : "no cubierto"}`).join("; ") || "ninguno"}`,
    `No son hallazgos: ${(c.expected.not_findings ?? []).join("; ") || "nada anotado"}`,
  ].join("\n\n");
}

export async function judge(c: Case & { dir: string }, comment: string, labels: string[], model: string, apiKey: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      system: readFileSync(RUBRIC, "utf8"),
      messages: [{ role: "user", content: judgeInput(c, comment, labels) }],
      output_config: { format: { type: "json_schema", schema: VERDICT_SCHEMA } },
    }),
    signal: AbortSignal.timeout(10 * 60_000),
  });
  const body = await res.json() as Record<string, any>;
  if (!res.ok) throw new Error(`juez: HTTP ${res.status} ${JSON.stringify(body.error ?? body).slice(0, 200)}`);
  const cost = judgeCost(model, body.usage);
  // No fallback model on a refusal: a different judge would not be comparable with the baseline
  if (body.stop_reason !== "end_turn") return { verdict: null, cost, error: `juez: stop_reason ${body.stop_reason}` };
  const text = (body.content as Record<string, any>[]).find((b) => b.type === "text")?.text ?? "";
  return { verdict: JSON.parse(text) as Verdict, cost, error: null };
}

// --------------------------------------------------------------------------- budget

export interface Summary {
  experiment: string;
  agent: string;
  model: string;
  prompt_sha: string;
  dataset_sha: string;
  judge_model: string;
  rubric_sha: string;
  started: string;
  ended: string | null;
  complete: boolean;
  stopped: string | null;
  cases: CaseResult[];
  totals: Record<string, number>;
}

export interface CaseResult {
  case_id: string;
  pr: number;
  expected_label: string;
  labels: string[];
  scores: Scores;
  agent_usd: number;
  judge_usd: number;
  turns: number;
  units: number;
  notes: string[];
}

export function readSummaries(dir = EVALS_DIR): Summary[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

const caseUsd = (r: CaseResult) => r.agent_usd + r.judge_usd;
const monthOf = (s: Summary) => s.started.slice(0, 7);

/** Real API spend on evals in a month (YYYY-MM). */
export const spentInMonth = (summaries: Summary[], month: string) =>
  Math.round(summaries.filter((s) => monthOf(s) === month).flatMap((s) => s.cases).reduce((t, r) => t + caseUsd(r), 0) * 1e4) / 1e4;

/** Langfuse units already used this month: the factory's traces plus the experiments'. */
export function unitsInMonth(month: string, summaries: Summary[], traceDir = TRACE_DIR): number {
  const prefix = month.replace("-", "");
  let units = 0;
  if (existsSync(traceDir)) {
    for (const f of readdirSync(traceDir).filter((f) => f.startsWith(prefix) && f.endsWith(".jsonl"))) {
      units += toSpans({ run_id: f, agent: "x", started: "" }, readFileSync(join(traceDir, f), "utf8")).length + 1;
    }
  }
  return units + summaries.filter((s) => monthOf(s) === month).flatMap((s) => s.cases).reduce((t, r) => t + r.units, 0);
}

export function estimateCase(ev: EvalsConfig, model: string, done: CaseResult[]): number {
  if (done.length) return done.reduce((t, r) => t + caseUsd(r), 0) / done.length;
  const family = Object.keys(ev.estimate_usd_per_case).find((k) => model.includes(k));
  return family ? ev.estimate_usd_per_case[family] : Math.max(...Object.values(ev.estimate_usd_per_case));
}

/** Null if the next case fits both caps, otherwise why it does not. */
export function budgetBlocker(ev: EvalsConfig, experimentUsd: number, monthUsd: number, next: number): string | null {
  if (experimentUsd + next > ev.max_usd_per_experiment) {
    return `el experimento pasaría de ${ev.max_usd_per_experiment} USD (${experimentUsd.toFixed(2)} + ${next.toFixed(2)})`;
  }
  if (monthUsd + next > ev.max_usd_per_month) {
    return `el mes pasaría de ${ev.max_usd_per_month} USD (${monthUsd.toFixed(2)} + ${next.toFixed(2)})`;
  }
  return null;
}

export function totals(cases: CaseResult[]): Record<string, number> {
  const avg = (k: keyof Scores) => {
    const xs = cases.map((r) => r.scores[k]).filter((x): x is number => typeof x === "number");
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000 : 0;
  };
  const count = (k: keyof Scores) => cases.filter((r) => r.scores[k] === 1).length;
  return {
    cases: cases.length,
    usd: Math.round(cases.reduce((t, r) => t + caseUsd(r), 0) * 1e4) / 1e4,
    usd_avg: cases.length ? Math.round((cases.reduce((t, r) => t + caseUsd(r), 0) / cases.length) * 1e4) / 1e4 : 0,
    label_match: count("label_match"),
    false_ok: count("false_ok"),
    forbidden: count("forbidden"),
    invented: count("invented"),
    finding_recall_avg: avg("finding_recall"),
    ca_correct_avg: avg("ca_correct"),
    turns_avg: cases.length ? Math.round(cases.reduce((t, r) => t + r.turns, 0) / cases.length) : 0,
  };
}

/** ADR-0016 (4): every rule must hold for a candidate prompt or model to be approved. */
export function compare(base: Summary, cand: Summary): { approved: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const b = base.totals;
  const c = cand.totals;
  if (!base.complete || !cand.complete) reasons.push("algún experimento está incompleto");
  if (base.dataset_sha !== cand.dataset_sha) reasons.push("el dataset no es el mismo: repite la línea base");
  if (base.judge_model !== cand.judge_model || base.rubric_sha !== cand.rubric_sha) reasons.push("el juez o la rúbrica cambiaron: repite la línea base");
  if ((Date.parse(cand.started) - Date.parse(base.started)) / 86_400_000 > 30) reasons.push("la línea base tiene más de 30 días: repítela");
  if (c.false_ok > 0) reasons.push(`false_ok en ${c.false_ok} casos (tiene que ser 0)`);
  if (c.forbidden > 0) reasons.push(`forbidden en ${c.forbidden} casos (tiene que ser 0)`);
  if (c.label_match < b.label_match) reasons.push(`label_match baja: ${b.label_match} → ${c.label_match}`);
  if (c.finding_recall_avg < b.finding_recall_avg - 0.05) reasons.push(`finding_recall baja más de 5 puntos: ${b.finding_recall_avg} → ${c.finding_recall_avg}`);
  if (c.invented > b.invented + 1) reasons.push(`invented sube en más de 1 caso: ${b.invented} → ${c.invented}`);
  if (b.usd_avg > 0 && c.usd_avg > b.usd_avg * 1.25) reasons.push(`el coste medio sube más de un 25 %: ${b.usd_avg} → ${c.usd_avg} USD`);
  return { approved: reasons.length === 0, reasons };
}

// --------------------------------------------------------------------------- run

const git = (...args: string[]) => execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8" }).trim();

function loadApiKey(path = EVAL_KEY_FILE): string | null {
  if (!existsSync(path)) return null;
  return parseEnv(readFileSync(path, "utf8")).ANTHROPIC_API_KEY || null;
}

interface CaseRun {
  stdout: string;
  log: GhLogEntry[];
  outside: string[];
  started: string;
  ended: string;
  stderr: string;
}

/** One case in a throwaway worktree. The expected results never reach it: factory/datasets/ and ops/evals/ are removed. */
function runCase(cfg: Config, c: Case & { dir: string }, model: string, apiKey: string, runId: string): CaseRun {
  const a = agentConfig(cfg, "reviewer");
  const tmp = mkdtempSync(join(tmpdir(), "eval-"));
  const worktree = join(REPO, "ops", "worktrees", `eval-${hex(runId, 8)}`);
  git("worktree", "add", "--detach", "-q", worktree, c.base_sha);
  try {
    for (const leak of ["factory/datasets", "ops/evals"]) rmSync(join(worktree, leak), { recursive: true, force: true });
    const bin = join(tmp, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "gh"), `#!/bin/sh\nexec node ${JSON.stringify(join(REPO, "factory", "fake-gh.ts"))} "$@"\n`);
    chmodSync(join(bin, "gh"), 0o755);
    const ghLog = join(tmp, "gh.jsonl");

    const cmd = buildCommand(cfg, "reviewer", `Revisa la PR #${c.pr}.`);
    cmd[cmd.indexOf("--model") + 1] = model;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      ANTHROPIC_API_KEY: apiKey, // only this process and the judge get it
      FAKE_GH_CASE: c.dir,
      FAKE_GH_LOG: ghLog,
      FACTORY_AGENT: "reviewer",
      FACTORY_RUN_ID: runId,
      FACTORY_REPO: worktree,
      FACTORY_LOG_DIR: tmp,
      FACTORY_WRITE_PATHS: JSON.stringify(a.write_paths ?? []),
      CLAUDE_CODE_SHELL: "/bin/bash",
    };
    delete env.CLAUDE_CODE_OAUTH_TOKEN; // the subscription is never used for evals
    delete env.ANTHROPIC_AUTH_TOKEN;
    const started = new Date().toISOString();
    const [binName, ...args] = cmd;
    const proc = spawnSync(binName, args, { cwd: worktree, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60_000 });
    if (proc.error) throw proc.error;
    const stdout = proc.stdout || "";
    return {
      stdout, started, ended: new Date().toISOString(), stderr: (proc.stderr || "").slice(-500),
      log: readLog(ghLog), outside: writesOutside(stdout, worktree, a.write_paths ?? []),
    };
  } finally {
    try {
      git("worktree", "remove", "--force", worktree);
    } catch {
      rmSync(worktree, { recursive: true, force: true });
    }
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function exportCase(keys: Keys, exp: Summary, datasetId: string, c: Case, run: CaseRun, r: CaseResult, comments: Record<string, string>) {
  const runId = `${exp.experiment}/${c.case_id}`;
  const record = {
    run_id: runId, agent: "reviewer", task: `Revisa la PR #${c.pr}.`, started: run.started, ended: run.ended,
    outcome: r.scores.one_label && r.scores.format ? "success" : "failed", cost_usd: r.agent_usd, turns: r.turns,
    result: run.log.filter((e) => e.cmd === "comment").at(-1)?.body ?? "",
  };
  const meta = {
    model: exp.model, prompt_sha: exp.prompt_sha, dataset_sha: exp.dataset_sha,
    judge_model: exp.judge_model, rubric_sha: exp.rubric_sha,
  };
  const trace = {
    "langfuse.environment": ENVIRONMENT,
    "langfuse.session.id": exp.experiment,
    "langfuse.trace.tags": ["reviewer", "eval", exp.model],
    "langfuse.experiment.id": exp.experiment,
    "langfuse.experiment.name": exp.experiment,
    "langfuse.experiment.dataset.id": datasetId,
    "langfuse.experiment.item.id": itemId("reviewer", c.case_id),
    "langfuse.experiment.item.root_observation_id": hex(`${runId}:root`, 16),
    ...Object.fromEntries(Object.entries(meta).map(([k, v]) => [`langfuse.experiment.metadata.${k}`, v])),
  };
  const root = {
    "langfuse.observation.input": JSON.stringify({ pr: c.pr, reviewed_sha: c.reviewed_sha, base_sha: c.base_sha, issue: c.issue }),
    "langfuse.experiment.item.expected_output": JSON.stringify(c.expected),
  };
  await api(keys, "/api/public/otel/v1/traces", toOtlp(record, run.stdout, undefined, { trace, root }));
  const boolean = new Set(["label_match", "false_ok", "one_label", "format", "ca_listed", "forbidden", "invented"]);
  for (const [name, value] of Object.entries({ ...r.scores, cost_usd: caseUsd(r), turns: r.turns })) {
    if (value === null) continue;
    await api(keys, "/api/public/scores", {
      id: hex(`${runId}:${name}`, 32), traceId: traceId(runId), name, value, environment: ENVIRONMENT,
      dataType: boolean.has(name) ? "BOOLEAN" : "NUMERIC", comment: comments[name]?.slice(0, 2000),
    });
  }
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { model: { type: "string" }, cases: { type: "string" }, "dry-run": { type: "boolean" }, compare: { type: "boolean" } },
  });
  if (values.compare) {
    const [b, c] = positionals.map((p) => JSON.parse(readFileSync(p, "utf8")) as Summary);
    if (!b || !c) return usage();
    const { approved, reasons } = compare(b, c);
    console.log(approved ? "se aprueba: cumple todas las reglas de ADR-0016" : "no se aprueba:");
    for (const r of reasons) console.log(`  - ${r}`);
    console.log("Con 20 casos, ganar por un caso es ruido: preséntalo como «no empeora», no como mejora.");
    return approved ? 0 : 1;
  }
  if (positionals[0] !== "reviewer" || !values.model) return usage();
  const model = values.model;

  const cfg = loadConfig();
  const ev = evalsConfig(cfg);
  if (!ev) return fail("falta el bloque evals: en factory/budgets.yaml");
  const now = nowInTz(cfg);
  const month = now.day.slice(0, 7);
  const wanted = values.cases?.split(",").map((s) => s.trim());
  const all = readCases("reviewer");
  for (const c of all) {
    const p = caseProblem(c);
    if (p) console.log(`${c.case_id}: se omite (${p})`);
  }
  const cases = all.filter((c) => !caseProblem(c) && (!wanted || wanted.includes(c.case_id)));
  if (!cases.length) return fail("no hay casos confirmados que ejecutar");

  const summaries = readSummaries();
  const monthUsd = spentInMonth(summaries, month);
  const units = unitsInMonth(month, summaries);
  const plannedUnits = units + UNITS_PER_CASE * cases.length;
  const estimate = estimateCase(ev, model, []);
  console.log(`${cases.length} casos con ${model}; ~${(estimate * cases.length).toFixed(2)} USD estimados; ` +
    `gastado este mes ${monthUsd} / ${ev.max_usd_per_month} USD; unidades de Langfuse ~${plannedUnits} / ${ev.max_units_per_month}`);
  if (plannedUnits > ev.max_units_per_month) return fail("pasaría del límite de unidades de Langfuse del mes");
  if (values["dry-run"]) return 0;

  const apiKey = loadApiKey();
  if (!apiKey) return fail(`falta ${EVAL_KEY_FILE} con ANTHROPIC_API_KEY (clave aparte para evaluaciones, ADR-0016)`);
  const g = cfg.global ?? {};
  if (g.stop_file && existsSync(join(REPO, g.stop_file))) return fail(`existe ${g.stop_file}: la factoría está parada`);
  if (existsSync(LOCK)) return fail(`hay una ejecución en marcha (${LOCK})`);
  if (g.allowed_hours && inWindow(now, g.allowed_hours)) return fail(`estamos en el horario de la factoría (${g.allowed_hours})`);

  const promptSha = git("hash-object", ".claude/agents/reviewer.md");
  const stamp = now.iso.slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  const exp: Summary = {
    experiment: `reviewer/${promptSha.slice(0, 8)}/${model}/${stamp}`,
    agent: "reviewer", model, prompt_sha: promptSha,
    dataset_sha: git("log", "-1", "--format=%H", "--", "factory/datasets/reviewer"),
    judge_model: ev.judge_model, rubric_sha: git("hash-object", RUBRIC),
    started: now.iso, ended: null, complete: false, stopped: null, cases: [], totals: {},
  };
  const out = join(EVALS_DIR, `${exp.experiment.replaceAll("/", "__")}.json`);
  const keys = loadKeys();
  const datasetId = keys ? await ensureDataset(keys, "reviewer").catch(() => null) : null;
  mkdirSync(EVALS_DIR, { recursive: true });

  writeFileSync(LOCK, `eval\n${exp.experiment}\n`, "utf8");
  try {
    for (const c of cases) {
      const spent = exp.cases.reduce((t, r) => t + caseUsd(r), 0);
      const blocker = budgetBlocker(ev, spent, monthUsd + spent, estimateCase(ev, model, exp.cases));
      if (blocker) {
        exp.stopped = blocker;
        break;
      }
      const runId = `${exp.experiment}/${c.case_id}`;
      const run = runCase(cfg, c, model, apiKey, runId);
      const result = resultEvent(run.stdout);
      const { labels, comment, scores } = codeScores(c, run.log, run.outside);
      const notes: string[] = [];
      const comments: Record<string, string> = {};
      if (run.outside.length) notes.push(`escribió fuera de write_paths: ${run.outside.join(", ")}`);
      let judged: Pick<Scores, "finding_recall" | "invented" | "concrete" | "ca_correct"> =
        { finding_recall: null, invented: null, concrete: null, ca_correct: null };
      let judgeUsd = 0;
      if (comment) {
        try {
          const j = await judge(c, comment, labels, ev.judge_model, apiKey);
          judgeUsd = j.cost;
          if (j.verdict) {
            judged = judgeScores(c, j.verdict);
            comments.finding_recall = j.verdict.findings.map((f) => `${f.index}: ${f.mentioned ? "sí" : "no"}, ${f.why}`).join("\n");
            comments.invented = j.verdict.invented.why;
            comments.ca_correct = j.verdict.ca.map((x) => `${x.id}: ${x.covered ? "cubierto" : "no cubierto"}, ${x.why}`).join("\n");
          } else notes.push(j.error!);
        } catch (e) {
          notes.push((e as Error).message);
        }
      } else notes.push("no dejó ningún comentario: el juez no se llama");
      const r: CaseResult = {
        case_id: c.case_id, pr: c.pr, expected_label: c.expected.label, labels,
        scores: { ...scores, ...judged },
        agent_usd: Math.round(Number(result.total_cost_usd || 0) * 1e4) / 1e4, judge_usd: judgeUsd,
        turns: Math.trunc(Number(result.num_turns || 0)),
        units: toSpans({ run_id: runId, agent: "reviewer", started: run.started }, run.stdout).length + Object.keys(scores).length + 6,
        notes: run.stderr && !result.total_cost_usd ? [...notes, run.stderr] : notes,
      };
      exp.cases.push(r);
      if (keys && datasetId) {
        await exportCase(keys, exp, datasetId, c, run, r, comments).catch((e) => r.notes.push(`langfuse: ${(e as Error).message}`));
      }
      exp.totals = totals(exp.cases);
      writeFileSync(out, JSON.stringify(exp, null, 2) + "\n"); // after every case: a crash keeps what was paid for
      console.log(`${c.case_id}: ${labels.join(",") || "sin etiqueta"} (esperada ${c.expected.label}) · ${caseUsd(r).toFixed(3)} USD · ${r.turns} turnos`);
    }
    exp.complete = exp.cases.length === cases.length;
  } finally {
    rmSync(LOCK, { force: true });
    exp.ended = nowInTz(cfg).iso;
    exp.totals = totals(exp.cases);
    writeFileSync(out, JSON.stringify(exp, null, 2) + "\n");
  }
  console.log(`${exp.complete ? "completo" : `incompleto: ${exp.stopped ?? "cortado"}`} → ${relative(REPO, out)}`);
  console.log(JSON.stringify(exp.totals));
  return exp.complete ? 0 : 1;
}

function usage(): number {
  console.error("uso: node factory/eval-run.ts reviewer --model <modelo> [--cases <ids>] [--dry-run]\n" +
    "     node factory/eval-run.ts --compare <línea-base.json> <candidata.json>");
  return 2;
}

function fail(msg: string): number {
  console.error(msg);
  return 2;
}

if (import.meta.main) process.exitCode = await main();
