/**
 * The trust ladder of ADR-0022 ("Escalera — los eventos"), events and state only: run.ts --merge
 * evaluates the agent PRs merged 7 to 37 days ago that touch an area of `trust.areas`, writes one
 * clean or unclean event per PR and area, and the up and down that follow, in
 * ops/trust/YYYY-MM.jsonl of the state branch (ADR-0013). Code without a model.
 *
 * ponytail: the merge with a rung (ADR-0022, enmienda de ADR-0011, punto 2) is not here: it needs the
 * gate of ADR-0019, which does not exist yet, so a level 1 merges nothing for now (decision of
 * 2026-11-21). The events feed --status and the retro's escaped defects. Also missing: the down for a
 * revert merged more than 7 days after its PR (ADR-0022, "Bajada"); one within 7 days is an escaped
 * defect and does write its down.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MERGES_DIR } from "./merge.ts";
import { REPO, STATE_DIR, type Config } from "./orchestrator.ts";

export const TRUST_DIR = join(STATE_DIR, "ops", "trust");
/** CA-12: never merged alone, so never an area of the ladder. */
export const NEVER_ALONE = ["factory/", ".claude/", ".github/", "docs/architecture/adr/"];
export const STREAK = 5;
const DAY_MS = 24 * 3600 * 1000;
const WAIT_DAYS = 7; // ADR-0019: before that the PR is "pending", not clean
const MARGIN_DAYS = 30; // nights the pass did not run are caught up

export interface TrustEvent {
  id: string;
  at: string;
  type: "clean" | "unclean" | "up" | "down";
  agent: string;
  area: string;
  pr: number;
  level?: number;
  merged_at?: string;
  merged_by?: "factory" | "human";
  reason: string;
  evidence?: string;
}

/** What the pass knows about a merged agent PR (gathered with gh and git, or written by a test). */
export interface MergedPr {
  number: number;
  agent: string;
  mergedAt: string;
  files: string[];
  mergedBy: "factory" | "human";
  /** createdAt of each labeled review:changes event. */
  changesLabels: string[];
  /** A CI run of its branch that ended in failure, or null. */
  redCi: string | null;
  /** A revert or a fix PR that cites it within 7 days (ADR-0019), or null. */
  escaped: string | null;
  /** Non-merge commits authored after the PR was opened: a person helped (decision of 2026-10-30). The
   *  author date, not the committer one: a rebase of the agent's own commits keeps it. */
  humanCommits: string[];
}

/** trust.areas of budgets.yaml, without the CA-12 paths: the code refuses them when it reads the list. */
export function trustAreas(cfg: Config): string[] {
  const areas = ((cfg as Config & { trust?: { areas?: unknown } }).trust?.areas ?? []) as unknown[];
  return areas.map(String).filter((a) => a.endsWith("/") && !NEVER_ALONE.some((p) => a.startsWith(p) || p.startsWith(a)));
}

