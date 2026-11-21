/**
 * Answers the Researcher's fetch-*.ts calls from the reads frozen in its eval case, without network
 * (ADR-0026, decision 2.2). eval-researcher.ts puts a guard at the top of fetch-page.ts,
 * fetch-idae.ts and fetch-image.ts in the case's worktree that hands the call to replayMain, so the
 * modules keep their exports for the scripts that import them.
 *
 *   FETCH_REPLAY_DIR  ops/datasets/researcher/<case>/fetch/, one JSON per frozen call (dataset-capture.ts)
 *   FETCH_REPLAY_LOG  JSONL file where every call and its answer are appended, for the scores
 */
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FetchCall } from "./dataset-capture.ts";
import { excerpts } from "./fetch-page.ts";

export interface Answer {
  stdout: string;
  stderr: string;
  code: number;
}
export type ReplayEntry = { tool: string; args: string[] } & Answer;

// The real script's message when a host does not answer: a URL the original never read stays unread.
const NOT_READ = "lectura fallida: The operation was aborted due to timeout";

export function loadFrozen(dir: string): FetchCall[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

const parse = (s: string): any => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

/** What the real script would have printed, as far as the frozen reads tell. */
export function replay(tool: string, args: string[], frozen: FetchCall[]): Answer {
  if (tool === "fetch-page") {
    const [url, ...keywords] = args;
    const reads = frozen.filter((f) => f.tool === "fetch-page" && f.exit === 0)
      .map((f) => ({ f, out: parse(f.output) }))
      .filter(({ f, out }) => out && (f.args[0] === url || out.url === url || out.final_url === url));
    if (!reads.length) return { stdout: "", stderr: NOT_READ, code: 1 };
    // Every frozen read of the page, paragraphs or full text, in order and without repeats.
    const lines = [...new Set(reads.flatMap(({ out }) => (Array.isArray(out.paragraphs) ? out.paragraphs : String(out.text ?? "").split("\n"))))];
    const first = reads[0].out;
    const base = { url, final_url: first.final_url ?? url, retrieved: first.retrieved, chars: first.chars };
    const body = keywords.length
      ? { ...base, keywords, paragraphs: excerpts(lines.join("\n"), keywords) }
      : { ...base, truncated: false, text: lines.join("\n") };
    return { stdout: JSON.stringify(body, null, 1), stderr: "", code: 0 };
  }
  const same = frozen.find((f) => f.tool === tool && JSON.stringify(f.args) === JSON.stringify(args));
  if (!same) return { stdout: "", stderr: `lectura fallida: sin lectura congelada para ${tool} ${args.join(" ")}`, code: 1 };
  return same.exit === 0 ? { stdout: same.output, stderr: "", code: 0 } : { stdout: "", stderr: same.output, code: 1 };
}

export function replayMain(tool: string): never {
  const args = process.argv.slice(2);
  const a = replay(tool, args, loadFrozen(process.env.FETCH_REPLAY_DIR ?? ""));
  if (process.env.FETCH_REPLAY_LOG) appendFileSync(process.env.FETCH_REPLAY_LOG, JSON.stringify({ tool, args, ...a }) + "\n");
  if (a.stdout) console.log(a.stdout);
  if (a.stderr) console.error(a.stderr);
  process.exit(a.code);
}

/** The lines prepended to a fetch-*.ts in the worktree: only a direct run in a case is replayed. */
export const replayGuard = (tool: string, self: string) =>
  `if (import.meta.main && process.env.FETCH_REPLAY_DIR) (await import(${JSON.stringify(self)})).replayMain(${JSON.stringify(tool)});\n`;
