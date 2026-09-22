/** Pruebas del orquestador y del hook guardián. Ejecutar: npm test */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as orq from "../orchestrator.ts";

const TZ = "Europe/Madrid";
const at = (iso: string) => orq.clock(new Date(iso), TZ);

function cfg(over: { global?: object; agents?: object } = {}): orq.Config {
  return {
    billing: { mode: "subscription" },
    global: {
      max_concurrent_runs: 1, max_runs_per_day: 6,
      allowed_hours: "01:00-07:00", timezone: TZ,
      default_model: "sonnet", period: "monthly",
      max_usd_per_period: 20, stop_file: "factory/STOP",
      ...over.global,
    },
    agents: {
      researcher: {
        max_runs_per_day: 2, max_usd_per_period: 10,
        max_usd_per_run: 1.0, max_turns_per_run: 25,
        write_paths: ["data/"],
        ...over.agents,
      },
    },
  };
}

const row = (agent = "researcher", day = "2026-09-21", cost = 0.5): orq.Row =>
  ({ agent, started: `${day}T02:00:00+02:00`, cost_usd: cost });

describe("reloj", () => {
  test("hora de pared y desfase en la zona", () => {
    assert.equal(at("2026-09-21T00:30:00Z").iso, "2026-09-21T02:30:00+02:00");
    assert.equal(orq.clock(new Date("2026-01-05T10:00:00Z"), "UTC").iso, "2026-01-05T10:00:00+00:00");
  });
});

describe("ventana horaria", () => {
  test("dentro de ventana nocturna", () => {
    assert.ok(orq.inWindow(at("2026-09-21T02:30:00+02:00"), "01:00-07:00"));
  });
  test("fuera de ventana", () => {
    assert.ok(!orq.inWindow(at("2026-09-21T10:00:00+02:00"), "01:00-07:00"));
  });
  test("límites de la ventana", () => {
    assert.ok(orq.inWindow(at("2026-09-21T01:00:00+02:00"), "01:00-07:00"));
    assert.ok(!orq.inWindow(at("2026-09-21T07:00:00+02:00"), "01:00-07:00"));
  });
  test("ventana que cruza medianoche", () => {
    assert.ok(orq.inWindow(at("2026-09-21T23:30:00+02:00"), "22:00-06:00"));
    assert.ok(orq.inWindow(at("2026-09-21T05:00:00+02:00"), "22:00-06:00"));
    assert.ok(!orq.inWindow(at("2026-09-21T12:00:00+02:00"), "22:00-06:00"));
  });
  test("sin ventana siempre permitido", () => {
    assert.ok(orq.inWindow(at("2026-09-21T12:00:00+02:00"), null));
  });
});

describe("ledger", () => {
  test("cuenta ejecuciones del día", () => {
    const rows = [row(undefined, "2026-09-21"), row(undefined, "2026-09-21"), row(undefined, "2026-09-20")];
    assert.equal(orq.runsToday(rows, "2026-09-21"), 2);
  });
  test("cuenta por agente", () => {
    assert.equal(orq.runsToday([row(), row("developer")], "2026-09-21", "researcher"), 1);
  });
  test("suma gasto", () => {
    assert.equal(orq.spentInPeriod([row(undefined, undefined, 0.5), row(undefined, undefined, 0.25)]), 0.75);
  });
  test("línea corrupta no rompe", () => {
    const path = orq.ledgerPath("2026-01");
    mkdirSync(orq.LEDGER_DIR, { recursive: true });
    writeFileSync(path, '{"agent":"x","cost_usd":1}\nno-es-json\n', "utf8");
    try {
      assert.equal(orq.readLedger("2026-01").length, 1);
    } finally {
      rmSync(path);
    }
  });
});

