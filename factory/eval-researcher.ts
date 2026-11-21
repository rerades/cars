/**
 * Prompt evals of the Researcher (ADR-0026, decisions 2 and 3): each confirmed case of
 * factory/datasets/researcher/ runs in a worktree at its start commit, with its frozen reads
 * replayed instead of the network, and is scored by code on the data/ it leaves.
 * The CLI is `node factory/eval-run.ts researcher --model <model> [--cases <ids>] [--dry-run]`.
 */
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { parse } from "yaml";
import { FETCH_DATASET, RESEARCHER_DATASET } from "./dataset-capture.ts";
// Types only: eval-run.ts imports this module while it is still running its main, so the
// functions it shares come in as `EvalDeps` instead of an import (a cycle there never settles).
import type { CaseResult, Summary } from "./eval-run.ts";
import type * as EvalRun from "./eval-run.ts";
export type EvalDeps = Pick<typeof EvalRun, "budgetBlocker" | "EVALS_DIR" | "estimateCase" | "evalsConfig" | "loadApiKey" | "readSummaries" | "spentInMonth" | "writesOutside">;
import { offerEnd, runEvals } from "./evals.ts";
import { replayGuard, type ReplayEntry } from "./fetch-replay.ts";
import { agentConfig, buildCommand, inWindow, loadConfig, LOCK, nowInTz, REPO, resultEvent, type Config } from "./orchestrator.ts";
import { check, numberPattern, sourcedByPath, type Item } from "./verify-data.ts";

export const RULES = ["dates", "price_proof", "price_kind", "cash_amount", "expired_offer", "page_name"] as const;
/** The scores that tell whether a case's rule held (decision 3, approval rule 2). */
const RULE_SCORES: Record<string, string> = {
  dates: "dates", price_proof: "price_proof", price_kind: "price_kind", cash_amount: "cash_amount",
  expired_offer: "expired_offer", page_name: "page_name_literal",
};

export interface ExpectedField {
  value?: unknown;
  price_kind?: string | null;
  date?: "fresh" | "kept";
}

export interface ResearcherCase {
  case_id: string;
  pr: number;
  run_id: string;
  baseRefOid: string;
  date: string;
  task: string;
  confirmed: boolean;
  rules: string[];
  /** file → path of a Sourced value (as sourcedByPath names it, e.g. `versions[Born VZ].price`) → expectation */
  expected: Record<string, Record<string, ExpectedField>> | null;
  fetch: { file: string; sha256: string }[];
  dir: string;
}

export type ResearcherScores = Record<string, number | null>;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const fraction = (ok: number, total: number) => (total ? Math.round((ok / total) * 1000) / 1000 : null);

export function readResearcherCases(dir = RESEARCHER_DATASET): ResearcherCase[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((d) => existsSync(join(dir, d, "case.yaml"))).sort()
    .map((d) => ({ ...parse(readFileSync(join(dir, d, "case.yaml"), "utf8")), dir: join(dir, d) }));
}

/** Why a case cannot run, or null: unconfirmed, without expected, or a frozen read missing or changed. */
export function researcherCaseProblem(c: ResearcherCase, fetchRoot = FETCH_DATASET): string | null {
  if (!c.confirmed) return "sin confirmar";
  if (!c.expected || !Object.keys(c.expected).length) return "sin expected";
  const unknown = (c.rules ?? []).filter((r) => !(RULES as readonly string[]).includes(r));
  if (unknown.length) return `reglas desconocidas: ${unknown.join(", ")}`;
  for (const f of c.fetch ?? []) {
    const path = join(fetchRoot, c.case_id, "fetch", f.file);
    if (!existsSync(path)) return `falta la lectura congelada ${relative(REPO, path)} (node factory/dataset-capture.ts researcher ${c.pr})`;
    if (sha256(readFileSync(path, "utf8")) !== f.sha256) return `la lectura ${f.file} no coincide con su sha256`;
  }
  return null;
}

