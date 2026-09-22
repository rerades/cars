/**
 * Lanza una tarea de un agente aplicando los límites de factory/budgets.yaml.
 *
 * Uso:
 *   node factory/run.ts <agente> "<tarea>"
 *   node factory/run.ts <agente> "<tarea>" --dry-run        # muestra el comando, no ejecuta
 *   node factory/run.ts <agente> "<tarea>" --ignore-window  # ignora el horario nocturno
 *   node factory/run.ts --status                            # gasto y ejecuciones del periodo
 *   node factory/run.ts --next                              # primera tarea de factory/queue.yaml
 */
import { parseArgs } from "node:util";
import {
  appendLedger, checkCanRun, execute, loadConfig, nowInTz, readLedger, readQueue, runsToday,
  spentInPeriod, writeQueue,
  type Config,
} from "./orchestrator.ts";

const USAGE = `uso: node factory/run.ts [--dry-run] [--ignore-window] [--status] [--next] [agente] [tarea]

Orquestador de la factoría

  agente           nombre del agente (ver factory/budgets.yaml)
  tarea            tarea a ejecutar
  --dry-run        no ejecuta; muestra el comando
  --ignore-window  ignora el horario permitido
  --status         muestra el estado del presupuesto
  --next           lanza la primera tarea de factory/queue.yaml`;

function cmdStatus(cfg: Config): number {
  const now = nowInTz(cfg);
  const rows = readLedger(now.day.slice(0, 7));
  const g = cfg.global ?? {};
  console.log(`Periodo ${now.day.slice(0, 7)} · hoy ${now.day} ${now.time.slice(0, 5)} ${now.tz}`);
  console.log(`  gasto total: ${spentInPeriod(rows)} / ${g.max_usd_per_period} USD`);
  console.log(`  ejecuciones hoy: ${runsToday(rows, now.day)} / ${g.max_runs_per_day}`);
  console.log(`  horario: ${g.allowed_hours || "sin restricción"}`);
  for (const [agent, a] of Object.entries(cfg.agents ?? {})) {
    console.log(`  - ${agent}: ${spentInPeriod(rows, agent)}/${a?.max_usd_per_period} USD · ` +
      `${runsToday(rows, now.day, agent)}/${a?.max_runs_per_day} ejecuciones hoy`);
  }
  return 0;
}

/** Lanza la tarea de un agente y la anota en el ledger. Devuelve el código de salida. */
function runTask(cfg: Config, agent: string, task: string, ignoreWindow: boolean, dryRun: boolean): number {
  const now = nowInTz(cfg);
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

  appendLedger(record, month);
  console.log(`[${record.outcome}] ${record.run_id} · ${record.cost_usd} USD · ${record.turns} turnos` +
    (record.branch ? ` · rama ${record.branch}` : " · sin cambios"));
  return record.outcome === "success" ? 0 : 1;
}

/**
 * Coge la primera tarea de la cola y la lanza. Solo la saca de la cola si llega a
 * ejecutarse: si una guarda la bloquea, se queda para el siguiente intento.
 */
function cmdNext(cfg: Config, ignoreWindow: boolean, dryRun: boolean): number {
  const queue = readQueue();
  const item = queue[0];
  if (!item) {
    console.log("cola vacía");
    return 0;
  }

  const code = runTask(cfg, item.agent, item.task, ignoreWindow, dryRun);
  if (code === 3 || dryRun) return code;
  writeQueue(queue.slice(1));
  console.log(`quedan ${queue.length - 1} tareas en la cola`);
  return code;
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
  if (values.status) return cmdStatus(cfg);
  if (values.next) return cmdNext(cfg, !!values["ignore-window"], !!values["dry-run"]);
  if (!agent || !task || positionals.length > 2) {
    console.error(`${USAGE}\nerror: hacen falta <agente> y "<tarea>"`);
    return 2;
  }

  return runTask(cfg, agent, task, !!values["ignore-window"], !!values["dry-run"]);
}

process.exitCode = main(process.argv.slice(2));
