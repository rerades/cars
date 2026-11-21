/**
 * Freezes a Researcher PR sent back with review:changes into an eval case (ADR-0026, decision 1).
 *
 *   node factory/dataset-capture.ts researcher <pr> [<pr>...]
 *
 * Writes factory/datasets/researcher/pr-NNNN/ with:
 *   case.yaml   pr, run_id, baseRefOid, date and literal task; `rules` and `expected` are left for a
 *               person (`confirmed: false`), and the sha256 of every frozen fetch
 *   files/      the data/raw/ and data/sources/ files the PR touches, as they were at baseRefOid
 *   review.md   the Reviewer's last verdict, for the person who fixes `expected`; never served
 * and, outside git (third-party text, ADR-0026 open question 1), ops/datasets/researcher/pr-NNNN/fetch/:
 * one JSON per fetch-page.ts, fetch-idae.ts or fetch-image.ts call of the original trace.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stringify } from "yaml";
import { readAllLedger, REPO, TRACE_DIR } from "./orchestrator.ts";

export const RESEARCHER_DATASET = join(REPO, "factory", "datasets", "researcher");
export const FETCH_DATASET = join(REPO, "ops", "datasets", "researcher");
const VERDICT = /^\s*🏭 Veredicto/;
const FETCH = /^node factory\/(fetch-(?:page|idae|image))\.ts$/;

const run = (bin: string, args: string[]) => execFileSync(bin, args, { cwd: REPO, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

/** Shell words of a simple command: quotes and backslashes, no expansion. Null if it pipes, chains or redirects. */
export function shellWords(cmd: string): string[] | null {
  const words: string[] = [];
  let cur: string | null = null;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (ch === "'" || ch === '"') {
      const end = cmd.indexOf(ch, i + 1);
      if (end < 0) return null;
      cur = (cur ?? "") + cmd.slice(i + 1, end);
      i = end;
    } else if (ch === "\\" && i + 1 < cmd.length) {
      cur = (cur ?? "") + cmd[++i];
    } else if (/\s/.test(ch)) {
      if (cur !== null) words.push(cur);
      cur = null;
    } else if ("|;&<>`$".includes(ch)) {
      return null;
    } else {
      cur = (cur ?? "") + ch;
    }
  }
  if (cur !== null) words.push(cur);
  return words;
}

export interface FetchCall {
  tool: string; // fetch-page, fetch-idae or fetch-image
  args: string[];
  exit: number; // 0, or 1 when the tool_result was an error
  output: string;
}

/**
 * Every fetch-*.ts call of a trace with its literal output. A compound command (a pipe, `&&`, `;`)
 * cannot be replayed, so it goes to `skipped` instead.
 */
