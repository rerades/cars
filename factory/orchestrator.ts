/**
 * Lógica del orquestador de la factoría.
 *
 * Aplica lo definido en docs/architecture/adr/0002-presupuesto-control-observabilidad.md:
 * interruptor de parada, horario, concurrencia, límites diarios y presupuesto del periodo.
 * El CLI está en factory/run.ts.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse } from "yaml";
import { changedFiles, runEvals } from "./evals.ts";

export const REPO = join(import.meta.dirname, "..");
export const BUDGETS = join(REPO, "factory", "budgets.yaml");
/**
 * Factory state (ADR-0013): the queue is read and the ledger written in a worktree of the
 * chore/factory-state branch, never in the person's checkout. FACTORY_STATE_DIR points the state
 * at a plain folder and turns off its git handling; the tests use it.
 */
export const STATE_BRANCH = "chore/factory-state";
export const STATE_DIR = process.env.FACTORY_STATE_DIR || join(REPO, "ops", "worktrees", "factory-state");
const STATE_IN_GIT = !process.env.FACTORY_STATE_DIR;
export const LEDGER_DIR = join(STATE_DIR, "ops", "runs");
export const QUEUE = join(STATE_DIR, "factory", "queue.yaml");
/** Full stream-json output of each run; not versioned (see ADR-0004). */
export const TRACE_DIR = join(REPO, "ops", "traces");
export const ACTIONS_DIR = join(REPO, "ops", "actions");
export const LOCK = join(REPO, "factory", ".run.lock");

export interface AgentConfig {
  max_runs_per_day?: number | null;
  max_usd_per_period?: number | null;
  max_usd_per_run?: number | null;
  max_turns_per_run?: number | null;
  model?: string;
  permission_mode?: string;
  allowed_tools?: string[];
  denied_tools?: string[];
  write_paths?: string[];
  [key: string]: unknown;
}

export interface Config {
  billing?: { mode?: string; [key: string]: unknown };
  global?: {
    max_runs_per_day?: number | null;
    allowed_hours?: string | null;
    timezone?: string;
    default_model?: string;
    max_usd_per_period?: number | null;
    stop_file?: string;
    auto_pr?: boolean;
    [key: string]: unknown;
  };
  agents?: Record<string, AgentConfig | null>;
}

export type Row = Record<string, unknown> & {
  agent?: string;
  started?: string | null;
  cost_usd?: number | null;
};

// --------------------------------------------------------------------------- config

export function loadConfig(path = BUDGETS): Config {
  return parse(readFileSync(path, "utf8")) as Config;
}

export function agentConfig(cfg: Config, agent: string): AgentConfig {
  const agents = cfg.agents ?? {};
  if (!(agent in agents)) throw new Error(`agente desconocido: ${agent}`);
  return agents[agent] ?? {};
}

// --------------------------------------------------------------------------- reloj

/** Hora de pared en una zona horaria: día, hora y marca ISO con su desfase. */
export interface Clock {
  day: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  iso: string; // YYYY-MM-DDTHH:MM:SS+02:00
  tz: string;
}

export function clock(date: Date, tz: string): Clock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, hourCycle: "h23", timeZoneName: "longOffset",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  const offset = parts.timeZoneName === "GMT" ? "+00:00" : parts.timeZoneName.slice(3);
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;
  return { day, time, iso: `${day}T${time}${offset}`, tz };
}

export function nowInTz(cfg: Config): Clock {
  return clock(new Date(), cfg.global?.timezone || "UTC");
}

// --------------------------------------------------------------------------- espacio de trabajo

export interface Workspace {
  dir: string;
  branch: string;
  /** Commit the branch starts from: if HEAD moved, the agent committed by itself. */
  base: string;
}

const git = (args: string[], cwd = REPO) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/**
 * Cada ejecución trabaja en su propia rama, dentro de un worktree aparte: así el agente no
 * escribe nunca en la copia de trabajo de la persona, ni siquiera con cambios a medias.
 */
