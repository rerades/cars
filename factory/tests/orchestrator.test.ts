/** Pruebas del orquestador y del hook guardián. Ejecutar: npm test */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  // En -p no hay quien apruebe permisos: sin allowed_tools el agente no puede hacer nada.
  test("todo agente con presupuesto declara sus herramientas", () => {
    for (const [name, a] of Object.entries(orq.loadConfig().agents ?? {})) {
      if (a?.max_usd_per_period == null) continue;   // null = el orquestador no lo lanza
      assert.ok(a.allowed_tools?.length, `${name}: sin allowed_tools en budgets.yaml`);
      // Todo agente registra lo que hace: la bitácora es obligatoria (CLAUDE.md).
      assert.ok(a.write_paths?.includes("docs/bitacora/"), `${name}: sin docs/bitacora/ en write_paths`);
      // Las herramientas se declaran en dos sitios y tienen que cuadrar: el permiso de
      // budgets.yaml no sirve de nada si el `tools:` de la definición no la incluye.
      const def = join(orq.REPO, ".claude", "agents", `${name}.md`);
      if (!existsSync(def)) continue; // agente con presupuesto pero todavía sin definición
      const tools = readFileSync(def, "utf8").match(/^tools:\s*(.+)$/m)?.[1].split(",").map((t) => t.trim());
      for (const permiso of a.allowed_tools ?? []) {
        const tool = permiso.split("(")[0];   // "Bash(gh issue:*)" → "Bash"
        assert.ok(tools?.includes(tool), `${name}: ${tool} está en budgets.yaml pero no en ${name}.md`);
      }
    }
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

describe("traza", () => {
  const stream = [
    JSON.stringify({ type: "system", subtype: "init" }),
    JSON.stringify({ type: "assistant", message: { content: [
      { type: "text", text: "Miro la web.\nSegunda línea" },
      { type: "tool_use", name: "WebFetch", input: { url: "https://www.cupra.com/es-es/" } },
    ] } }),
    JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", is_error: true, content: "403" }] } }),
    JSON.stringify({ type: "result", subtype: "success", num_turns: 2, total_cost_usd: 0.1, duration_ms: 4000,
      result: "RESULTADO: ok", session_id: "s1" }),
    "",
  ].join("\n");

  test("el payload es el último evento result", () => {
    assert.equal(orq.resultEvent(stream).session_id, "s1");
    assert.equal(orq.classify(0, orq.resultEvent(stream), ""), "success");
  });
  test("sin evento result queda la cola de stdout y clasifica como fallo", () => {
    const r = orq.resultEvent("no es json");
    assert.equal(r.raw, "no es json");
    assert.equal(orq.classify(1, r, ""), "failed");
  });
  test("formatTrace resume pasos, errores y total", () => {
    assert.equal(orq.formatTrace(stream), [
      "   texto: Miro la web. Segunda línea",
      "#1 WebFetch → {\"url\":\"https://www.cupra.com/es-es/\"}",
      "   ✗ error: 403",
      "= success · 2 turnos · 0.1 USD · 4 s",
    ].join("\n"));
  });
  test("el comando pide la traza completa", () => {
    const cmd = orq.buildCommand(cfg(), "researcher", "tarea");
    assert.equal(cmd[cmd.indexOf("--output-format") + 1], "stream-json");
    assert.ok(cmd.includes("--verbose"));
  });
});

describe("espacio de trabajo", () => {
  /** Repo de mentira: el agente nunca debe tocar la copia de trabajo de la persona. */
  function repoDeMentira(): string {
    const dir = mkdtempSync(join(tmpdir(), "repo-"));
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
    git("init", "-q", "-b", "base");   // no "main": el hook global de git prohíbe commitear ahí
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "test");
    writeFileSync(join(dir, "data.txt"), "original\n", "utf8");
    git("add", "-A");
    git("commit", "-q", "-m", "inicial");
    return dir;
  }

  const enRepo = (dir: string, ...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();

  test("la rama guarda lo escrito y main no se toca", () => {
    const repo = repoDeMentira();
    const ws = orq.openWorkspace("20260922-000000-abcdef", "researcher", repo);
    assert.equal(ws.branch, "agent/researcher/20260922-000000-abcdef");

    writeFileSync(join(ws.dir, "data.txt"), "lo que escribe el agente\n", "utf8");
    assert.equal(orq.closeWorkspace(ws, "researcher: tarea", repo), true);

    assert.equal(readFileSync(join(repo, "data.txt"), "utf8"), "original\n");
    assert.equal(enRepo(repo, "show", `${ws.branch}:data.txt`), "lo que escribe el agente");
    assert.equal(enRepo(repo, "status", "--porcelain"), "");
    assert.ok(!existsSync(ws.dir));
    rmSync(repo, { recursive: true, force: true });
  });

  test("sin cambios no deja rama", () => {
    const repo = repoDeMentira();
    const ws = orq.openWorkspace("20260922-000000-999999", "researcher", repo);
    assert.equal(orq.closeWorkspace(ws, "researcher: tarea", repo), false);
    assert.equal(enRepo(repo, "branch", "--list", ws.branch), "");
    rmSync(repo, { recursive: true, force: true });
  });

  test("la persona puede tener cambios a medias sin que le afecten", () => {
    const repo = repoDeMentira();
    writeFileSync(join(repo, "data.txt"), "lo que estoy escribiendo yo\n", "utf8");
    const ws = orq.openWorkspace("20260922-000000-777777", "researcher", repo);
    writeFileSync(join(ws.dir, "otro.txt"), "del agente\n", "utf8");
    orq.closeWorkspace(ws, "researcher: tarea", repo);
    assert.equal(readFileSync(join(repo, "data.txt"), "utf8"), "lo que estoy escribiendo yo\n");
    rmSync(repo, { recursive: true, force: true });
  });
});

describe("limpieza de ramas", () => {
  test("borra las fusionadas y deja las que no lo están", () => {
    const repo = mkdtempSync(join(tmpdir(), "repo-"));
    const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
    git("init", "-q", "-b", "base");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "test");
    writeFileSync(join(repo, "data.txt"), "original\n", "utf8");
    git("add", "-A");
    git("commit", "-q", "-m", "inicial");

    // fusionada: apunta al mismo commit que base
    git("branch", "agent/researcher/ya-fusionada");
    // sin fusionar: tiene un commit propio
    git("checkout", "-q", "-b", "agent/researcher/pendiente");
    writeFileSync(join(repo, "data.txt"), "cambio\n", "utf8");
    git("commit", "-qam", "del agente");
    git("checkout", "-q", "base");
    // de una persona, no de un agente: no se toca aunque esté fusionada
    git("branch", "fix/mia");

    assert.deepEqual(orq.pruneMergedBranches(repo, "base"), ["agent/researcher/ya-fusionada"]);
    const quedan = git("branch", "--format=%(refname:short)").split("\n");
    assert.ok(quedan.includes("agent/researcher/pendiente"));
    assert.ok(quedan.includes("fix/mia"));
    assert.ok(!quedan.includes("agent/researcher/ya-fusionada"));
    rmSync(repo, { recursive: true, force: true });
  });

  test("un repo sin nada que limpiar no rompe", () => {
    const repo = mkdtempSync(join(tmpdir(), "repo-"));
    execFileSync("git", ["init", "-q", "-b", "base"], { cwd: repo });
    assert.deepEqual(orq.pruneMergedBranches(repo, "base"), []);
    rmSync(repo, { recursive: true, force: true });
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
    assert.ok(readFileSync(path, "utf8").startsWith("# Cola de tareas"));
    orq.writeQueue([], path);
    assert.deepEqual(orq.readQueue(path), []);
    assert.ok(readFileSync(path, "utf8").startsWith("# Cola de tareas"));   // la cabecera sobrevive a vaciarla
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
  test("bloquea instalar una dependencia sin declararla", () => {
    const bloqueados = [
      "npm install astro", "npm i -D vitest", "npm add tailwindcss", "npx astro add",
      "npm create astro@latest", "pnpm add tailwindcss", "pnpm i -D vitest", "pnpm dlx astro",
      "pnpx astro", "pnx astro", "yarn add astro", "bun add astro", "bunx astro",
      "echo hola; npx astro",   // también detrás de un separador
    ];
    for (const cmd of bloqueados) {
      assert.equal(runHook({ tool_name: "Bash", tool_input: { command: cmd } }).status, 2, cmd);
    }
  });
  test("permite instalar lo ya declarado en package.json", () => {
    const permitidos = [
      "pnpm install", "pnpm install --frozen-lockfile", "pnpm test", "pnpm run build",
      "npm install", "npm ci", "npm test", "npm run build",
      "grep -rn npx .github/",   // hablar de npx no es ejecutarlo
    ];
    for (const cmd of permitidos) {
      assert.equal(runHook({ tool_name: "Bash", tool_input: { command: cmd } }).status, 0, cmd);
    }
  });
  test("bloquea decidir sobre una PR, permite comentarla", () => {
    for (const cmd of ["gh pr merge 50", "gh pr review 50 --approve", "gh pr close 50"]) {
      assert.equal(runHook({ tool_name: "Bash", tool_input: { command: cmd } }).status, 2, cmd);
    }
    assert.equal(runHook({ tool_name: "Bash", tool_input: { command: "gh pr comment 50 --body x" } }).status, 0);
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
