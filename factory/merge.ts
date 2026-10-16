/**
 * Auto-merge of agent PRs (ADR-0011): code without a model. The Reviewer only labels; this pass
 * merges the agent/* PRs that meet every rule of point 2 and flags the rest for a person (point 4).
 * The CLI is `node factory/run.ts --merge`.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { notify, REPO, STATE_DIR } from "./orchestrator.ts";

export const AGENT_BRANCH = /^agent\/([^/]+)\/([^/]+)$/;
export const ALLOWED_PATHS = ["data/raw/", "data/images/", "data/sources/", "docs/bitacora/"];
export const MERGES_DIR = join(STATE_DIR, "ops", "merges");
const VERDICT = "🏭 Veredicto";
const NEEDS_HUMAN = "review:needs-human";
const PREVIEW = "render-preview";
const NIGHT_MS = 24 * 3600 * 1000;

/** The fields of `gh pr list --json` that the rule looks at. */
export interface AgentPr {
  number: number;
  url: string;
  headRefName: string;
  headRefOid: string;
  mergeable: string;
  createdAt: string;
  labels: { name: string }[];
  statusCheckRollup: { name?: string; status?: string; conclusion?: string }[];
  files: { path: string; changeType: string }[];
  comments: { body: string }[];
}

/**
 * Why the PR cannot be merged by the factory, or null when it can (ADR-0011, point 2).
 * `cited` holds the data/images/ files that a data/raw/ YAML cites at the PR head; `sources` maps
 * each data/sources/ file of the PR to newSourceBlocker or changedSourceBlocker (amendments of
 * 2026-10-15).
 */
export function agentMergeBlocker(
  pr: AgentPr, cited: Set<string>, stopped: boolean, sources = new Map<string, string | null>(),
): string | null {
  if (stopped) return "interruptor de parada activo";
  if (!AGENT_BRANCH.test(pr.headRefName)) return "la rama no es agent/<agente>/<run_id>";
  const labels = new Set(pr.labels.map((l) => l.name));
  if (labels.has(NEEDS_HUMAN)) return `tiene ${NEEDS_HUMAN}`;
  if (!labels.has("review:ok")) return "no tiene review:ok";
  const verdict = pr.comments.filter((c) => c.body.trimStart().startsWith(VERDICT)).at(-1);
  if (!verdict) return "no hay comentario de veredicto del Revisor";
  if (!verdict.body.includes(pr.headRefOid)) {
    return `el último veredicto no cita la cabeza ${pr.headRefOid.slice(0, 7)}: hubo commits después de la revisión`;
  }
  // UNKNOWN is GitHub still computing it; the merge itself refuses conflicts.
  if (pr.mergeable === "CONFLICTING") return "tiene conflictos con main";
  if (!pr.statusCheckRollup.length) return "la CI no ha dado resultado";
  const ok = ["SUCCESS", "SKIPPED", "NEUTRAL"];
  if (pr.statusCheckRollup.some((c) => c.status !== "COMPLETED" || !ok.includes(c.conclusion ?? ""))) {
    return "la CI no ha terminado en verde";
  }
  if (!pr.files.length) return "no cambia nada";
  for (const f of pr.files) {
    if (f.changeType === "DELETED") return `borra ${f.path}: un borrado lo decide una persona`;
    // gh gives only the new path of a rename; the old one disappears, which is a deletion too.
    if (f.changeType === "RENAMED" || f.changeType === "COPIED") return `renombra o copia ${f.path}`;
    if (!ALLOWED_PATHS.some((p) => f.path.startsWith(p))) return `toca ${f.path}, fuera de ${ALLOWED_PATHS.join(", ")}`;
    if (f.path.startsWith("data/images/") && !cited.has(f.path)) return `${f.path} no lo cita ningún YAML de data/raw/`;
    if (f.path.startsWith("data/sources/")) {
      const problem = sources.has(f.path) ? sources.get(f.path) : "no se ha comprobado";
      if (problem) return `${f.path}: ${problem}`;
    }
  }
  return null;
}

