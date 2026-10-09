/**
 * Lanza una tarea de un agente aplicando los límites de factory/budgets.yaml.
 *
 * Uso:
 *   node factory/run.ts <agente> "<tarea>"
 *   node factory/run.ts <agente> "<tarea>" --dry-run        # muestra el comando, no ejecuta
 *   node factory/run.ts <agente> "<tarea>" --ignore-window  # ignora el horario nocturno
 *   node factory/run.ts --status                            # gasto y ejecuciones del periodo
 *   node factory/run.ts --next                              # primera tarea pendiente de la cola
 *   node factory/run.ts --task <id>                         # esa tarea pendiente de la cola
 *   node factory/run.ts --trace <run_id>                    # pasos de una ejecución
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { exportRun } from "./langfuse.ts";
import {
  appendLedger, checkCanRun, commitState, execute, formatTrace, loadConfig, mergeStatePr, nowInTz, pruneMergedBranches, queueState, readAllLedger,
  readLedger, readQueue, REPO, runsToday, spentInPeriod, STATE_BRANCH, syncState, TRACE_DIR,
  type Config,
} from "./orchestrator.ts";

const USAGE = `uso: node factory/run.ts [--dry-run] [--ignore-window] [--status] [--next] [--task <id>] [--merge-state] [--trace <run_id>] [agente] [tarea]

Orquestador de la factoría

  agente           nombre del agente (ver factory/budgets.yaml)
  tarea            tarea a ejecutar
  --dry-run        no ejecuta; muestra el comando
  --ignore-window  ignora el horario permitido
  --status         muestra el estado del presupuesto
  --next           lanza la primera tarea pendiente de factory/queue.yaml
  --task <id>      lanza esa tarea de factory/queue.yaml, si está pendiente
  --merge-state    fusiona la PR de estado si cumple la regla de ADR-0013
  --trace <run_id> muestra los pasos de una ejecución (ops/traces/)`;

function cmdStatus(cfg: Config): number {
  const blocked = syncState();
  if (blocked) console.error(`[aviso] ${blocked}`);
  const now = nowInTz(cfg);
  const rows = readLedger(now.day.slice(0, 7));
  const g = cfg.global ?? {};
  console.log(`Periodo ${now.day.slice(0, 7)} · hoy ${now.day} ${now.time.slice(0, 5)} ${now.tz}`);
  console.log(`  gasto total: ${spentInPeriod(rows)} / ${g.max_usd_per_period} USD`);
  console.log(`  ejecuciones hoy: ${runsToday(rows, now.day)} / ${g.max_runs_per_day}`);
  console.log(`  horario: ${g.allowed_hours || "sin restricción"}`);
  for (const [agent, a] of Object.entries(cfg.agents ?? {})) {
    const evaluated = rows.filter((r) => r.agent === agent && r.evals) as { evals: { failed: string[] } }[];
    const passed = evaluated.filter((r) => !r.evals.failed.length).length;
    console.log(`  - ${agent}: ${spentInPeriod(rows, agent)}/${a?.max_usd_per_period} USD · ` +
      `${runsToday(rows, now.day, agent)}/${a?.max_runs_per_day} ejecuciones hoy` +
      (evaluated.length ? ` · evals ${passed}/${evaluated.length}` : ""));
  }
  const { pending, failed } = queueState(readQueue(), readAllLedger());
  console.log(`  cola: ${pending.length} pendientes`);
  for (const t of pending) console.log(`    - ${t.id} (${t.agent})`);
  if (failed.length) {
    console.log(`  fallidas (no se reintentan; para repetir, encolar con un id nuevo):`);
    for (const r of failed) console.log(`    - ${r.task_id} · ${r.outcome} · ${r.run_id}`);
  }
  console.log(`  estado: rama ${STATE_BRANCH} (ADR-0013)`);
  return 0;
}

/** Merges the state PR when ADR-0013 allows it; also run by the merge-state-pr workflow. */
function cmdMergeState(cfg: Config): number {
  const merged = mergeStatePr(existsSync(join(REPO, cfg.global?.stop_file || "factory/STOP")));
  if (merged) console.log(merged);
  return 0;
}

