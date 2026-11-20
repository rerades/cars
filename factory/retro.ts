/**
 * The retro agent's trigger (ADR-0022, "Agente retro"; ADR-0026, point 6): code without a model.
 * Once a week it counts the signals since the last good retro (failed runs, review:changes labels
 * and escaped defects) and, with 3 or more, builds a task that lists them, so the model does not
 * search for them. The CLI is `node factory/run.ts --retro`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO, STATE_DIR, TRACE_DIR, type Row } from "./orchestrator.ts";

export const RETRO = "retro";
export const MIN_SIGNALS = 3;
export const TRUST_DIR = join(STATE_DIR, "ops", "trust");
export const DATASETS_DIR = join(REPO, "factory", "datasets");
const DAY_MS = 24 * 3600 * 1000;
// ADR-0022 says "less than 7 days"; launchd fires at the same time every week, so the previous run
// started a few seconds after its fire and exactly 7 days would skip every other week.
const MIN_GAP_MS = 7 * DAY_MS - 12 * 3600 * 1000;

export type Signal =
  | { kind: "fallo"; at: string; agent: string; run_id: string; outcome: string; pr: string | null }
  | { kind: "review:changes"; at: string; agent: string; run_id: string; pr: string }
  | { kind: "defecto escapado"; at: string; agent: string; pr: string; evidence: string };

/** An agent/* PR with the review:changes labels it received (from labeledPrs). */
export interface LabeledPr {
  url: string;
  headRefName: string;
  labeled: string[]; // createdAt of each labeled review:changes event
}

/** A line of ops/trust/*.jsonl (ADR-0022, "Escalera — los eventos"); only what the retro reads. */
export interface TrustEvent {
  type?: string;
  at?: string;
  agent?: string;
  pr?: number;
  reason?: string;
  evidence?: string;
}

const time = (s: unknown) => Date.parse(String(s ?? ""));

/** Why the retro does not run now, or null (ADR-0022, step 1). */
export function retroBlocker(rows: Row[], now: Date, stopped: boolean): string | null {
  if (stopped) return "interruptor de parada activo";
  const last = Math.max(...rows.filter((r) => r.agent === RETRO).map((r) => time(r.started)).filter(Number.isFinite));
  if (now.getTime() - last < MIN_GAP_MS) return `el retro ya corrió el ${new Date(last).toISOString().slice(0, 10)}, hace menos de 7 días`;
  return null;
}

/** Start of the period: the last retro run that succeeded, or 7 days ago (step 2). */
export function retroSince(rows: Row[], now: Date): Date {
  const last = Math.max(...rows.filter((r) => r.agent === RETRO && r.outcome === "success").map((r) => time(r.started)).filter(Number.isFinite));
  return new Date(Number.isFinite(last) ? last : now.getTime() - 7 * DAY_MS);
}

/** The signals since `since` (step 3): one per failed run, per review:changes label, per escaped defect. */
export function retroSignals(rows: Row[], prs: LabeledPr[], trust: TrustEvent[], since: Date): Signal[] {
  const after = (s: unknown) => time(s) >= since.getTime();
  const out: Signal[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = String(r.run_id ?? "");
    if (r.agent === RETRO || r.outcome === "success" || !after(r.started) || seen.has(id)) continue;
    seen.add(id);
    out.push({ kind: "fallo", at: String(r.started), agent: String(r.agent), run_id: id, outcome: String(r.outcome), pr: (r.pr as string | null) ?? null });
  }
  for (const pr of prs) {
    const m = pr.headRefName.match(/^agent\/([^/]+)\/([^/]+)$/);
    if (!m) continue;
    for (const at of pr.labeled.filter(after)) out.push({ kind: "review:changes", at, agent: m[1], run_id: m[2], pr: pr.url });
  }
  for (const e of trust) {
    if (e.type !== "unclean" || e.reason !== "escaped defect" || !after(e.at)) continue;
    out.push({ kind: "defecto escapado", at: String(e.at), agent: String(e.agent), pr: `#${e.pr}`, evidence: String(e.evidence ?? "") });
  }
  return out.sort((a, b) => time(a.at) - time(b.at));
}

/** The agents with a dataset in factory/datasets/ (ADR-0026, point 6: listed, not a constant). */
export function datasetAgents(dir = DATASETS_DIR): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

/** Every event of ops/trust/*.jsonl; none until the trust ladder exists. */
export function readTrust(dir = TRUST_DIR): TrustEvent[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".jsonl")).flatMap((f) =>
    readFileSync(join(dir, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as TrustEvent));
}

/**
 * The agent/* PRs updated since `since`, with the times they got review:changes. One GraphQL call.
 * ponytail: the 100 PRs updated last; a week has had ~60, page through it if that ever falls short.
 */
export function labeledPrs(since: Date, repo = REPO): LabeledPr[] {
  const query = `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) {
    pullRequests(first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) { nodes { url headRefName updatedAt
      timelineItems(itemTypes: [LABELED_EVENT], last: 100) { nodes { ... on LabeledEvent { createdAt label { name } } } } } } } }`;
  const out = execFileSync("gh", ["api", "graphql", "-f", `query=${query}`, "-F", "owner={owner}", "-F", "name={repo}"],
    { cwd: repo, encoding: "utf8" });
  type Node = { url: string; headRefName: string; updatedAt: string; timelineItems: { nodes: { createdAt: string; label: { name: string } }[] } };
  const nodes = (JSON.parse(out) as { data: { repository: { pullRequests: { nodes: Node[] } } } }).data.repository.pullRequests.nodes;
  return nodes.filter((n) => n.headRefName.startsWith("agent/") && time(n.updatedAt) >= since.getTime()).map((n) => ({
    url: n.url,
    headRefName: n.headRefName,
    labeled: n.timelineItems.nodes.filter((e) => e.label?.name === "review:changes").map((e) => e.createdAt),
  }));
}

/** The generated task (step 4): each signal with its run_id, PR and trace, and what it may propose on. */
export function retroTask(signals: Signal[], datasets: string[], since: Date, today: string, traceDir = TRACE_DIR): string {
  const trace = (runId: string) => {
    const path = join(traceDir, `${runId}.jsonl`);
    return existsSync(path) ? path : "sin traza";
  };
  const lines = signals.map((s) => {
    if (s.kind === "fallo") return `- fallo · ${s.agent} · run ${s.run_id} (${s.outcome}) · ${s.pr ?? "sin PR"} · traza: ${trace(s.run_id)}`;
    if (s.kind === "review:changes") return `- review:changes · ${s.agent} · ${s.pr} (${s.at}) · run ${s.run_id} · traza: ${trace(s.run_id)}`;
    return `- defecto escapado · ${s.agent} · ${s.pr} · ${s.evidence}`;
  });
  return [
    `Retro de la semana: ${signals.length} señales desde ${since.toISOString()} (ADR-0022, «Agente retro»).`,
    `Deja tu propuesta en docs/bitacora/retro/${today}.md, como dice tu definición.`,
    ``,
    `Agentes con dataset en factory/datasets/: ${datasets.join(", ") || "ninguno"}. Solo puedes proponer diff a sus ` +
      `prompts (.claude/agents/<agente>.md); las señales de los demás se describen sin diff (ADR-0026, punto 6).`,
    ``,
    `Señales:`,
    ...lines,
  ].join("\n");
}