/** The lines the agent saw of a page in this run: every successful fetch-page.ts answer for that URL. */
function linesFor(calls: ReplayEntry[], url: string): string[] | null {
  const outs = calls.filter((c) => c.tool === "fetch-page" && c.code === 0).map((c) => JSON.parse(c.stdout))
    .filter((o) => o.url === url || o.final_url === url);
  if (!outs.length) return null;
  return outs.flatMap((o) => (Array.isArray(o.paragraphs) ? o.paragraphs : String(o.text ?? "").split("\n")));
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/**
 * The code scores of decision 3 on the data/ the run left. `base` and `head` map each touched file to
 * its parsed YAML at the start commit and after the run (null when absent).
 * ponytail: open_questions_ok (the judge) is null for now; the judge informs and never decides approval.
 */
export function researcherScores(c: ResearcherCase, base: Map<string, any>, head: Map<string, any>, calls: ReplayEntry[], schemaFailed: string[]) {
  const notes: string[] = [];
  const s: ResearcherScores = { schema: schemaFailed.length ? 0 : 1 };
  if (schemaFailed.length) notes.push(...schemaFailed.map((f) => `schema: ${f}`));

  // dates: a retrieved that went up needs a read of its url showing the value; kept fields keep both.
  let datesOk = 0, datesTotal = 0, unread = 0;
  const priceProof = [0, 0], priceFound = [0, 0], terms = [0, 0], pageName = [0, 0];
  let expired = false;
  for (const [file, doc] of head) {
    if (!file.startsWith("data/raw/")) continue;
    const before = sourcedByPath(base.get(file));
    for (const [path, { node, field, version, anchor }] of sourcedByPath(doc)) {
      const old = before.get(path)?.node;
      const lines = linesFor(calls, String(node.url));
      if (node.retrieved !== old?.retrieved) {
        datesTotal++;
        // A number must show up in the read; a list of numbers, each one. Anything else (on_sale,
        // fwd, a segment) never reads literally, so as in ADR-0020 only the read itself is checked.
        const shows = (v: number) => check({ file, path, field, value: v, url: String(node.url), kind: "number" } as Item, lines!).status !== "missing";
        const v = node.value;
        const read = lines && (typeof v === "number" ? shows(v)
          : Array.isArray(v) && v.length && v.every((x) => typeof x === "number") ? v.every(shows) : true);
        if (read) datesOk++;
        else {
          unread++;
          notes.push(`dates: ${file} ${path} retrieved ${old?.retrieved ?? "—"} → ${node.retrieved} sin lectura que muestre ${JSON.stringify(node.value)}`);
        }
      }
      if (field !== "price" || version === undefined) continue;
      const changed = !old || old.url !== node.url || !same(old.value, node.value);
      if (changed) {
        priceProof[1]++;
        const names = [version, typeof node.page_name === "string" ? node.page_name : ""].filter(Boolean).map((n) => n.toLowerCase());
        // The redirect target counts, as in linesFor: PR #808 stored /polestar-4-coupe/, where /polestar-4/ lands.
        const proved = calls.some((k) => k.tool === "fetch-page" &&
          (k.args[0] === node.url || (k.code === 0 && JSON.parse(k.stdout).final_url === node.url)) &&
          (typeof node.value !== "number" || k.args.slice(1).some((w) => numberPattern(node.value as number).test(w))) &&
          k.args.slice(1).some((w) => names.some((n) => n.includes(w.toLowerCase()) || w.toLowerCase().includes(n))));
        if (proved) priceProof[0]++;
        else notes.push(`price_proof: ${file} ${path} sin fetch-page.ts a ${node.url} con el importe y el nombre`);
        if (typeof node.value === "number") {
          priceFound[1]++;
          const st = lines ? check({ file, path, field, value: node.value, url: String(node.url), kind: "number", version, names: anchor?.names, pageNames: anchor?.pageNames }, lines).status : "missing";
          if (st === "found" || st === "unanchored") priceFound[0]++;
          else notes.push(`price_found: ${file} ${path} ${node.value} ${st}`);
        }
      }
      if (typeof node.price_terms === "string" && typeof node.price_terms_url === "string" && old?.price_terms !== node.price_terms) {
        // The terms are proved by a read of their own page too (PR #808: a price_terms_url nobody read).
        priceProof[1]++;
        if (linesFor(calls, node.price_terms_url)) priceProof[0]++;
        else notes.push(`price_proof: ${file} ${path} price_terms_url ${node.price_terms_url} sin leer`);
        terms[1]++;
        const tl = linesFor(calls, node.price_terms_url);
        if (tl && check({ file, path, field: "price_terms", value: node.price_terms, url: node.price_terms_url, kind: "terms" }, tl).status === "found") terms[0]++;
        else notes.push(`price_terms_literal: ${file} ${path} no está literal en ${node.price_terms_url}`);
      }
      if (typeof node.page_name === "string" && old?.page_name !== node.page_name) {
        pageName[1]++;
        if (lines?.join(" ").includes(node.page_name)) pageName[0]++;
        else notes.push(`page_name_literal: ${file} ${path} «${node.page_name}» no está en ${node.url}`);
      }
      const end = node.price_kind === "financed" ? offerEnd(node.price_terms) : undefined;
      if (end && end < c.date) {
        expired = true;
        notes.push(`expired_offer: ${file} ${path} oferta hasta ${end}, anterior a ${c.date}`);
      }
    }
  }
  // last_verified of a source needs a read of one of its hosts in this run.
  for (const [file, doc] of head) {
    if (!file.startsWith("data/sources/") || doc?.last_verified === base.get(file)?.last_verified) continue;
    datesTotal++;
    const hosts = new Set(Object.values(doc?.urls ?? {}).map((u) => hostOf(String(u))).filter(Boolean));
    const read = calls.some((k) => k.code === 0 && (k.tool === "fetch-idae" ? doc?.id === "idae-es"
      : k.tool === "fetch-page" && hosts.has(hostOf(JSON.parse(k.stdout).final_url ?? k.args[0]))));
    if (read) datesOk++;
    else {
      unread++;
      notes.push(`dates: ${file} last_verified ${base.get(file)?.last_verified ?? "—"} → ${doc?.last_verified} sin lectura de sus hosts`);
    }
  }

  // expected: values, price kinds and the fields that must keep their date.
  const vm = [0, 0], pk = [0, 0], cash = [0, 0];
  for (const [file, fields] of Object.entries(c.expected ?? {})) {
    const now = sourcedByPath(head.get(file));
    const was = sourcedByPath(base.get(file));
    for (const [path, want] of Object.entries(fields)) {
      const node = now.get(path)?.node;
      if ("value" in want) {
        vm[1]++;
        if (same(node?.value, want.value)) vm[0]++;
        else notes.push(`value_match: ${file} ${path} ${JSON.stringify(node?.value)} (esperado ${JSON.stringify(want.value)})`);
        if (path.endsWith(".price")) {
          cash[1]++;
          if (same(node?.value, want.value)) cash[0]++;
        }
      }
      if ("price_kind" in want) {
        pk[1]++;
        if ((node?.price_kind ?? null) === want.price_kind) pk[0]++;
        else notes.push(`price_kind: ${file} ${path} ${node?.price_kind ?? null} (esperado ${want.price_kind})`);
      }
      if (want.date === "kept") {
        datesTotal++;
        const old = was.get(path)?.node;
        if (node?.retrieved === old?.retrieved && same(node?.value, old?.value)) datesOk++;
        else notes.push(`dates: ${file} ${path} tenía que quedarse como estaba`);
      }
    }
  }

  const ok = s.schema === 1;
  const put = (k: string, v: number | null) => { s[k] = ok || v === null ? v : 0; };
  put("dates", fraction(datesOk, datesTotal) ?? 1);
  s.dates_unread = unread; // approval rule 1: zero in every case
  put("price_proof", fraction(priceProof[0], priceProof[1]));
  put("price_found", fraction(priceFound[0], priceFound[1]));
  put("price_kind", fraction(pk[0], pk[1]));
  put("cash_amount", fraction(cash[0], cash[1]));
  put("price_terms_literal", fraction(terms[0], terms[1]));
  put("page_name_literal", fraction(pageName[0], pageName[1]));
  put("expired_offer", expired ? 0 : 1);
  put("value_match", fraction(vm[0], vm[1]));
  s.open_questions_ok = null;
  return { scores: s, notes };
}

export function researcherTotals(cases: CaseResult[]): Record<string, number> {
  const avg = (k: string) => {
    const xs = cases.map((r) => (r.scores as unknown as ResearcherScores)[k]).filter((x): x is number => typeof x === "number");
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000 : 0;
  };
  const usd = cases.reduce((t, r) => t + r.agent_usd + r.judge_usd, 0);
  return {
    cases: cases.length,
    usd: Math.round(usd * 1e4) / 1e4,
    usd_avg: cases.length ? Math.round((usd / cases.length) * 1e4) / 1e4 : 0,
    schema_fail: cases.filter((r) => (r.scores as unknown as ResearcherScores).schema !== 1).length,
    dates_unread: cases.reduce((t, r) => t + Number((r.scores as unknown as ResearcherScores).dates_unread ?? 0), 0),
    ...Object.fromEntries(["dates", "price_proof", "price_found", "price_kind", "cash_amount", "price_terms_literal", "page_name_literal", "expired_offer", "value_match"]
      .map((k) => [`${k}_avg`, avg(k)])),
    turns_avg: cases.length ? Math.round(cases.reduce((t, r) => t + r.turns, 0) / cases.length) : 0,
  };
}

/** Decision 3, approval of a change to researcher.md (or of model). */
export function researcherCompare(base: Summary, cand: Summary, rules: Map<string, string[]>): { approved: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!base.complete || !cand.complete) reasons.push("algún experimento está incompleto");
  if (base.dataset_sha !== cand.dataset_sha) reasons.push("el dataset no es el mismo: repite la línea base");
  if ((Date.parse(cand.started) - Date.parse(base.started)) / 86_400_000 > 30) reasons.push("la línea base tiene más de 30 días: repítela");
  const sc = (r: CaseResult) => r.scores as unknown as ResearcherScores;
  for (const r of cand.cases) {
    if (sc(r).schema !== 1) reasons.push(`${r.case_id}: el validador rechaza algún fichero (schema)`);
    if (Number(sc(r).dates_unread ?? 0) > 0) reasons.push(`${r.case_id}: ${sc(r).dates_unread} fechas suben sin lectura`);
    const b = base.cases.find((x) => x.case_id === r.case_id);
    if (!b) continue;
    for (const rule of rules.get(r.case_id) ?? []) {
      const k = RULE_SCORES[rule];
      const was = sc(b)[k], now = sc(r)[k];
      if (typeof was === "number" && (typeof now !== "number" || now < was)) reasons.push(`${r.case_id}: ${k} baja: ${was} → ${now}`);
    }
  }
  const bu = base.totals.usd_avg, cu = cand.totals.usd_avg;
  if (bu > 0 && cu > bu * 1.25) reasons.push(`el coste medio sube más de un 25 %: ${bu} → ${cu} USD`);
  return { approved: reasons.length === 0, reasons };
}

