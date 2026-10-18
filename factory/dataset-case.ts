/**
 * Freezes a closed PR that the Reviewer reviewed into an eval case (ADR-0016, decisions 1 and 2).
 *
 *   node factory/dataset-case.ts <pr> [<pr>...]
 *
 * Writes factory/datasets/reviewer/pr-NNNN/ with:
 *   case.yaml    expected result, PROPOSED and `confirmed: false` until a person checks it
 *   pr.json      the PR as `gh pr view` showed it at the reviewed SHA, without review:* labels
 *                and without the factory's 🏭 comments (the fake gh serves this)
 *   diff.patch   diff from the merge base to the reviewed SHA
 *   issue.json   the story it closes, with the comments it had at review time (if any)
 *   review.md    the Reviewer's comment, only for the person who labels the case; never served
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import { REPO } from "./orchestrator.ts";

export const DATASET_DIR = join(REPO, "factory", "datasets", "reviewer");
const LABELS = ["review:ok", "review:changes", "review:needs-human", "review:error"];

const run = (bin: string, args: string[]) =>
  execFileSync(bin, args, { cwd: REPO, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const gh = (...args: string[]) => run("gh", args);
const git = (...args: string[]) => run("git", args).trim();

export const VERDICT = /^\s*🏭 Veredicto:/;
const SHA = /SHA(?: revisado)?:?\s*`?([0-9a-f]{7,40})/i;
const WAITS = /^\s*🏭 Espera a una persona/;

/** The SHA the last verdict says it reviewed. */
export function reviewedSha(comments: { body: string }[]): string | null {
  const last = comments.filter((c) => VERDICT.test(c.body)).at(-1);
  return last?.body.match(SHA)?.[1] ?? null;
}

/**
 * The label the Reviewer most likely left. review:needs-human next to review:ok is usually the
 * auto-merge guard (ADR-0011, a «🏭 Espera a una persona» comment), not the Reviewer.
 */
export function proposedLabel(labels: string[], comments: { body: string }[]): string | null {
  const review = LABELS.filter((l) => labels.includes(l));
  if (review.includes("review:ok") && comments.some((c) => WAITS.test(c.body))) return "review:ok";
  return review[0] ?? null;
}