/** Lanza la tarea de un agente y la anota en el ledger. Devuelve el código de salida. */
function runTask(cfg: Config, agent: string, task: string, ignoreWindow: boolean, dryRun: boolean,
  taskId: string | null = null): number {
  const now = nowInTz(cfg);
  if (!dryRun) {
    const borradas = pruneMergedBranches();
    if (borradas.length) console.log(`ramas ya fusionadas borradas: ${borradas.join(", ")}`);
    cmdMergeState(cfg);
  }
  const blocked = syncState();
  if (blocked) {
    console.error(`[bloqueado] ${blocked}`);
    return 3;
  }
  const month = now.day.slice(0, 7);
  const decision = checkCanRun(cfg, agent, now, readLedger(month), ignoreWindow);
  if (!decision.allowed) {
    console.error(`[bloqueado] ${decision.reason}`);
    return 3;
  }

  const record = execute(cfg, agent, task, now, dryRun);
  if (dryRun) {
    console.log(JSON.stringify(record, null, 2));
    return 0;
  }

  record.task_id = taskId;
  appendLedger(record, month);
  // ponytail: outside the lock (ADR-0013 asks for it under the lock); fine while launchd runs one
  // --next at a time, take the lock here if two runs can ever overlap.
  const statePr = commitState(record.run_id as string);
  if (statePr) console.log(`estado: ${statePr}`);
  // Not awaited: node waits for it before exiting, and it never throws.
  void exportRun(record).then((line) => line && console.log(line));
  console.log(`[${record.outcome}] ${record.run_id} · ${record.cost_usd} USD · ${record.turns} turnos` +
    (record.branch ? ` · rama ${record.branch}` : " · sin cambios") +
    (record.pr ? ` · ${record.pr}` : ""));
  return record.outcome === "success" ? 0 : 1;
}

/**
 * Runs the first pending task: the first one in the queue without a ledger row (ADR-0013),
 * or the pending task with that id.
 * A blocked run writes no row, so the task stays pending; a failed one is consumed and listed
 * by --status, so it is neither lost nor retried in a loop.
 */
function cmdNext(cfg: Config, ignoreWindow: boolean, dryRun: boolean, id?: string): number {
  const blocked = syncState();
  if (blocked) {
    console.error(`[bloqueado] ${blocked}`);
    return 3;
  }
  const { pending } = queueState(readQueue(), readAllLedger());
  const item = id ? pending.find((t) => t.id === id) : pending[0];
  if (id && !item) {
    console.error(`la tarea ${id} no está pendiente en la cola (ver --status)`);
    return 2;
  }
  if (!item) {
    console.log("cola vacía");
    return 0;
  }

  const code = runTask(cfg, item.agent, item.task, ignoreWindow, dryRun, item.id);
  if (code === 3 || dryRun) return code;
  if (code !== 0) console.log(`la tarea ${item.id} ha fallado: no se reintenta (ver --status)`);
  console.log(`quedan ${pending.length - 1} tareas pendientes`);
  return code;
}

function cmdTrace(runId: string): number {
  const path = join(TRACE_DIR, `${runId}.jsonl`);
  if (!existsSync(path)) {
    console.error(`no hay traza para ${runId} en ops/traces/`);
    return 2;
  }
  console.log(formatTrace(readFileSync(path, "utf8")));
  return 0;
}

function main(argv: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        "dry-run": { type: "boolean" },
        "ignore-window": { type: "boolean" },
        status: { type: "boolean" },
        next: { type: "boolean" },
        task: { type: "string" },
        "merge-state": { type: "boolean" },
        trace: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (e) {
    console.error(`${USAGE}\nerror: ${(e as Error).message}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  const [agent, task] = positionals;

  const cfg = loadConfig();
  if (values.trace) return cmdTrace(values.trace);
  if (values.status) return cmdStatus(cfg);
  if (values["merge-state"]) return cmdMergeState(cfg);
  if (values.next || values.task) return cmdNext(cfg, !!values["ignore-window"], !!values["dry-run"], values.task);
  if (!agent || !task || positionals.length > 2) {
    console.error(`${USAGE}\nerror: hacen falta <agente> y "<tarea>"`);
    return 2;
  }

  return runTask(cfg, agent, task, !!values["ignore-window"], !!values["dry-run"]);
}

process.exitCode = main(process.argv.slice(2));