// --------------------------------------------------------------------------- run

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const yamlOr = (text: () => string) => {
  try {
    return parse(text());
  } catch {
    return null;
  }
};

/** The Researcher's config for a case: no WebSearch or WebFetch (decision 2.3). */
export function offlineConfig(cfg: Config): Config {
  const a = agentConfig(cfg, "researcher");
  const web = (t: string) => /^Web(Search|Fetch)\b/.test(t);
  return {
    ...cfg,
    agents: { ...cfg.agents, researcher: { ...a, allowed_tools: (a.allowed_tools ?? []).filter((t) => !web(t)), denied_tools: [...(a.denied_tools ?? []), "WebSearch", "WebFetch"] } },
  };
}

function runCase(cfg: Config, c: ResearcherCase, model: string, apiKey: string, runId: string, writesOutside: EvalDeps["writesOutside"]) {
  const a = agentConfig(cfg, "researcher");
  const tmp = mkdtempSync(join(tmpdir(), "eval-researcher-"));
  const worktree = join(REPO, "ops", "worktrees", `eval-${createHash("sha256").update(runId).digest("hex").slice(0, 8)}`);
  git(REPO, "worktree", "add", "--detach", "-q", worktree, c.baseRefOid);
  try {
    for (const leak of ["factory/datasets", "ops/evals", "ops/datasets"]) rmSync(join(worktree, leak), { recursive: true, force: true });
    // The prompt under test is today's .claude/, not the one at the case's start commit (decision 2.1).
    rmSync(join(worktree, ".claude"), { recursive: true, force: true });
    for (const f of git(REPO, "ls-files", ".claude").split("\n").filter(Boolean)) {
      mkdirSync(dirname(join(worktree, f)), { recursive: true });
      copyFileSync(join(REPO, f), join(worktree, f));
    }
    for (const tool of ["fetch-page", "fetch-idae", "fetch-image"]) {
      const path = join(worktree, "factory", `${tool}.ts`);
      if (existsSync(path)) writeFileSync(path, replayGuard(tool, join(REPO, "factory", "fetch-replay.ts")) + readFileSync(path, "utf8"));
    }
    const replayLog = join(tmp, "replay.jsonl");
    const cmd = buildCommand(offlineConfig(cfg), "researcher", `Hoy es ${c.date}.\n\n${c.task}`);
    cmd[cmd.indexOf("--model") + 1] = model;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ANTHROPIC_API_KEY: apiKey,
      FETCH_REPLAY_DIR: join(FETCH_DATASET, c.case_id, "fetch"),
      FETCH_REPLAY_LOG: replayLog,
      FACTORY_AGENT: "researcher",
      FACTORY_RUN_ID: runId,
      FACTORY_REPO: worktree,
      FACTORY_LOG_DIR: tmp,
      FACTORY_WRITE_PATHS: JSON.stringify(a.write_paths ?? []),
      CLAUDE_CODE_SHELL: "/bin/bash",
    };
    delete env.CLAUDE_CODE_OAUTH_TOKEN; // the subscription is never used for evals
    delete env.ANTHROPIC_AUTH_TOKEN;
    const started = new Date().toISOString();
    const [bin, ...args] = cmd;
    const proc = spawnSync(bin, args, { cwd: worktree, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60_000 });
    if (proc.error) throw proc.error;
    const stdout = proc.stdout || "";
    // The replaced fetch scripts are ours, not the agent's change.
    for (const tool of ["fetch-page", "fetch-idae", "fetch-image"]) {
      try {
        git(worktree, "checkout", "--", `factory/${tool}.ts`);
      } catch { /* not in this commit */ }
    }
    const files = git(worktree, "status", "--porcelain", "-uall").split("\n").filter(Boolean).map((l) => l.slice(3)).filter((f) => f.startsWith("data/"));
    const yamls = files.filter((f) => /\.ya?ml$/.test(f));
    const base = new Map(yamls.map((f) => [f, yamlOr(() => git(REPO, "show", `${c.baseRefOid}:${f}`))]));
    const head = new Map(yamls.map((f) => [f, existsSync(join(worktree, f)) ? yamlOr(() => readFileSync(join(worktree, f), "utf8")) : null]));
    const evals = runEvals("researcher", worktree, files, a.write_paths ?? [], c.date);
    const calls: ReplayEntry[] = existsSync(replayLog) ? readFileSync(replayLog, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    return { stdout, stderr: (proc.stderr || "").slice(-500), started, ended: new Date().toISOString(), files, base, head, calls, schemaFailed: evals.failed, outside: writesOutside(stdout, worktree, a.write_paths ?? []) };
  } finally {
    try {
      git(REPO, "worktree", "remove", "--force", worktree);
    } catch {
      rmSync(worktree, { recursive: true, force: true });
    }
    rmSync(tmp, { recursive: true, force: true });
  }
}

