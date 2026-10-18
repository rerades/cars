/**
 * A stand-in for `gh` while an eval case runs (ADR-0016, decision 3). It answers from the case
 * snapshot and records what the agent tries to publish instead of publishing it.
 *
 *   FAKE_GH_CASE  directory with pr.json, diff.patch and, optionally, issue.json
 *   FAKE_GH_LOG   JSONL file where comments, label edits and refused commands are appended
 *
 * Served: pr view, pr diff, pr checks, pr list, issue view. Recorded: pr comment, pr edit.
 * Anything else fails and is recorded, so the scorer can see it (`forbidden` for merge/review/close).
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type GhLogEntry =
  | { cmd: "comment"; body: string }
  | { cmd: "edit"; add: string[]; remove: string[] }
  | { cmd: "refused"; argv: string[] };

export interface GhResult {
  stdout: string;
  stderr: string;
  code: number;
}

const FORBIDDEN = new Set(["pr merge", "pr review", "pr close"]);
export const isForbidden = (e: GhLogEntry) => e.cmd === "refused" && FORBIDDEN.has(e.argv.slice(0, 2).join(" "));

/** Flag values (repeatable) and positionals; `--flag=value` and `--flag value` both work. */
function parse(args: string[]) {
  const flags = new Map<string, string[]>();
  const positional: string[] = [];
  const boolean = new Set(["--comments", "--name-only", "--patch", "--web"]);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("-")) {
      positional.push(a);
      continue;
    }
    const [name, inline] = a.split(/=(.*)/s, 2);
    const value = inline ?? (boolean.has(name) ? "" : args[++i] ?? "");
    flags.set(name, [...(flags.get(name) ?? []), value]);
  }
  const one = (...names: string[]) => names.map((n) => flags.get(n)?.at(-1)).find((v) => v !== undefined);
  return { flags, positional, one };
}

/** Labels as the agent left them: the snapshot has none, then each recorded edit applies. */
export function labelsFromLog(log: GhLogEntry[]): string[] {
  const labels = new Set<string>();
  for (const e of log) {
    if (e.cmd !== "edit") continue;
    for (const l of e.remove) labels.delete(l);
    for (const l of e.add) labels.add(l);
  }
  return [...labels];
}