/** The story the PR closes: «Closes #N» first, then «Historia #N». */
export function storyNumber(title: string, body: string): number | null {
  const m = body.match(/\b(?:closes|fixes|resolves)\s+#(\d+)/i) ?? `${title}\n${body}`.match(/Historia #(\d+)/i);
  return m ? Number(m[1]) : null;
}

const before = (iso: string) => (c: { createdAt?: string }) => !c.createdAt || c.createdAt < iso;

function snapshot(n: number): string {
  const fields = "number,title,body,state,headRefName,baseRefName,author,createdAt,url,labels,comments,mergeCommit";
  const pr = JSON.parse(gh("pr", "view", String(n), "--json", fields));
  if (pr.state === "OPEN") return `#${n}: sigue abierta; solo se congelan PR cerradas`;
  const sha0 = reviewedSha(pr.comments);
  if (!sha0) return `#${n}: no tiene ningún comentario «🏭 Veredicto:» con su SHA`;
  const verdict = pr.comments.filter((c: { body: string }) => VERDICT.test(c.body)).at(-1);

  // The reviewed commit may only live in the PR ref (branch deleted, or rebased since).
  git("fetch", "-q", "origin", `pull/${n}/head`);
  let sha: string;
  try {
    sha = git("rev-parse", `${sha0}^{commit}`);
  } catch {
    git("fetch", "-q", "origin", sha0);
    sha = git("rev-parse", `${sha0}^{commit}`);
  }
  // A merged PR is already in main: its base is main just before the merge, not main today
  const base = git("merge-base", pr.mergeCommit?.oid ? `${pr.mergeCommit.oid}^1` : "origin/main", sha);
  const diff = run("git", ["diff", "--no-color", base, sha]);
  const files = git("diff", "--numstat", base, sha).split("\n").filter(Boolean).map((l) => {
    const [a, d, path] = l.split("\t");
    return { path, additions: Number(a) || 0, deletions: Number(d) || 0 };
  });
  const [owner, repo] = new URL(pr.url).pathname.slice(1).split("/");
  const runs = JSON.parse(gh("api", `repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=100`)).check_runs ?? [];
  const rollup = runs.map((r: Record<string, any>) => ({
    __typename: "CheckRun", name: r.name, status: String(r.status).toUpperCase(),
    conclusion: r.conclusion ? String(r.conclusion).toUpperCase() : "", detailsUrl: r.html_url,
    startedAt: r.started_at, completedAt: r.completed_at,
  }));

  const at = verdict.createdAt as string;
  const human = pr.comments.filter((c: { body: string }) => !c.body.trimStart().startsWith("🏭")).filter(before(at));
  const frozen = {
    number: pr.number, title: pr.title, body: pr.body, state: "OPEN", isDraft: false,
    headRefName: pr.headRefName, baseRefName: pr.baseRefName, headRefOid: sha, baseRefOid: base,
    author: pr.author, createdAt: pr.createdAt, url: pr.url, labels: [], comments: human, files,
    additions: files.reduce((s, f) => s + f.additions, 0), deletions: files.reduce((s, f) => s + f.deletions, 0),
    changedFiles: files.length, statusCheckRollup: rollup, mergeable: "MERGEABLE",
  };

  const story = storyNumber(pr.title, pr.body ?? "");
  let issue: Record<string, any> | null = null;
  if (story) {
    issue = JSON.parse(gh("issue", "view", String(story), "--json", "number,title,body,state,labels,author,comments,url"));
    issue!.state = "OPEN";
    issue!.comments = issue!.comments.filter(before(at));
  }
  const ca = [...new Set(String(issue?.body ?? "").match(/\bCA-\d+\b/g) ?? [])];

  const id = `pr-${String(n).padStart(4, "0")}`;
  const dir = join(DATASET_DIR, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "pr.json"), JSON.stringify(frozen, null, 2) + "\n");
  writeFileSync(join(dir, "diff.patch"), diff);
  if (issue) writeFileSync(join(dir, "issue.json"), JSON.stringify(issue, null, 2) + "\n");
  writeFileSync(join(dir, "review.md"), verdict.body + "\n");
  const doc = {
    case_id: id, pr: n, reviewed_sha: sha, base_sha: base, issue: story, synthetic: false,
    // A person confirms the expected result and sets this to true; only confirmed cases are used.
    confirmed: false,
    proposed: `label = the one left on the PR (${pr.labels.map((l: { name: string }) => l.name).join(", ") || "none"}); findings and ca to fill in`,
    expected: {
      label: proposedLabel(pr.labels.map((l: { name: string }) => l.name), pr.comments),
      findings: [] as string[],
      ca: ca.map((caId) => ({ id: caId, covered: null })),
      not_findings: [] as string[],
    },
  };
  const casePath = join(dir, "case.yaml");
  if (!files.length) return `#${n}: el diff sale vacío (base ${base.slice(0, 7)}); revísalo a mano`;
  if (existsSync(casePath)) return `#${n}: ${id} ya existe; se actualiza la instantánea, no case.yaml`;
  writeFileSync(casePath, stringify(doc, { lineWidth: 0 }));
  return `#${n}: ${id} creado (${files.length} ficheros, etiqueta propuesta ${doc.expected.label ?? "ninguna"})`;
}

if (import.meta.main) {
  const prs = process.argv.slice(2).map(Number).filter(Boolean);
  if (!prs.length) {
    console.error("uso: node factory/dataset-case.ts <pr> [<pr>...]");
    process.exitCode = 2;
  }
  for (const n of prs) {
    try {
      console.log(snapshot(n));
    } catch (e) {
      console.log(`#${n}: no se pudo congelar (${(e as Error).message.split("\n")[0]})`);
      process.exitCode = 1;
    }
  }
}