export function openWorkspace(runId: string, agent: string, repo = REPO): Workspace {
  const branch = `agent/${agent}/${runId}`;
  const dir = join(repo, "ops", "worktrees", runId);
  mkdirSync(join(repo, "ops", "worktrees"), { recursive: true });
  // Desde origin/main, no desde HEAD: si hay una rama a medias, su trabajo no se cuela
  // en lo que escribe el agente ni en su PR.
  const base = git(["branch", "-r", "--list", "origin/main"], repo) ? "origin/main" : "HEAD";
  git(["worktree", "add", "-q", "-b", branch, dir, base], repo);
  return { dir, branch, base: git(["rev-parse", base], repo) };
}

/**
 * Commits whatever the agent left uncommitted and removes the worktree; the branch stays.
 * Returns false if the agent wrote nothing, and then also deletes the empty branch. Commits the
 * agent made by itself count as written: a clean status alone used to delete them (run of #112).
 */
export function closeWorkspace(ws: Workspace, message: string, repo = REPO): boolean {
  const dirty = git(["status", "--porcelain"], ws.dir) !== "";
  if (dirty) {
    git(["add", "-A"], ws.dir);
    git(["commit", "-q", "-m", message], ws.dir);
  }
  const changed = git(["rev-parse", "HEAD"], ws.dir) !== ws.base;
  git(["worktree", "remove", "--force", ws.dir], repo);
  if (!changed) git(["branch", "-q", "-D", ws.branch], repo);
  return changed;
}

/**
 * Borra las ramas de agente ya fusionadas y los worktrees que quedaron sueltos.
 * Devuelve las ramas borradas. Nunca tumba una ejecución: si algo falla, se ignora.
 */
export function pruneMergedBranches(repo = REPO, base?: string): string[] {
  try {
    git(["worktree", "prune"], repo);
    try {
      git(["fetch", "-q", "--prune", "origin"], repo);
    } catch {
      // sin red: se limpia con lo que haya en local
    }
    const ref = base ?? (git(["branch", "-r", "--list", "origin/main"], repo) ? "origin/main" : "main");
    const merged = git(["branch", "--merged", ref, "--list", "agent/*", "--format=%(refname:short)"], repo)
      .split("\n").filter(Boolean);
    return merged.filter((branch) => {
      try {
        git(["branch", "-q", "-D", branch], repo);
        return true;
      } catch {
        return false; // está en uso por un worktree
      }
    });
  } catch {
    return [];
  }
}