const git = (args: string[], repo: string) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });
const gh = (args: string[], repo: string) => execFileSync("gh", args, { cwd: repo, encoding: "utf8" }).trim();

/** Every data/raw/ YAML at that commit, parsed. An unreadable one is skipped; the CI reports it. */
function rawYamls(sha: string, repo: string): unknown[] {
  const files = git(["ls-tree", "-r", "--name-only", sha, "--", "data/raw"], repo).split("\n");
  return files.filter((f) => /\.ya?ml$/.test(f)).flatMap((f) => {
    try {
      return [parse(git(["show", `${sha}:${f}`], repo))];
    } catch {
      return [];
    }
  });
}

/** The data/images/ files cited by the `images` of any data/raw/ YAML at that commit. */
export function citedImages(sha: string, repo = REPO): Set<string> {
  const cited = new Set<string>();
  for (const doc of rawYamls(sha, repo)) {
    const images = (doc as { images?: unknown } | null)?.images;
    for (const img of Array.isArray(images) ? images : []) if (img?.file) cited.add(String(img.file));
  }
  return cited;
}

/** Every source_id, at any depth, of the data/raw/ YAMLs at that commit. */
export function citedSources(sha: string, repo = REPO): Set<string> {
  const ids = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) k === "source_id" && x ? ids.add(String(x)) : walk(x);
    }
  };
  rawYamls(sha, repo).forEach(walk);
  return ids;
}

/**
 * Why a new data/sources/ file cannot enter without a person, or null (amendment of 2026-10-15):
 * an official T1 source of a brand from data/candidatas.yaml, cited by data/raw/, with no image
 * license, and every URL on the host of that brand's web_es or one of its subdomains.
 */
export function newSourceBlocker(source: unknown, cited: Set<string>, candidates: unknown): string | null {
  const s = (source ?? {}) as { id?: unknown; brand?: unknown; tier?: unknown; image_license?: unknown; urls?: unknown };
  if (s.tier !== "T1") return "una fuente nueva que no es T1 la decide una persona";
  if (s.image_license) return "trae image_license: los términos de uso de imágenes los lee una persona";
  if (!cited.has(String(s.id))) return "ningún YAML de data/raw/ la cita";
  const list = (candidates as { candidates?: { brand?: unknown; web_es?: unknown }[] } | null)?.candidates;
  const key = (b: unknown) => String(b ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const webEs = (Array.isArray(list) ? list : []).find((c) => key(c?.brand) === key(s.brand))?.web_es;
  if (!webEs) return `la marca ${s.brand} no tiene web_es en data/candidatas.yaml`;
  // ponytail: host match only, not path; porsche.com/spain also admits porsche.com/germany.
  const base = new URL(String(webEs)).hostname.replace(/^www\./, "");
  const urls = s.urls && typeof s.urls === "object" ? Object.values(s.urls) : [];
  if (!urls.length) return "no tiene urls";
  for (const u of urls) {
    let host: string;
    try {
      host = new URL(String(u)).hostname;
    } catch {
      return `url no válida: ${u}`;
    }
    if (host !== base && !host.endsWith(`.${base}`)) return `${u} no está en ${base}, la web_es de data/candidatas.yaml`;
  }
  return null;
}

/**
 * Why a change to an existing data/sources/ file cannot enter without a person, or null (second
 * amendment of 2026-10-15): it only adds URLs on a host the source already had, and may update
 * notes and last_verified. Nothing else changes, and no URL is removed or rewritten.
 */
export function changedSourceBlocker(before: unknown, after: unknown): string | null {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const free = new Set(["urls", "notes", "last_verified"]);
  for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (!free.has(k) && JSON.stringify(b[k]) !== JSON.stringify(a[k])) return `cambia ${k}`;
  }
  const map = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const oldUrls = map(b.urls);
  const newUrls = map(a.urls);
  const hosts = new Set<string>();
  for (const [k, u] of Object.entries(oldUrls)) {
    if (newUrls[k] !== u) return `borra o cambia la url ${k}`;
    try {
      hosts.add(new URL(String(u)).hostname);
    } catch {
      // an old URL that does not parse adds no host
    }
  }
  for (const [k, u] of Object.entries(newUrls)) {
    if (k in oldUrls) continue;
    let host: string;
    try {
      host = new URL(String(u)).hostname;
    } catch {
      return `url no válida: ${u}`;
    }
    if (!hosts.has(host)) return `${u} está en un host que la fuente no tenía`;
  }
  return null;
}

