/**
 * Builds onboarding/index.html: the presentation page that explains the repo to third parties.
 * Every figure comes from the repo itself (agents, budgets, ledger, queue, ADRs, PRDs, data, CI),
 * so rerunning it is all it takes to keep the page current. Run: node onboarding/build.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "yaml";
import { LEDGER_DIR, loadConfig, QUEUE, queueState, readAllLedger, readQueue, REPO } from "../factory/orchestrator.ts";

const HERE = import.meta.dirname;

/**
 * Front matter of a Markdown file as `key: value` lines, or {} if it has none. Not parsed as
 * YAML: agent descriptions carry unquoted colons, which Claude Code accepts and YAML does not.
 */
export function frontMatter(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  return Object.fromEntries(m[1].split("\n").map((l) => l.match(/^([\w-]+):\s*(.*?)(\s+#.*)?$/))
    .filter((x) => x !== null).map((x) => [x[1], x[2]]));
}

/** "Agente X de la web… Úsalo para …" → "Úsalo para …": the boilerplate first sentence goes. */
export function agentPurpose(description: string): string {
  return description.replace(/^Agente [^.]*\.\s*/, "");
}

/** First word of an ADR's "**Estado:**" line and its first date: "aceptada", "2026-10-01". */
export function adrStatus(text: string): { status: string; date: string | null } {
  const line = text.match(/\*\*Estado:\*\*\s*([^\n]*)/)?.[1] ?? "";
  return { status: line.match(/^[\p{L}-]+/u)?.[0].toLowerCase() ?? "sin estado", date: line.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null };
}

/** "- **2026-10-18 12:52** · 📝 Nota — text (refs)" → its parts. */
export function parseLogLine(line: string): { when: string; kind: string; text: string } | null {
  const m = line.match(/^- \*\*([^*]+)\*\* · \S+ (\S+) — (.*)$/);
  return m ? { when: m[1], kind: m[2], text: m[3] } : null;
}

const read = (...p: string[]) => readFileSync(join(REPO, ...p), "utf8");
const list = (...p: string[]) => (existsSync(join(REPO, ...p)) ? readdirSync(join(REPO, ...p)).sort() : []);
const git = (...args: string[]) => execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
}

function collect() {
  const cfg = loadConfig();
  // The ledger and queue live in the factory-state worktree; a fresh clone only has main's copy.
  const ledgerDir = existsSync(LEDGER_DIR) ? LEDGER_DIR : join(REPO, "ops", "runs");
  const rows = readAllLedger(ledgerDir);
  const queue = readQueue(existsSync(QUEUE) ? QUEUE : join(REPO, "factory", "queue.yaml"));
  const pending = queueState(queue, rows).pending;

  const agents = list(".claude", "agents").filter((f) => f.endsWith(".md")).map((f) => {
    const fm = frontMatter(read(".claude", "agents", f)) as { name: string; description: string; tools?: string };
    const b = cfg.agents?.[fm.name] ?? {};
    const mine = rows.filter((r) => r.agent === fm.name);
    return {
      name: fm.name,
      purpose: agentPurpose(fm.description),
      tools: (fm.tools ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      model: b.model ?? cfg.global?.default_model ?? "sonnet",
      writes: b.write_paths ?? [],
      network: Boolean(b.network),
      budget: b.max_usd_per_period ?? null,
      perRun: b.max_usd_per_run ?? null,
      perDay: b.max_runs_per_day ?? null,
      runs: mine.length,
      ok: mine.filter((r) => r.outcome === "success").length,
      cost: mine.reduce((s, r) => s + (r.cost_usd ?? 0), 0),
      pending: pending.filter((t) => t.agent === fm.name).length,
    };
  });

  const runs = rows.map((r) => ({
    day: String(r.started ?? "").slice(0, 10),
    agent: r.agent,
    outcome: r.outcome,
    cost: r.cost_usd ?? 0,
  })).filter((r) => r.day);

  const adrs = list("docs", "architecture", "adr").filter((f) => /^\d{4}-/.test(f)).map((f) => {
    const text = read("docs", "architecture", "adr", f);
    const title = text.match(/^# (ADR-\d+) — (.*)$/m);
    return { id: title?.[1] ?? f.slice(0, 4), title: (title?.[2] ?? f).replaceAll("`", ""), ...adrStatus(text) };
  });

  const prds = list("docs", "product", "prd").filter((f) => f.startsWith("PRD-")).map((f) => {
    const text = read("docs", "product", "prd", f);
    const title = text.match(/^# (PRD-\d+) — (.*)$/m);
    return { id: title?.[1] ?? f.slice(0, 7), title: title?.[2] ?? f, status: String(frontMatter(text).status ?? "draft") };
  });

  const ci = parse(read(".github", "workflows", "ci.yml")) as { jobs: Record<string, unknown> };

  // launchd: which run.ts command each job starts and at what times.
  const schedules = list("factory", "launchd").filter((f) => f.endsWith(".example")).map((f) => {
    const text = read("factory", "launchd", f);
    const args = [...text.matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1]);
    const cmd = args[args.findIndex((a) => a.endsWith("run.ts")) + 1] ?? "";
    const times = [...text.matchAll(/<key>Hour<\/key><integer>(\d+)<\/integer><key>Minute<\/key><integer>(\d+)<\/integer>/g)]
      .map((m) => `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}`).sort();
    return { job: f.replace(/^com\.darkfactory\.|\.plist\.example$/g, ""), cmd, times };
  });

  const logDir = join(REPO, "docs", "bitacora");
  const log = list("docs", "bitacora").filter((d) => /^\d{4}-\d{2}$/.test(d)).flatMap((d) =>
    list("docs", "bitacora", d).map((f) => readFileSync(join(logDir, d, f), "utf8").trim()))
    .slice(-12).reverse().map(parseLogLine).filter(Boolean);

  const pages = walk(join(REPO, "web", "src", "pages")).filter((f) => f.endsWith(".astro"))
    .map((f) => "/" + relative(join(REPO, "web", "src", "pages"), f).replace(/(index)?\.astro$/, "").replace(/\/$/, ""))
    .sort();

  const rawFiles = walk(join(REPO, "data", "raw")).filter((f) => f.endsWith(".yaml"));

  return {
    built: new Date().toISOString(),
    commit: git("rev-parse", "--short", "HEAD"),
    git: { commits: Number(git("rev-list", "--count", "HEAD")), merges: Number(git("rev-list", "--count", "--merges", "HEAD")), since: git("log", "--reverse", "--format=%as").split("\n")[0] },
    global: {
      hours: cfg.global?.allowed_hours ?? null,
      budget: cfg.global?.max_usd_per_period ?? null,
      perDay: cfg.global?.max_runs_per_day ?? null,
      autoPr: Boolean(cfg.global?.auto_pr),
      autoMerge: Boolean(cfg.global?.auto_merge),
      billing: `${cfg.billing?.mode ?? ""} ${cfg.billing?.plan ?? ""}`.trim(),
    },
    agents,
    runs,
    queue: { total: queue.length, pending: pending.length },
    adrs,
    prds,
    ci: Object.keys(ci.jobs),
    schedules,
    log,
    pages,
    data: {
      brands: list("data", "raw").filter((d) => !d.startsWith(".")).length,
      models: rawFiles.length,
      sources: list("data", "sources").filter((f) => f.endsWith(".yaml")).length,
      images: walk(join(REPO, "data", "images")).filter((f) => /\.(jpe?g|png)$/i.test(f)).length,
    },
  };
}

if (import.meta.main) {
  const data = JSON.stringify(collect()).replaceAll("</", "<\\/");
  const html = readFileSync(join(HERE, "template.html"), "utf8").replace("/*__DATA__*/null", data);
  writeFileSync(join(HERE, "index.html"), html);
  console.log(`onboarding/index.html escrito (${(html.length / 1024).toFixed(0)} KB)`);
}