/** Sube la rama y abre la PR. Devuelve su URL, o null si no se pudo. */
export function openPullRequest(ws: Workspace, title: string, body: string, repo = REPO): string | null {
  try {
    git(["push", "-q", "-u", "origin", ws.branch], repo);
    const out = execFileSync("gh", ["pr", "create", "--base", "main", "--head", ws.branch,
      "--title", title, "--body", body], { cwd: repo, encoding: "utf8" });
    return out.trim().split("\n").at(-1) ?? null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------- estado (ADR-0013)

/**
 * Brings the state worktree up to date before a run. If no commit of the state branch is missing
 * from origin/main (its PR was merged, or it never had anything), it restarts from origin/main;
 * otherwise origin/main is merged into it. Returns an error message when the state cannot be
 * trusted (merge conflict), so the run is blocked; null when it is ready.
 * Without network it carries on with the local copy, which is right while only this machine writes.
 */
export function syncState(repo = REPO, dir = STATE_DIR): string | null {
  if (!STATE_IN_GIT) return null;
  try {
    git(["fetch", "-q", "origin"], repo);
  } catch {
    // sin red: se sigue con lo que hay en local
  }
  const base = git(["branch", "-r", "--list", "origin/main"], repo) ? "origin/main" : "main";
  const registered = git(["worktree", "list", "--porcelain"], repo).split("\n").includes(`worktree ${dir}`);
  if (!registered) {
    rmSync(dir, { recursive: true, force: true });
    git(["worktree", "prune"], repo);
    const hasBranch = git(["branch", "--list", STATE_BRANCH], repo) !== "";
    git(["worktree", "add", "-q", ...(hasBranch ? [dir, STATE_BRANCH] : ["-b", STATE_BRANCH, dir, base])], repo);
  }
  // Merge commits from earlier syncs do not count: only commits carrying rows do.
  if (!git(["rev-list", "--no-merges", `${base}..HEAD`], dir)) {
    git(["reset", "-q", "--hard", base], dir); // every row of ours is already in main
    return null;
  }
  try {
    git(["merge", "-q", "--no-edit", base], dir);
    return null;
  } catch {
    try {
      git(["merge", "--abort"], dir);
    } catch {
      // nothing to abort
    }
    return `la rama de estado ${STATE_BRANCH} choca con ${base}: arréglala a mano (ADR-0013)`;
  }
}

/**
 * Commits the ledger in the state worktree, pushes it and opens the state PR if none is open.
 * Never throws: a failed push leaves the commit on the local branch and the next run pushes it.
 */
export function commitState(runId: string, repo = REPO, dir = STATE_DIR): string | null {
  if (!STATE_IN_GIT) return null;
  try {
    git(["add", "ops/runs"], dir);
    git(["commit", "-q", "-m", `chore(factory): record run ${runId}`], dir);
    git(["push", "-q", "-u", "origin", STATE_BRANCH], dir);
    const open = execFileSync("gh", ["pr", "list", "--head", STATE_BRANCH, "--state", "open", "--json", "url",
      "--jq", ".[0].url"], { cwd: repo, encoding: "utf8" }).trim();
    if (open) return open;
    const out = execFileSync("gh", ["pr", "create", "--base", "main", "--head", STATE_BRANCH,
      "--title", "chore(factory): record factory runs",
      "--body", "🏭 Factory state (ADR-0013): ledger rows of the runs since the last merge. " +
        "Merge with a merge commit, never squash."], { cwd: repo, encoding: "utf8" });
    return out.trim().split("\n").at(-1) ?? null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------- cola

export interface QueueItem {
  id: string;
  agent: string;
  task: string;
}

/** Every task of the queue, in order. A person writes it; the factory never rewrites it. */
export function readQueue(path = QUEUE): QueueItem[] {
  if (!existsSync(path)) return [];
  const items = parse(readFileSync(path, "utf8")) ?? [];
  if (!Array.isArray(items)) throw new Error(`${path}: se esperaba una lista de tareas`);
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (!item?.id || !item?.agent || !item?.task) throw new Error(`${path}: la tarea ${i + 1} necesita id, agent y task`);
    if (seen.has(item.id)) throw new Error(`${path}: el id ${item.id} está repetido`);
    seen.add(item.id);
  });
  return items;
}

/**
 * A queued task is consumed once the ledger has a row with its id, whatever the outcome: a
 * failed one is not retried in a loop. To retry it, queue it again with a new id.
 */
export function queueState(queue: QueueItem[], rows: Row[]): { pending: QueueItem[]; failed: Row[] } {
  const consumed = new Set(rows.map((r) => r.task_id).filter(Boolean));
  return {
    pending: queue.filter((t) => !consumed.has(t.id)),
    failed: rows.filter((r) => r.task_id && r.outcome !== "success"),
  };
}

// --------------------------------------------------------------------------- ledger

/** `month` en formato YYYY-MM. */
export function ledgerPath(month: string, dir = LEDGER_DIR): string {
  return join(dir, `${month}.jsonl`);
}

export function readLedger(month: string, dir = LEDGER_DIR): Row[] {
  const path = ledgerPath(month, dir);
  if (!existsSync(path)) return [];
  const rows: Row[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      // una línea corrupta no debe tumbar la factoría
    }
  }
  return rows;
}

/** Every month of the ledger: a task consumed last month is still consumed. */
export function readAllLedger(dir = LEDGER_DIR): Row[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort()
    .flatMap((f) => readLedger(f.slice(0, -".jsonl".length), dir));
}

export function appendLedger(record: Row, month: string, dir = LEDGER_DIR): void {
  mkdirSync(dir, { recursive: true });
  appendFileSync(ledgerPath(month, dir), JSON.stringify(record) + "\n", "utf8");
}

const runDay = (row: Row) => String(row.started ?? "").slice(0, 10);

export function runsToday(rows: Row[], today: string, agent?: string): number {
  return rows.filter((r) => runDay(r) === today && (agent === undefined || r.agent === agent)).length;
}

export function spentInPeriod(rows: Row[], agent?: string): number {
  const total = rows
    .filter((r) => agent === undefined || r.agent === agent)
    .reduce((sum, r) => sum + Number(r.cost_usd || 0), 0);
  return Math.round(total * 1e4) / 1e4;
}

// --------------------------------------------------------------------------- horario

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.trim().split(":").map(Number);
  return h * 60 + m;
};