const fail = (msg: string) => (console.error(msg), 2);

/** `eval-run.ts researcher`: same caps, lock and window as the Reviewer's experiments (ADR-0016). */
export async function main(model: string, wanted: string[] | undefined, dryRun: boolean, d: EvalDeps): Promise<number> {
  const { budgetBlocker, EVALS_DIR, estimateCase, evalsConfig, loadApiKey, readSummaries, spentInMonth } = d;
  const cfg = loadConfig();
  const ev = evalsConfig(cfg);
  if (!ev) return fail("falta el bloque evals: en factory/budgets.yaml");
  const now = nowInTz(cfg);
  const all = readResearcherCases();
  for (const c of all) {
    const p = researcherCaseProblem(c);
    if (p) console.log(`${c.case_id}: se omite (${p})`);
  }
  const cases = all.filter((c) => !researcherCaseProblem(c) && (!wanted || wanted.includes(c.case_id)));
  if (!cases.length) return fail("no hay casos confirmados que ejecutar");
  const monthUsd = spentInMonth(readSummaries(), now.day.slice(0, 7));
  console.log(`${cases.length} casos con ${model}; ~${(estimateCase(ev, model, []) * cases.length).toFixed(2)} USD estimados; ` +
    `gastado este mes ${monthUsd} / ${ev.max_usd_per_month} USD` + (cases.length < 10 ? ` · dataset de ${cases.length} casos (ADR-0026, punto 4)` : ""));
  if (dryRun) return 0;

  const apiKey = loadApiKey();
  if (!apiKey) return fail("falta .secrets/anthropic-evals.env con ANTHROPIC_API_KEY (ADR-0016)");
  const g = cfg.global ?? {};
  if (g.stop_file && existsSync(join(REPO, g.stop_file))) return fail(`existe ${g.stop_file}: la factoría está parada`);
  if (existsSync(LOCK)) return fail(`hay una ejecución en marcha (${LOCK})`);
  if (g.allowed_hours && inWindow(now, g.allowed_hours)) return fail(`estamos en el horario de la factoría (${g.allowed_hours})`);

  const promptSha = git(REPO, "hash-object", ".claude/agents/researcher.md");
  const stamp = now.iso.slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  const exp: Summary = {
    experiment: `researcher/${promptSha.slice(0, 8)}/${model}/${stamp}`,
    agent: "researcher", model, prompt_sha: promptSha,
    dataset_sha: git(REPO, "log", "-1", "--format=%H", "--", "factory/datasets/researcher"),
    judge_model: "", rubric_sha: "", // no judge yet: open_questions_ok is null
    started: now.iso, ended: null, complete: false, stopped: null, cases: [], totals: {},
  };
  const out = join(EVALS_DIR, `${exp.experiment.replaceAll("/", "__")}.json`);
  mkdirSync(EVALS_DIR, { recursive: true });
  writeFileSync(LOCK, `eval\n${exp.experiment}\n`, "utf8");
  try {
    for (const c of cases) {
      const spent = exp.cases.reduce((t, r) => t + r.agent_usd, 0);
      const blocker = budgetBlocker(ev, spent, monthUsd + spent, estimateCase(ev, model, exp.cases));
      if (blocker) {
        exp.stopped = blocker;
        break;
      }
      const run = runCase(cfg, c, model, apiKey, `${exp.experiment}/${c.case_id}`, d.writesOutside);
      const result = resultEvent(run.stdout);
      const { scores, notes } = researcherScores(c, run.base, run.head, run.calls, run.schemaFailed);
      if (run.outside.length) notes.push(`escribió fuera de write_paths: ${run.outside.join(", ")}`);
      if (run.stderr && !result.total_cost_usd) notes.push(run.stderr);
      exp.cases.push({
        case_id: c.case_id, pr: c.pr, expected_label: "", labels: [],
        scores: scores as unknown as CaseResult["scores"],
        agent_usd: Math.round(Number(result.total_cost_usd || 0) * 1e4) / 1e4, judge_usd: 0,
        turns: Math.trunc(Number(result.num_turns || 0)), units: 0, notes,
        comment: String(result.result ?? "").slice(-2000),
      });
      exp.totals = researcherTotals(exp.cases);
      writeFileSync(out, JSON.stringify(exp, null, 2) + "\n"); // after every case: a crash keeps what was paid for
      console.log(`${c.case_id}: schema ${scores.schema} · fechas ${scores.dates} (${scores.dates_unread} sin lectura) · ` +
        `${exp.cases.at(-1)!.agent_usd.toFixed(3)} USD · ${exp.cases.at(-1)!.turns} turnos`);
    }
    exp.complete = exp.cases.length === cases.length;
  } finally {
    rmSync(LOCK, { force: true });
    exp.ended = nowInTz(cfg).iso;
    exp.totals = researcherTotals(exp.cases);
    writeFileSync(out, JSON.stringify(exp, null, 2) + "\n");
  }
  console.log(`${exp.complete ? "completo" : `incompleto: ${exp.stopped ?? "cortado"}`} → ${relative(REPO, out)}`);
  console.log(JSON.stringify(exp.totals));
  return exp.complete ? 0 : 1;
}