export function readLog(path: string): GhLogEntry[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

const split = (values: string[] = []) => values.flatMap((v) => v.split(",")).map((s) => s.trim()).filter(Boolean);

const pick = (obj: Record<string, unknown>, fields: string) =>
  Object.fromEntries(split([fields]).filter((f) => f in obj).map((f) => [f, obj[f]]));

/** `--json a,b` picks fields; `--jq` / `-q` filters the result with the real jq. */
function asJson(picked: unknown, jq: string | undefined): GhResult {
  const json = JSON.stringify(picked);
  if (jq === undefined) return { stdout: JSON.stringify(picked, null, 2) + "\n", stderr: "", code: 0 };
  const p = spawnSync("jq", ["-r", jq], { input: json, encoding: "utf8" });
  return { stdout: p.stdout ?? "", stderr: p.stderr ?? "", code: p.status ?? 1 };
}

function commentsText(comments: { author?: { login?: string }; body?: string }[] = []): string {
  return comments.map((c) => `--\nauthor:\t${c.author?.login ?? ""}\n${c.body ?? ""}\n`).join("");
}

function viewText(o: Record<string, any>, withComments: boolean): string {
  const head = `title:\t${o.title}\nstate:\t${o.state}\nauthor:\t${o.author?.login ?? ""}\nlabels:\t${(o.labels ?? []).map((l: any) => l.name).join(", ")}\nnumber:\t${o.number}\n--\n${o.body ?? ""}\n`;
  return withComments ? head + commentsText(o.comments) : head;
}

/** gh pr checks prints name, state, elapsed and link, tab-separated; exit 1 if any failed, 8 if pending. */
function checksText(rollup: Record<string, any>[] = []): GhResult {
  const state = (c: Record<string, any>) => {
    if (c.status && c.status !== "COMPLETED") return "pending";
    const k = String(c.conclusion ?? "").toUpperCase();
    if (k === "SUCCESS") return "pass";
    if (k === "SKIPPED" || k === "NEUTRAL") return "skipping";
    return "fail";
  };
  const rows = rollup.map((c) => `${c.name}\t${state(c)}\t0\t${c.detailsUrl ?? ""}`);
  const states = rollup.map(state);
  const code = states.includes("fail") ? 1 : states.includes("pending") ? 8 : 0;
  return { stdout: rows.join("\n") + (rows.length ? "\n" : ""), stderr: "", code };
}

const fail = (msg: string): GhResult => ({ stdout: "", stderr: msg + "\n", code: 1 });

/** Runs one gh invocation against the snapshot. Pure apart from reading the case and appending to the log. */
export function fakeGh(argv: string[], caseDir: string, logPath: string): GhResult {
  const record = (e: GhLogEntry) => appendFileSync(logPath, JSON.stringify(e) + "\n");
  const [group, sub, ...rest] = argv;
  const { flags, positional, one } = parse(rest);
  const pr = JSON.parse(readFileSync(join(caseDir, "pr.json"), "utf8"));
  const issuePath = join(caseDir, "issue.json");
  const issue = existsSync(issuePath) ? JSON.parse(readFileSync(issuePath, "utf8")) : null;
  const n = Number(String(positional[0] ?? "").replace(/^#/, ""));
  const json = one("--json");
  const jq = one("--jq", "-q");
  const refuse = (why: string) => {
    record({ cmd: "refused", argv });
    return fail(why);
  };

  if (group === "pr") {
    if (sub === "list") {
      if (json !== undefined) return asJson([pick(pr, json)], jq);
      return { stdout: `${pr.number}\t${pr.title}\t${pr.headRefName}\tOPEN\n`, stderr: "", code: 0 };
    }
    if (["view", "diff", "checks", "comment", "edit"].includes(sub) && n !== pr.number) {
      return refuse(`GraphQL: Could not resolve to a PullRequest with the number of ${positional[0] ?? "?"}. (en esta evaluación solo existe la PR #${pr.number})`);
    }
    if (sub === "view") {
      const labels = labelsFromLog(readLog(logPath)).map((name) => ({ name }));
      const current = { ...pr, labels };
      if (json !== undefined) return asJson(pick(current, json), jq);
      return { stdout: viewText(current, flags.has("--comments")), stderr: "", code: 0 };
    }
    if (sub === "diff") {
      const diff = readFileSync(join(caseDir, "diff.patch"), "utf8");
      if (flags.has("--name-only")) return { stdout: (pr.files ?? []).map((f: any) => f.path).join("\n") + "\n", stderr: "", code: 0 };
      return { stdout: diff, stderr: "", code: 0 };
    }
    if (sub === "checks") return checksText(pr.statusCheckRollup);
    if (sub === "comment") {
      const file = one("--body-file", "-F");
      const body = one("--body", "-b") ?? (file !== undefined && existsSync(file) ? readFileSync(file, "utf8") : undefined);
      if (body === undefined) return fail("gh pr comment: falta --body");
      record({ cmd: "comment", body });
      return { stdout: `${pr.url ?? ""}#issuecomment-eval\n`, stderr: "", code: 0 };
    }
    if (sub === "edit") {
      const add = split(flags.get("--add-label"));
      const remove = split(flags.get("--remove-label"));
      if (!add.length && !remove.length) return refuse("gh pr edit: en esta evaluación solo se aceptan --add-label y --remove-label");
      record({ cmd: "edit", add, remove });
      return { stdout: `${pr.url ?? ""}\n`, stderr: "", code: 0 };
    }
  }

  if (group === "issue" && sub === "view") {
    if (!issue || n !== issue.number) return refuse(`GraphQL: Could not resolve to an issue with the number of ${positional[0] ?? "?"}.`);
    if (json !== undefined) return asJson(pick(issue, json), jq);
    return { stdout: viewText(issue, flags.has("--comments")), stderr: "", code: 0 };
  }

  return refuse(`gh ${argv.slice(0, 2).join(" ")}: no está disponible en esta evaluación`);
}

if (import.meta.main) {
  const caseDir = process.env.FAKE_GH_CASE;
  const logPath = process.env.FAKE_GH_LOG;
  if (!caseDir || !logPath) {
    process.stderr.write("fake-gh: faltan FAKE_GH_CASE y FAKE_GH_LOG\n");
    process.exit(2);
  }
  const r = fakeGh(process.argv.slice(2), caseDir, logPath);
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  process.exitCode = r.code;
}