/** True si `now` cae dentro de la ventana. Soporta ventanas que cruzan medianoche. */
export function inWindow(now: Clock, window: string | null | undefined): boolean {
  if (!window) return true;
  const [startS, endS] = window.split("-");
  const start = minutes(startS);
  const end = minutes(endS);
  const current = minutes(now.time);
  if (start <= end) return start <= current && current < end;
  return current >= start || current < end;
}

// --------------------------------------------------------------------------- guardas

export interface Decision {
  allowed: boolean;
  reason: string;
}

const deny = (reason: string): Decision => ({ allowed: false, reason });

export function checkCanRun(
  cfg: Config, agent: string, now: Clock, rows: Row[], ignoreWindow = false,
): Decision {
  const g = cfg.global ?? {};
  const a = agentConfig(cfg, agent);

  const stopFile = join(REPO, g.stop_file || "factory/STOP");
  if (existsSync(stopFile)) return deny(`interruptor de parada activo (${basename(stopFile)})`);

  if (!ignoreWindow && !inWindow(now, g.allowed_hours)) {
    return deny(`fuera del horario permitido (${g.allowed_hours})`);
  }

  if (existsSync(LOCK)) return deny("ya hay una ejecución en curso (factory/.run.lock)");

  const maxGlobal = g.max_runs_per_day;
  if (maxGlobal != null && runsToday(rows, now.day) >= maxGlobal) {
    return deny(`límite diario global alcanzado (${maxGlobal})`);
  }

  const maxAgent = a.max_runs_per_day;
  if (maxAgent != null && runsToday(rows, now.day, agent) >= maxAgent) {
    return deny(`límite diario de ${agent} alcanzado (${maxAgent})`);
  }

  const maxUsdGlobal = g.max_usd_per_period;
  if (maxUsdGlobal != null && spentInPeriod(rows) >= maxUsdGlobal) {
    return deny(`presupuesto del periodo agotado (${maxUsdGlobal} USD)`);
  }

  const maxUsdAgent = a.max_usd_per_period;
  if (maxUsdAgent == null) return deny(`${agent} no tiene presupuesto asignado`);
  if (spentInPeriod(rows, agent) >= maxUsdAgent) {
    return deny(`presupuesto de ${agent} agotado (${maxUsdAgent} USD)`);
  }

  if (a.max_usd_per_run == null || a.max_turns_per_run == null) {
    return deny(`${agent} no tiene límites por ejecución definidos`);
  }

  return { allowed: true, reason: "" };
}

// --------------------------------------------------------------------------- ejecución

export function buildCommand(cfg: Config, agent: string, task: string): string[] {
  const a = agentConfig(cfg, agent);
  const cmd = [
    "claude", "-p", task + RESULT_INSTRUCTION,
    "--agent", agent,
    "--output-format", "stream-json", "--verbose", // one event per line: the full trace
    "--model", a.model || cfg.global?.default_model || "sonnet",
    "--max-turns", String(a.max_turns_per_run),
    "--max-budget-usd", Number(a.max_usd_per_run).toFixed(2),
    "--permission-mode", a.permission_mode || "acceptEdits",
    // Only the repo's settings: the person's plugins, MCP servers (Gmail, Drive…) and
    // claude.ai connectors never reach an agent. Project hooks still load.
    "--setting-sources", "project",
    "--strict-mcp-config",
  ];
  if (a.allowed_tools?.length) cmd.push("--allowedTools", ...a.allowed_tools);
  if (a.denied_tools?.length) cmd.push("--disallowedTools", ...a.denied_tools);
  return cmd;
}