export function fetchCalls(trace: string): { calls: FetchCall[]; skipped: string[] } {
  const pending = new Map<string, string[] | string>();
  const calls: FetchCall[] = [];
  const skipped: string[] = [];
  for (const line of trace.split("\n")) {
    let e: any;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    for (const c of Array.isArray(e.message?.content) ? e.message.content : []) {
      if (e.type === "assistant" && c.type === "tool_use" && c.name === "Bash") {
        const cmd = String(c.input?.command ?? "").trim();
        if (!/factory\/fetch-(page|idae|image)\.ts/.test(cmd)) continue;
        const words = shellWords(cmd);
        if (words && FETCH.test(words.slice(0, 2).join(" "))) pending.set(c.id, words);
        else skipped.push(cmd);
      }
      if (e.type === "user" && c.type === "tool_result" && pending.has(c.tool_use_id)) {
        const words = pending.get(c.tool_use_id) as string[];
        pending.delete(c.tool_use_id);
        const output = typeof c.content === "string" ? c.content
          : (Array.isArray(c.content) ? c.content : []).map((p: any) => p.text ?? "").join("\n");
        calls.push({ tool: words.slice(0, 2).join(" ").match(FETCH)![1], args: words.slice(2), exit: c.is_error ? 1 : 0, output });
      }
    }
  }
  return { calls, skipped };
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function capture(n: number): string {
  const pr = JSON.parse(run("gh", ["pr", "view", String(n), "--json", "headRefName,headRefOid,state,labels,comments,files"]));
  if (pr.state === "OPEN") return `#${n}: sigue abierta; solo se congelan PR cerradas`;
  const m = String(pr.headRefName).match(/^agent\/researcher\/([^/]+)$/);
  if (!m) return `#${n}: la rama ${pr.headRefName} no es del Researcher`;
  const runId = m[1];
  const tracePath = join(TRACE_DIR, `${runId}.jsonl`);
  if (!existsSync(tracePath)) return `#${n}: no hay traza ${runId} en ops/traces/`;
  const row = readAllLedger().find((r) => r.run_id === runId);
  if (!row?.task) return `#${n}: no hay fila de ${runId} en ops/runs/`;

  run("git", ["fetch", "-q", "origin", `refs/pull/${n}/head`, "main"]);
  // The run's worktree started from main: the merge base of its head and main is that commit.
  const base = run("git", ["merge-base", pr.headRefOid, "origin/main"]).trim();
  const id = `pr-${String(n).padStart(4, "0")}`;
  const dir = join(RESEARCHER_DATASET, id);
  const fetchDir = join(FETCH_DATASET, id, "fetch");
  mkdirSync(fetchDir, { recursive: true });

  const files: string[] = [];
  for (const f of pr.files as { path: string }[]) {
    if (!/^data\/(raw|sources)\//.test(f.path)) continue;
    let text: string;
    try {
      text = run("git", ["show", `${base}:${f.path}`]);
    } catch {
      continue; // created by the PR: there is nothing to start from
    }
    mkdirSync(dirname(join(dir, "files", f.path)), { recursive: true });
    writeFileSync(join(dir, "files", f.path), text);
    files.push(f.path);
  }

  const { calls, skipped } = fetchCalls(readFileSync(tracePath, "utf8"));
  const fetch = calls.map((c, i) => {
    const file = `${String(i + 1).padStart(2, "0")}-${c.tool}.json`;
    const text = JSON.stringify(c, null, 1) + "\n";
    writeFileSync(join(fetchDir, file), text);
    return { file, tool: c.tool, args: c.args, exit: c.exit, sha256: sha256(text) };
  });

  const verdict = (pr.comments as { body: string }[]).filter((c) => VERDICT.test(c.body)).at(-1)?.body ?? "";
  writeFileSync(join(dir, "review.md"), verdict + "\n");
  writeFileSync(join(dir, "case.yaml"), stringify({
    case_id: id,
    pr: n,
    run_id: runId,
    baseRefOid: base,
    date: String(row.started).slice(0, 10), // "Hoy es <date>" in the task (decision 2.4)
    task: row.task,
    synthetic: false,
    confirmed: false,
    rules: [], // a person picks from: dates, price_proof, price_kind, cash_amount, expired_offer, page_name
    expected: null, // a person fills it from review.md with the snapshot, decision 1
    files,
    fetch_partial: calls.some((c) => c.tool === "fetch-page" && c.args.length > 1),
    fetch,
    skipped_calls: skipped,
  }, { lineWidth: 0 }));
  return `#${n} → ${id}: ${files.length} ficheros, ${fetch.length} lecturas congeladas, ${skipped.length} sin congelar (comandos compuestos)`;
}

if (import.meta.main) {
  const [agent, ...prs] = process.argv.slice(2);
  if (agent !== "researcher" || !prs.length || prs.some((p) => !/^\d+$/.test(p))) {
    console.error("uso: node factory/dataset-capture.ts researcher <pr> [<pr>...]");
    process.exit(2);
  }
  for (const p of prs) {
    try {
      console.log(capture(Number(p)));
    } catch (e) {
      console.log(`#${p}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
}
