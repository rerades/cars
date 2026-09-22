/**
 * Lógica del orquestador de la factoría.
 *
 * Aplica lo definido en docs/architecture/adr/0002-presupuesto-control-observabilidad.md:
 * interruptor de parada, horario, concurrencia, límites diarios y presupuesto del periodo.
 * El CLI está en factory/run.ts.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse, stringify } from "yaml";

export const REPO = join(import.meta.dirname, "..");
export const BUDGETS = join(REPO, "factory", "budgets.yaml");
export const LEDGER_DIR = join(REPO, "ops", "runs");
export const LOCK = join(REPO, "factory", ".run.lock");
/** FACTORY_QUEUE existe para las pruebas; en uso normal la cola es factory/queue.yaml. */
export const QUEUE = process.env.FACTORY_QUEUE || join(REPO, "factory", "queue.yaml");

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

// --------------------------------------------------------------------------- cola

export interface QueueItem {
  agent: string;
  task: string;
}

/** Lista de tareas pendientes, en orden. Una cola vacía o inexistente devuelve []. */
export function readQueue(path = QUEUE): QueueItem[] {
  if (!existsSync(path)) return [];
  const items = parse(readFileSync(path, "utf8")) ?? [];
  if (!Array.isArray(items)) throw new Error(`${path}: se esperaba una lista de tareas`);
  items.forEach((item, i) => {
    if (!item?.agent || !item?.task) throw new Error(`${path}: la tarea ${i + 1} necesita agent y task`);
  });
  return items;
}

export function writeQueue(items: QueueItem[], path = QUEUE): void {
  writeFileSync(path, items.length ? stringify(items) : "[]\n", "utf8");
}

// --------------------------------------------------------------------------- ledger

/** `month` en formato YYYY-MM. */
export function ledgerPath(month: string): string {
  return join(LEDGER_DIR, `${month}.jsonl`);
}

export function readLedger(month: string): Row[] {
  const path = ledgerPath(month);
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

export function appendLedger(record: Row, month: string): void {
  mkdirSync(LEDGER_DIR, { recursive: true });
  appendFileSync(ledgerPath(month), JSON.stringify(record) + "\n", "utf8");
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
    "--output-format", "json",
    "--model", a.model || cfg.global?.default_model || "sonnet",
    "--max-turns", String(a.max_turns_per_run),
    "--max-budget-usd", Number(a.max_usd_per_run).toFixed(2),
    "--permission-mode", a.permission_mode || "acceptEdits",
  ];
  if (a.allowed_tools?.length) cmd.push("--allowedTools", ...a.allowed_tools);
  if (a.denied_tools?.length) cmd.push("--disallowedTools", ...a.denied_tools);
  return cmd;
}

// El código de salida no dice si la tarea se hizo: el agente lo declara en su última línea.
const RESULT_INSTRUCTION =
  "\n\nTermina tu respuesta con una última línea exacta: `RESULTADO: ok` si completaste la tarea, " +
  "o `RESULTADO: fallido` si no.";
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

  const env = {
    ...process.env,
    FACTORY_AGENT: agent,
    FACTORY_RUN_ID: runId,
    FACTORY_REPO: REPO,
    FACTORY_WRITE_PATHS: JSON.stringify(a.write_paths ?? []),
  };

  writeFileSync(LOCK, `${runId}\n${agent}\n`, "utf8");
  try {
    const [bin, ...args] = cmd;
    const proc = spawnSync(bin, args, { cwd: REPO, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (proc.error) throw proc.error;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(proc.stdout || "{}");
    } catch {
      payload = { raw: (proc.stdout || "").slice(-2000) };
    }
    record.cost_usd = Math.round(Number(payload.total_cost_usd || 0) * 1e4) / 1e4;
    record.turns = Math.trunc(Number(payload.num_turns || 0));
    record.outcome = classify(proc.status, payload, proc.stderr);
    record.result = String(payload.result || "").slice(-500); // el final: conclusión y RESULTADO
    if (proc.stderr) record.stderr = proc.stderr.slice(-500);
  } finally {
    rmSync(LOCK, { force: true });
    record.ended = clock(new Date(), now.tz).iso;
  }
  return record;
}