describe("guardas", () => {
  const NOCHE = at("2026-09-21T02:00:00+02:00");
  const MEDIODIA = at("2026-09-21T12:00:00+02:00");

  test("permite en condiciones normales", () => {
    assert.ok(orq.checkCanRun(cfg(), "researcher", NOCHE, []).allowed);
  });
  test("bloquea fuera de horario", () => {
    const d = orq.checkCanRun(cfg(), "researcher", MEDIODIA, []);
    assert.ok(!d.allowed);
    assert.match(d.reason, /horario/);
  });
  test("ignore window", () => {
    assert.ok(orq.checkCanRun(cfg(), "researcher", MEDIODIA, [], true).allowed);
  });
  test("bloquea por límite diario del agente", () => {
    const d = orq.checkCanRun(cfg(), "researcher", NOCHE, [row(), row()]);
    assert.ok(!d.allowed);
    assert.match(d.reason, /límite diario de researcher/);
  });
  test("bloquea por límite diario global", () => {
    const rows = Array.from({ length: 6 }, (_, i) => row(`a${i}`, undefined, 0));
    const d = orq.checkCanRun(cfg({ agents: { max_runs_per_day: 99 } }), "researcher", NOCHE, rows);
    assert.ok(!d.allowed);
    assert.match(d.reason, /global/);
  });
  test("bloquea por presupuesto del agente", () => {
    const d = orq.checkCanRun(cfg(), "researcher", NOCHE, [row(undefined, "2026-09-01", 10)]);
    assert.ok(!d.allowed);
    assert.match(d.reason, /presupuesto de researcher/);
  });
  test("bloquea sin presupuesto asignado", () => {
    const c = cfg({ agents: { max_usd_per_period: null } });
    assert.ok(!orq.checkCanRun(c, "researcher", NOCHE, []).allowed);
  });
  test("bloquea con stop file", () => {
    const stop = join(orq.REPO, "factory", "STOP");
    writeFileSync(stop, "test", "utf8");
    try {
      const d = orq.checkCanRun(cfg(), "researcher", NOCHE, []);
      assert.ok(!d.allowed);
      assert.match(d.reason, /parada/);
    } finally {
      rmSync(stop);
    }
  });
  test("bloquea con ejecución en curso", () => {
    writeFileSync(orq.LOCK, "test", "utf8");
    try {
      const d = orq.checkCanRun(cfg(), "researcher", NOCHE, []);
      assert.ok(!d.allowed);
      assert.match(d.reason, /en curso/);
    } finally {
      rmSync(orq.LOCK);
    }
  });
  test("agente desconocido", () => {
    assert.throws(() => orq.checkCanRun(cfg(), "fantasma", NOCHE, []), /agente desconocido/);
  });
});

describe("comando", () => {
  test("incluye límites", () => {
    const cmd = orq.buildCommand(cfg(), "researcher", "tarea");
    const after = (flag: string) => cmd[cmd.indexOf(flag) + 1];
    assert.equal(after("--max-turns"), "25");
    assert.equal(after("--max-budget-usd"), "1.00");
    assert.equal(after("--agent"), "researcher");
    assert.equal(after("--model"), "sonnet");
    assert.match(after("-p"), /^tarea\n\n.*RESULTADO: ok/s);
  });
  test("clasifica resultados", () => {
    assert.equal(orq.classify(0, { is_error: false, result: "Hecho.\nRESULTADO: ok" }, ""), "success");
    assert.equal(orq.classify(0, { is_error: false, result: "No pude.\nRESULTADO: fallido" }, ""), "failed");
    assert.equal(orq.classify(0, { is_error: false, result: "sin marca" }, ""), "failed");
    const conFuentes = "Hecho.\n\nRESULTADO: ok\n\nSources:\n- [CUPRA](https://www.cupra.com/es-es/)";
    assert.equal(orq.classify(0, { is_error: false, result: conFuentes }, ""), "success");
    assert.equal(orq.classify(0, { is_error: false, result: "RESULTADO: ok\nal final no\nRESULTADO: fallido" }, ""), "failed");
    assert.equal(orq.classify(1, { is_error: true }, ""), "failed");
    assert.equal(orq.classify(1, {}, "Claude usage limit reached"), "rate_limited");
    assert.equal(orq.classify(1, { result: "Budget limit reached" }, ""), "budget_exceeded");
  });
  test("el dry-run no ejecuta y devuelve el comando", () => {
    const r = orq.execute(cfg(), "researcher", "tarea", at("2026-09-21T02:00:00+02:00"), true);
    assert.equal(r.outcome, "dry_run");
    assert.match(String(r.run_id), /^20260921-020000-[0-9a-f]{6}$/);
    assert.equal(r.started, "2026-09-21T02:00:00+02:00");
  });
});