export function readTrust(dir = TRUST_DIR): TrustEvent[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().flatMap((f) =>
    readFileSync(join(dir, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as TrustEvent))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** Level and clean streak of every (agent, area), rebuilt from the events in order. */
export function trustState(events: TrustEvent[]): Map<string, { agent: string; area: string; level: number; streak: number }> {
  const out = new Map<string, { agent: string; area: string; level: number; streak: number }>();
  for (const e of events) {
    const k = `${e.agent}|${e.area}`;
    const s = out.get(k) ?? { agent: e.agent, area: e.area, level: 0, streak: 0 };
    if (e.type === "clean") s.streak++;
    else if (e.type === "unclean") s.streak = 0;
    else {
      s.level = e.type === "up" ? 1 : Math.max(0, s.level - 1);
      s.streak = 0;
    }
    out.set(k, s);
  }
  return out;
}

/** Why the PR is unclean, in the ADR's order, with the other causes as evidence; or clean. */
export function classify(pr: MergedPr): { type: "clean" | "unclean"; reason: string; evidence?: string } {
  const causes: [string, string][] = [];
  if (pr.changesLabels.length) causes.push(["review:changes", `labeled ${pr.changesLabels[0]}`]);
  if (pr.redCi) causes.push(["red CI", pr.redCi]);
  if (pr.escaped) causes.push(["escaped defect", pr.escaped]);
  if (pr.mergedBy === "human" && pr.humanCommits.length) causes.push(["human commits", pr.humanCommits.join(" ")]);
  if (!causes.length) return { type: "clean", reason: `${WAIT_DAYS} days without review:changes, red CI or escaped defect` };
  return { type: "unclean", reason: causes[0][0], evidence: causes.map(([r, e]) => `${r}: ${e}`).join("; ") };
}

/**
 * The events a pass writes for these PRs (oldest merge first), given those already written: a
 * clean/unclean per area the PR touches, an `up` after STREAK cleans at level 0, a `down` after an
 * escaped defect. Ids make it idempotent, so the pass can be run by hand.
 */
export function nextEvents(prs: MergedPr[], areas: string[], existing: TrustEvent[], at: string): TrustEvent[] {
  const ids = new Set(existing.map((e) => e.id));
  const all = [...existing];
  const out: TrustEvent[] = [];
  const push = (e: TrustEvent) => {
    if (ids.has(e.id)) return;
    ids.add(e.id);
    all.push(e);
    out.push(e);
  };
  for (const pr of [...prs].sort((a, b) => Date.parse(a.mergedAt) - Date.parse(b.mergedAt))) {
    for (const area of areas.filter((a) => pr.files.some((f) => f.startsWith(a)))) {
      const base = { at, agent: pr.agent, area, pr: pr.number };
      const c = classify(pr);
      push({ id: `${c.type}:${area}:${pr.number}`, ...base, type: c.type, merged_at: pr.mergedAt, merged_by: pr.mergedBy, reason: c.reason, ...(c.evidence ? { evidence: c.evidence } : {}) });
      const s = trustState(all).get(`${pr.agent}|${area}`)!;
      if (c.type === "clean" && s.level === 0 && s.streak >= STREAK) {
        const streak = all.filter((e) => e.agent === pr.agent && e.area === area && e.type === "clean").slice(-STREAK).map((e) => `#${e.pr}`);
        push({ id: `up:${area}:${pr.number}`, ...base, type: "up", level: 1, reason: `${STREAK} clean merges in a row: ${streak.join(" ")}` });
      }
      if (c.reason === "escaped defect") {
        push({ id: `down:${area}:${pr.number}`, ...base, type: "down", level: Math.max(0, s.level - 1), reason: "escaped defect", evidence: pr.escaped ?? undefined });
      }
    }
  }
  return out;
}

/** Appends the events to ops/trust/<month of at>.jsonl in the state worktree. */
export function writeTrust(events: TrustEvent[], dir = TRUST_DIR): void {
  if (!events.length) return;
  mkdirSync(dir, { recursive: true });
  for (const e of events) appendFileSync(join(dir, `${e.at.slice(0, 7)}.jsonl`), JSON.stringify(e) + "\n", "utf8");
}

// --------------------------------------------------------------------------- gathering

const gh = (args: string[], repo: string) => execFileSync("gh", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

interface ListedPr {
  number: number;
  url: string;
  title: string;
  body: string;
  headRefName: string;
  createdAt: string;
  mergedAt: string;
}
interface PrDetail {
  files: { path: string }[];
  commits: { oid: string; authoredDate: string; messageHeadline: string }[];
}

/** PR numbers in ops/merges/: the ones the factory merged by itself. */
function factoryMerged(dir = MERGES_DIR): Set<number> {
  if (!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir).filter((f) => f.endsWith(".jsonl")).flatMap((f) =>
    readFileSync(join(dir, f), "utf8").split("\n").filter(Boolean).map((l) => Number(JSON.parse(l).pr))));
}

/** A revert or a fix PR merged within 7 days of `pr` that cites it (ADR-0019), as evidence, or null. */
export function escapedBy(pr: { number: number; url: string; mergedAt: string }, merged: { number: number; title: string; body: string; mergedAt: string }[]): string | null {
  const t = Date.parse(pr.mergedAt);
  const cites = new RegExp(`#${pr.number}(?!\\d)|${pr.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`);
  const hit = merged.find((m) => m.number !== pr.number && Date.parse(m.mergedAt) > t && Date.parse(m.mergedAt) <= t + WAIT_DAYS * DAY_MS &&
    (/^Revert "/.test(m.title) || /^fix\b/.test(m.title)) && cites.test(`${m.title}\n${m.body}`));
  return hit ? `#${hit.number} ${hit.title}` : null;
}

/**
 * The merged agent/* PRs to evaluate now, with what classify needs. A light list of every merged PR
 * (also the fixes and reverts that may cite them), then files, commits, labels and CI per candidate.
 */
export function gatherMerged(now: Date, areas: string[], repo = REPO): MergedPr[] {
  const since = now.getTime() - (WAIT_DAYS + MARGIN_DAYS) * DAY_MS;
  const merged = JSON.parse(gh(["pr", "list", "--state", "merged", "--limit", "500", "--search", `merged:>=${isoDay(since)}`,
    "--json", "number,url,title,body,headRefName,createdAt,mergedAt"], repo)) as ListedPr[];
  const byFactory = factoryMerged();
  const due = merged.filter((p) => /^agent\/[^/]+\/[^/]+$/.test(p.headRefName) &&
    Date.parse(p.mergedAt) <= now.getTime() - WAIT_DAYS * DAY_MS && Date.parse(p.mergedAt) >= since)
    .map((p) => ({ ...p, ...(JSON.parse(gh(["pr", "view", String(p.number), "--json", "files,commits"], repo)) as PrDetail) }));
  return due.filter((p) => areas.some((a) => p.files.some((f) => f.path.startsWith(a)))).map((p) => {
    const labels = JSON.parse(gh(["api", `repos/{owner}/{repo}/issues/${p.number}/events`, "--paginate", "--jq",
      '[.[] | select(.event == "labeled" and .label.name == "review:changes") | .created_at]'], repo) || "[]") as string[];
    const runs = JSON.parse(gh(["run", "list", "--branch", p.headRefName, "--limit", "50", "--json", "conclusion,url"], repo)) as { conclusion: string; url: string }[];
    const red = runs.find((r) => r.conclusion === "failure");
    return {
      number: p.number,
      agent: p.headRefName.split("/")[1],
      mergedAt: p.mergedAt,
      files: p.files.map((f) => f.path),
      mergedBy: byFactory.has(p.number) ? "factory" : "human",
      changesLabels: labels.flat(),
      redCi: red ? red.url : null,
      escaped: escapedBy(p, merged),
      humanCommits: p.commits.filter((c) => Date.parse(c.authoredDate) > Date.parse(p.createdAt) &&
        !/^Merge (main|branch|remote-tracking branch|pull request)\b/i.test(c.messageHeadline)).map((c) => c.oid.slice(0, 7)),
    };
  });
}

/** One pass: evaluate, write the new events, and say what changed. Never throws: a gh failure waits for the next night. */
export function trustPass(cfg: Config, now = new Date(), dryRun = false): { log: string[]; recorded: boolean } {
  const areas = trustAreas(cfg);
  if (!areas.length) return { log: [], recorded: false };
  try {
    const events = nextEvents(gatherMerged(now, areas), areas, readTrust(), now.toISOString());
    const log = events.map((e) => `escalera: ${e.type} ${e.agent} ${e.area} #${e.pr}${e.level !== undefined ? ` → nivel ${e.level}` : ""} (${e.reason})`);
    if (!dryRun) writeTrust(events);
    return { log, recorded: !dryRun && events.length > 0 };
  } catch (e) {
    return { log: [`escalera: sin evaluar esta pasada (${(e as Error).message.split("\n")[0]})`], recorded: false };
  }
}
