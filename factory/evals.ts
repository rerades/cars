/**
 * Deterministic evals run on what an agent wrote, before its branch is committed.
 * See docs/architecture/adr/0004-trazas-y-evals.md. Each check returns its failures.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export interface EvalResult {
  passed: number;
  failed: string[];
}

interface Ctx {
  dir: string;
  files: string[];
  writePaths: string[];
  today: string; // YYYY-MM-DD
}

type Check = (ctx: Ctx) => string[];

const REGISTRY = "data/sources/registry.yaml";

/** Modified and new files in the worktree (deletions need no eval). */
export function changedFiles(dir: string): string[] {
  return execFileSync("git", ["ls-files", "-mo", "--exclude-standard"], { cwd: dir, encoding: "utf8" })
    .split("\n").filter(Boolean);
}

const isDay = (v: unknown, today: string) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && v <= today;

function readYaml(ctx: Ctx, file: string): { data?: any; error?: string } {
  try {
    return { data: parse(readFileSync(join(ctx.dir, file), "utf8")) };
  } catch (e) {
    return { error: `${file}: invalid YAML (${(e as Error).message.split("\n")[0]})` };
  }
}

/** The guard hook should already block this; the eval catches it if the hook ever fails. */
const writePaths: Check = (ctx) =>
  ctx.files
    .filter((f) => !ctx.writePaths.some((p) => f.startsWith(p)))
    .map((f) => `write_paths: ${f} is outside ${JSON.stringify(ctx.writePaths)}`);

/** ADR-0001: every source has an id, a tier, its URLs and a real verification date. */
const registry: Check = (ctx) => {
  if (!ctx.files.includes(REGISTRY)) return [];
  const { data, error } = readYaml(ctx, REGISTRY);
  if (error) return [error];
  const sources = data?.sources;
  if (!Array.isArray(sources)) return [`${REGISTRY}: missing sources list`];
  return sources.flatMap((s: any, i: number) => {
    const at = `${REGISTRY}: ${s?.id || `source ${i + 1}`}`;
    const out: string[] = [];
    if (!s?.id) out.push(`${at}: missing id`);
    if (!["T1", "T2", "T3"].includes(s?.tier)) out.push(`${at}: tier must be T1, T2 or T3`);
    if (!s?.urls || !Object.keys(s.urls).length) out.push(`${at}: missing urls`);
    if (!isDay(s?.last_verified, ctx.today)) out.push(`${at}: last_verified must be a past date`);
    return out;
  });
};

/** ADR-0001 rule 2: every value carries source_id (from the registry), url, retrieved and tier. */
const rawData: Check = (ctx) => {
  const files = ctx.files.filter((f) => f.startsWith("data/raw/") && /\.ya?ml$/.test(f));
  if (!files.length) return [];
  const regPath = join(ctx.dir, REGISTRY);
  const ids = new Set(
    existsSync(regPath) ? (parse(readFileSync(regPath, "utf8"))?.sources ?? []).map((s: any) => s?.id) : [],
  );
  return files.flatMap((file) => {
    const { data, error } = readYaml(ctx, file);
    if (error) return [error];
    const out: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`));
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if ("value" in o) {
        const at = `${file}: ${path || "."}`;
        for (const k of ["source_id", "url", "retrieved", "tier"]) if (!o[k]) out.push(`${at}: missing ${k}`);
        if (o.source_id && !ids.has(o.source_id)) out.push(`${at}: source_id ${o.source_id} is not in the registry`);
        if (o.retrieved && !isDay(o.retrieved, ctx.today)) out.push(`${at}: retrieved must be a past date`);
      }
      for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k);
    };
    walk(data, "");
    return out;
  });
};

const CHECKS: Record<string, Check[]> = {
  researcher: [registry, rawData],
};

export function runEvals(agent: string, dir: string, files: string[], paths: string[], today: string): EvalResult {
  const ctx = { dir, files, writePaths: paths, today };
  const results = [writePaths, ...(CHECKS[agent] ?? [])].map((check) => check(ctx));
  return { passed: results.filter((r) => !r.length).length, failed: results.flat() };
}