describe("cola", () => {
  const tmp = () => join(mkdtempSync(join(tmpdir(), "cola-")), "queue.yaml");

  test("cola inexistente o vacía", () => {
    assert.deepEqual(orq.readQueue(join(tmpdir(), "no-existe-cola.yaml")), []);
    const path = tmp();
    writeFileSync(path, "[]\n", "utf8");
    assert.deepEqual(orq.readQueue(path), []);
  });

  test("lee las tareas en orden", () => {
    const path = tmp();
    writeFileSync(path, "- agent: researcher\n  task: una\n- agent: developer\n  task: otra\n", "utf8");
    assert.deepEqual(orq.readQueue(path), [
      { agent: "researcher", task: "una" },
      { agent: "developer", task: "otra" },
    ]);
  });

  test("rechaza una tarea incompleta", () => {
    const path = tmp();
    writeFileSync(path, "- agent: researcher\n", "utf8");
    assert.throws(() => orq.readQueue(path), /la tarea 1 necesita agent y task/);
  });

  test("escribir y volver a leer", () => {
    const path = tmp();
    const items = [{ agent: "researcher", task: "con: dos puntos y #almohadilla" }];
    orq.writeQueue(items, path);
    assert.deepEqual(orq.readQueue(path), items);
    orq.writeQueue([], path);
    assert.deepEqual(orq.readQueue(path), []);
  });

  test("una tarea bloqueada no se pierde", () => {
    const path = tmp();
    const cola = "- agent: researcher\n  task: no debe ejecutarse\n";
    writeFileSync(path, cola, "utf8");
    const stop = join(orq.REPO, "factory", "STOP");
    writeFileSync(stop, "test", "utf8");
    try {
      const r = spawnSync(process.execPath, [join(orq.REPO, "factory", "run.ts"), "--next"], {
        encoding: "utf8",
        env: { ...process.env, FACTORY_QUEUE: path },
      });
      assert.equal(r.status, 3);
      assert.match(r.stderr, /parada/);
      assert.equal(readFileSync(path, "utf8"), cola);
    } finally {
      rmSync(stop);
    }
  });

  test("cola vacía no ejecuta nada", () => {
    const path = tmp();
    writeFileSync(path, "[]\n", "utf8");
    const r = spawnSync(process.execPath, [join(orq.REPO, "factory", "run.ts"), "--next"], {
      encoding: "utf8",
      env: { ...process.env, FACTORY_QUEUE: path },
    });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /cola vacía/);
  });
});

describe("hook guardián", () => {
  const HOOK = join(orq.REPO, ".claude", "hooks", "guard_paths.ts");

  function runHook(event: unknown, paths = ["data/"], env: NodeJS.ProcessEnv = {}) {
    return spawnSync(process.execPath, [HOOK], {
      input: typeof event === "string" ? event : JSON.stringify(event),
      encoding: "utf8",
      env: {
        ...process.env,
        FACTORY_AGENT: "researcher",
        FACTORY_REPO: orq.REPO,
        FACTORY_WRITE_PATHS: JSON.stringify(paths),
        ...env,
      },
    });
  }

  test("permite escritura en ruta propia", () => {
    assert.equal(runHook({ tool_name: "Write", tool_input: { file_path: "data/raw/tesla/model-3.yaml" } }).status, 0);
  });
  test("bloquea escritura fuera de su ruta", () => {
    const r = runHook({ tool_name: "Write", tool_input: { file_path: "src/app.tsx" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /solo puede escribir/);
  });
  test("bloquea ruta protegida", () => {
    const r = runHook({ tool_name: "Edit", tool_input: { file_path: "factory/budgets.yaml" } }, ["data/", "factory/"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /protegida/);
  });
  test("bloquea fuera del repositorio", () => {
    assert.equal(runHook({ tool_name: "Write", tool_input: { file_path: "/etc/passwd" } }).status, 2);
    assert.equal(runHook({ tool_name: "Write", tool_input: { file_path: "data/../../fuera.txt" } }).status, 2);
  });
  test("bloquea git push", () => {
    assert.equal(runHook({ tool_name: "Bash", tool_input: { command: "git push origin main" } }).status, 2);
  });
  test("bloquea acceso a secretos", () => {
    assert.equal(runHook({ tool_name: "Bash", tool_input: { command: "cat .secrets/gh_token" } }).status, 2);
  });
  test("permite bash normal", () => {
    assert.equal(runHook({ tool_name: "Bash", tool_input: { command: "ls data/" } }).status, 0);
  });
  test("falla cerrado ante entrada inválida", () => {
    const r = runHook("no-es-json");
    assert.equal(r.status, 2);
    assert.match(r.stderr, /error interno/);
  });
  test("no aplica en uso interactivo", () => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("FACTORY_")));
    const r = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ tool_name: "Write", tool_input: { file_path: "/etc/passwd" } }),
      encoding: "utf8",
      env,
    });
    assert.equal(r.status, 0);
  });
});