/** newSourceBlocker or changedSourceBlocker for each data/sources/ file of the PR. */
function sourceProblems(pr: AgentPr, repo: string): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const files = pr.files.filter((f) => f.path.startsWith("data/sources/") && ["ADDED", "MODIFIED"].includes(f.changeType));
  if (!files.length) return out;
  const cited = citedSources(pr.headRefOid, repo);
  const candidates = parse(git(["show", `${pr.headRefOid}:data/candidatas.yaml`], repo));
  git(["fetch", "-q", "origin", "main"], repo);
  const base = git(["merge-base", pr.headRefOid, "FETCH_HEAD"], repo).trim();
  const at = (sha: string, path: string) => parse(git(["show", `${sha}:${path}`], repo));
  for (const f of files) {
    try {
      out.set(f.path, f.changeType === "ADDED"
        ? newSourceBlocker(at(pr.headRefOid, f.path), cited, candidates)
        : changedSourceBlocker(at(base, f.path), at(pr.headRefOid, f.path)));
    } catch (e) {
      out.set(f.path, `no se puede leer: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  return out;
}

export interface MergeOptions {
  autoMerge: boolean;
  stopped: boolean;
  dryRun: boolean;
  month: string;
  now?: Date;
  repo?: string;
}

/**
 * One pass over the open agent/* PRs: merges the ones agentMergeBlocker allows (when autoMerge is
 * on) and flags for a person the ones with review:ok that fail a rule, or without a verdict after
 * a night (point 4). Returns the log lines and whether it wrote merge rows. Each PR fails alone.
 */
export function mergePass(o: MergeOptions): { log: string[]; recorded: boolean } {
  const repo = o.repo ?? REPO;
  const now = o.now ?? new Date();
  const log: string[] = [];
  let recorded = false;
  const prs = (JSON.parse(gh(["pr", "list", "--state", "open", "--limit", "100", "--json",
    "number,url,headRefName,headRefOid,mergeable,createdAt,labels,statusCheckRollup,files,comments"], repo)) as AgentPr[])
    .filter((pr) => AGENT_BRANCH.test(pr.headRefName));
  let waiting = 0;
  for (const pr of prs) {
    try {
      const labels = new Set(pr.labels.map((l) => l.name));
      if (labels.has(NEEDS_HUMAN)) {
        waiting++;
        continue;
      }
      let reason: string;
      if (labels.has("review:ok")) {
        git(["fetch", "-q", "origin", `refs/pull/${pr.number}/head`], repo);
        const blocker = agentMergeBlocker(pr, citedImages(pr.headRefOid, repo), o.stopped, sourceProblems(pr, repo));
        if (!blocker) {
          if (!o.autoMerge || o.dryRun) {
            log.push(`se fusionaría ${pr.url}${o.autoMerge ? "" : " (auto_merge: false)"}`);
            continue;
          }
          merge(pr, o.month, now, repo);
          recorded = true;
          log.push(`fusionada ${pr.url}`);
          continue;
        }
        if (o.stopped) {
          log.push(`sin fusionar ${pr.url}: ${blocker}`);
          continue;
        }
        reason = blocker;
      } else if ([...labels].some((l) => l.startsWith("review:"))) {
        continue; // review:changes or review:error: the PR goes back to its agent
      } else if (now.getTime() - Date.parse(pr.createdAt) > NIGHT_MS) {
        reason = "sin veredicto del Revisor después de una noche";
      } else {
        continue;
      }
      waiting++;
      if (o.dryRun) {
        log.push(`esperaría a una persona ${pr.url}: ${reason}`);
        continue;
      }
      flag(pr, reason, repo);
      log.push(`espera a una persona ${pr.url}: ${reason}`);
    } catch (e) {
      log.push(`error con ${pr.url}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  if (waiting) {
    log.push(`${waiting} PR de agente esperan a una persona`);
    if (!o.dryRun) notify(`${waiting} PR de agente esperan a una persona`);
  }
  return { log, recorded };
}

/** Merges pinned to the checked SHA, records it in the PR, the merge commit and ops/merges/ (point 3). */
function merge(pr: AgentPr, month: string, now: Date, repo: string): void {
  const [, agent, runId] = pr.headRefName.match(AGENT_BRANCH)!;
  gh(["pr", "merge", String(pr.number), "--merge", "--match-head-commit", pr.headRefOid,
    "--subject", `Merge pull request #${pr.number} from ${pr.headRefName}`,
    "--body", `Auto-merged-by: factory\nRun-id: ${runId}`], repo);
  const mergeSha = gh(["pr", "view", String(pr.number), "--json", "mergeCommit", "--jq", ".mergeCommit.oid"], repo);
  const checks = pr.statusCheckRollup.map((c) => `${c.name ?? "?"}: ${c.conclusion}`);
  gh(["pr", "comment", String(pr.number), "--body", `🏭 Fusión automática (ADR-0011) del SHA ${pr.headRefOid}. ` +
    "Comprobado: rama de agente; `review:ok` sin `review:needs-human`; el último veredicto cita ese SHA; " +
    `sin conflictos; checks terminados en verde (${checks.join(", ")}); todo el diff en ` +
    `${ALLOWED_PATHS.join(", ")}, sin borrados ni renombrados; cada imagen citada por un YAML de data/raw/; ` +
    "cada fuente nueva T1, citada, sin image_license y en el dominio de su web_es de data/candidatas.yaml; " +
    "cada fuente cambiada solo con URL nuevas en hosts que ya tenía, notes y last_verified; " +
    `sin factory/STOP. Merge: ${mergeSha}. Para volver atrás: \`git revert -m 1 ${mergeSha}\`.`], repo);
  try {
    git(["push", "-q", "origin", "--delete", pr.headRefName], repo);
  } catch {
    // the branch stays; pruneMergedBranches cleans the local one
  }
  mkdirSync(MERGES_DIR, { recursive: true });
  appendFileSync(join(MERGES_DIR, `${month}.jsonl`), JSON.stringify({
    pr: pr.number, agent, run_id: runId, sha: pr.headRefOid, merge_sha: mergeSha,
    files: pr.files.map((f) => f.path), checks, at: now.toISOString(),
  }) + "\n", "utf8");
}

/** Labels the PR for a person, assigns it and says which rule failed (point 4). */
function flag(pr: AgentPr, reason: string, repo: string): void {
  const preview = pr.files.some((f) => f.path.startsWith("web/") || f.path.startsWith("data/raw/"));
  gh(["pr", "edit", String(pr.number), "--add-label", NEEDS_HUMAN, "--add-assignee", "@me",
    ...(preview ? ["--add-label", PREVIEW] : [])], repo);
  gh(["pr", "comment", String(pr.number), "--body",
    `🏭 Espera a una persona (ADR-0011): ${reason}. SHA ${pr.headRefOid}.`], repo);
}

/** The PRs that wait for a person, for --status. Empty when gh is not available. */
export function waitingPrs(repo = REPO): string[] {
  try {
    return gh(["pr", "list", "--state", "open", "--label", NEEDS_HUMAN, "--json", "number,title",
      "--jq", '.[] | "#\\(.number) \\(.title)"'], repo).split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