// El código de salida no dice si la tarea se hizo: el agente lo declara en su última línea.
// La bitácora se pide aquí y no en cada definición de agente: vale para los que haya mañana.
const RESULT_INSTRUCTION =
  "\n\nSi dejas cambios en el repositorio, antes de terminar registra una entrada en la bitácora " +
  'con `node factory/bitacora.ts add --tipo <decision|hito|nota> --texto "qué has hecho y por qué" ' +
  "[--refs ADR-0001 RF-3]`. Usa `decision` si hay un porqué que recordar, `hito` si terminas algo, " +
  "`nota` para el resto. Los commits y las ejecuciones se importan solos: no los escribas." +
  "\n\nYa estás en la raíz del repositorio: lanza cada comando desde ahí, sin `cd`, sin encadenar " +
  "con `&&` o `;` y sin redirecciones (`>`, `<<`). Esos comandos piden una aprobación que aquí nadie " +
  "da y se rechazan. Para leer ficheros usa Read; para escribirlos, Write o Edit. No hay Python." +
  "\n\nTermina tu respuesta con una última línea exacta: `RESULTADO: ok` si completaste la tarea, " +
  "o `RESULTADO: fallido` si no. Hiciste lo que se pedía y algo quedó pendiente, dudoso o sin " +
  "verificar: eso es `ok`, y lo pendiente va en tu resumen. `fallido` es solo si la tarea no " +
  "está hecha. Quien revise la PR decide si vale; tú informas.";
// Se toma la última línea RESULTADO, no la última línea: WebSearch añade "Sources:" detrás.
const RESULT_LINE = /^\s*RESULTADO:\s*`?(ok|fallido)`?\s*$/gim;
const resultOk = (text: string) => [...text.matchAll(RESULT_LINE)].at(-1)?.[1].toLowerCase() === "ok";

const RATE_LIMIT_MARKERS = ["usage limit", "rate limit", "límite de uso", "try again later"];

export function classify(status: number | null, payload: Record<string, unknown>, stderr: string): string {
  const blob = (JSON.stringify(payload) + " " + (stderr || "")).toLowerCase();
  if (RATE_LIMIT_MARKERS.some((m) => blob.includes(m))) return "rate_limited";
  if (blob.includes("budget limit reached") || (blob.includes("budget") && blob.includes("reached"))) {
    return "budget_exceeded";
  }
  if (status === 0 && !payload.is_error && resultOk(String(payload.result ?? ""))) return "success";
  return "failed";
}

// --------------------------------------------------------------------------- traces

type Event = Record<string, any>;

const events = (stdout: string): Event[] =>
  stdout.split("\n").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });

/** The last `result` event carries cost, turns and the conclusion. Without one, the tail of stdout. */
export function resultEvent(stdout: string): Event {
  return events(stdout).findLast((e) => e.type === "result") ?? { raw: stdout.slice(-2000) };
}

const short = (v: unknown, n = 120) => (typeof v === "string" ? v : JSON.stringify(v)).replaceAll("\n", " ").slice(0, n);

/** One line per tool call, plus agent text, tool errors and the final tally. */
export function formatTrace(stdout: string): string {
  const out: string[] = [];
  let step = 0;
  for (const e of events(stdout)) {
    const content: Event[] = Array.isArray(e.message?.content) ? e.message.content : [];
    for (const c of content) {
      if (e.type === "assistant" && c.type === "tool_use") out.push(`#${++step} ${c.name} → ${short(c.input)}`);
      if (e.type === "assistant" && c.type === "text" && c.text.trim()) out.push(`   texto: ${short(c.text.trim())}`);
      if (e.type === "user" && c.type === "tool_result" && c.is_error) out.push(`   ✗ error: ${short(c.content)}`);
    }
    if (e.type === "result") {
      out.push(`= ${e.subtype} · ${e.num_turns} turnos · ${e.total_cost_usd} USD · ${Math.round(e.duration_ms / 1000)} s`);
    }
  }
  return out.join("\n");
}

