/**
 * Lanza una tarea de un agente aplicando los límites de factory/budgets.yaml.
 *
 * Uso:
 *   node factory/run.ts <agente> "<tarea>"
 *   node factory/run.ts <agente> "<tarea>" --dry-run        # muestra el comando, no ejecuta
 *   node factory/run.ts <agente> "<tarea>" --ignore-window  # ignora el horario nocturno
 *   node factory/run.ts --status                            # gasto y ejecuciones del periodo
 */
import { parseArgs } from "node:util";
import {
  appendLedger, checkCanRun, execute, loadConfig, nowInTz, readLedger, runsToday, spentInPeriod,
  type Config,
} from "./orchestrator.ts";

const USAGE = `uso: node factory/run.ts [--dry-run] [--ignore-window] [--status] [agente] [tarea]

Orquestador de la factoría

  agente           nombre del agente (ver factory/budgets.yaml)
  tarea            tarea a ejecutar
  --dry-run        no ejecuta; muestra el comando
  --ignore-window  ignora el horario permitido
  --status         muestra el estado del presupuesto`;

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
  if (!agent || !task || positionals.length > 2) {
    console.error(`${USAGE}\nerror: hacen falta <agente> y "<tarea>"`);
    return 2;
  }

  const now = nowInTz(cfg);
  const month = now.day.slice(0, 7);
  const rows = readLedger(month);
  const decision = checkCanRun(cfg, agent, now, rows, values["ignore-window"]);
  if (!decision.allowed) {
    console.error(`[bloqueado] ${decision.reason}`);
    return 3;
  }

  const record = execute(cfg, agent, task, now, values["dry-run"]);
  if (values["dry-run"]) {
    console.log(JSON.stringify(record, null, 2));
    return 0;
  }

  appendLedger(record, month);
  console.log(`[${record.outcome}] ${record.run_id} · ${record.cost_usd} USD · ${record.turns} turnos`);
  return record.outcome === "success" ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