export function execute(cfg: Config, agent: string, task: string, now: Clock, dryRun = false): Row {
  const a = agentConfig(cfg, agent);
  const stamp = `${now.day.replaceAll("-", "")}-${now.time.replaceAll(":", "")}`;
  const runId = `${stamp}-${randomUUID().replaceAll("-", "").slice(0, 6)}`;
  const cmd = buildCommand(cfg, agent, task);

  const record: Row = {
    run_id: runId,
    agent,
    task,
    started: now.iso,
    ended: null,
    cost_usd: 0,
    cost_kind: cfg.billing?.mode === "subscription" ? "estimated" : "billed",
    turns: 0,
    outcome: "dry_run",
    model: cmd[cmd.indexOf("--model") + 1],
    pr: null,
  };
  if (dryRun) return { ...record, command: cmd };

  const ws = openWorkspace(runId, agent);
  record.branch = ws.branch;

  const env = {
    ...process.env,
    FACTORY_AGENT: agent,
    FACTORY_RUN_ID: runId,
    FACTORY_REPO: ws.dir,
    FACTORY_LOG_DIR: ACTIONS_DIR, // outside the worktree, which is deleted at the end
    FACTORY_WRITE_PATHS: JSON.stringify(a.write_paths ?? []),
    // The Bash tool sources the person's ~/.zshrc (aliases like ls → eza broke designer runs).
    CLAUDE_CODE_SHELL: "/bin/bash",
  };

  writeFileSync(LOCK, `${runId}\n${agent}\n`, "utf8");
  try {
    const [bin, ...args] = cmd;
    const proc = spawnSync(bin, args, { cwd: ws.dir, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (proc.error) throw proc.error;
    mkdirSync(TRACE_DIR, { recursive: true });
    writeFileSync(join(TRACE_DIR, `${runId}.jsonl`), proc.stdout || "", "utf8");
    const payload = resultEvent(proc.stdout || "");
    const usage = payload.usage ?? {};
    record.session_id = payload.session_id ?? null;
    record.tokens_in = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) +
      (usage.cache_read_input_tokens || 0);
    record.tokens_out = usage.output_tokens || 0;
    record.cost_usd = Math.round(Number(payload.total_cost_usd || 0) * 1e4) / 1e4;
    record.turns = Math.trunc(Number(payload.num_turns || 0));
    record.outcome = classify(proc.status, payload, proc.stderr);
    record.result = String(payload.result || "").slice(-500); // el final: conclusión y RESULTADO
    if (proc.stderr) record.stderr = proc.stderr.slice(-500);
    // Evals run on what the agent left in the worktree, before it is committed and removed.
    const evals = runEvals(agent, ws.dir, changedFiles(ws.dir), a.write_paths ?? [], now.day);
    record.evals = evals;
    if (record.outcome === "success" && evals.failed.length) record.outcome = "eval_failed";
  } finally {
    rmSync(LOCK, { force: true });
    record.ended = clock(new Date(), now.tz).iso;
    const title = `${agent}: ${task.split("\n")[0].slice(0, 60)}`;
    const message = `${title}\n\nRun: ${runId} (${record.outcome})`;
    if (!closeWorkspace(ws, message)) record.branch = null; // no escribió nada: no deja rama

    // Solo se publica lo que salió bien: una tarea fallida deja la rama en local y ya.
    if (record.branch && record.outcome === "success" && cfg.global?.auto_pr) {
      const body = [
        `🏭 Opened automatically by the factory. **Nobody has reviewed this yet.**`,
        ``,
        `- Task: ${task}`,
        `- Run: \`${runId}\` · ${record.cost_usd} USD (${record.cost_kind}) · ${record.turns} turns`,
        `- Agent: \`${agent}\` · model \`${record.model}\` · may only write to ${JSON.stringify(a.write_paths ?? [])}`,
        `- Evals: ${(record.evals as { passed?: number } | undefined)?.passed ?? 0} checks passed`,
        ``,
        `What the agent says:`,
        ``,
        "```",
        String(record.result ?? "").slice(-1500),
        "```",
      ].join("\n");
      record.pr = openPullRequest(ws, title, body);
    }
  }
  return record;
}
