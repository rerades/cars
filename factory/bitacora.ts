/**
 * Bitácora del proyecto: registro cronológico de decisiones, hitos y ejecuciones.
 *
 * Las entradas viven en docs/bitacora/YYYY-MM.md y se versionan con git.
 *
 * Uso:
 *   node factory/bitacora.ts add --tipo decision --texto "..." [--refs PR#2 ADR-0002]
 *   node factory/bitacora.ts from-git          # añade los commits aún no registrados
 *   node factory/bitacora.ts from-runs         # añade las ejecuciones aún no registradas
 *
 * `from-git` y `from-runs` son idempotentes: cada entrada lleva su marca (hash del commit o
 * run_id) y no se duplica al volver a ejecutarlas.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clock, REPO } from "./orchestrator.ts";

/** Rutas mutables para que las pruebas usen un directorio temporal. */
export const paths = {
  diary: join(REPO, "docs", "bitacora"),
  runs: join(REPO, "ops", "runs"),
};

export const TIPOS: Record<string, string> = {
  decision: "🧭 Decisión",
  hito: "🏁 Hito",
  commit: "📦 Commit",
  run: "🤖 Ejecución",
  nota: "📝 Nota",
};

/** `when` es una marca ISO con desfase; la entrada se fecha con su hora de pared. */
const monthFile = (when: string) => join(paths.diary, `${when.slice(0, 7)}.md`);

function ensureFile(path: string, when: string): void {
  if (existsSync(path)) return;
  mkdirSync(paths.diary, { recursive: true });
  writeFileSync(
    path,
    `# Bitácora ${when.slice(0, 7)}\n\n` +
      "Entradas en orden cronológico. La genera y actualiza `factory/bitacora.ts`.\n\n",
    "utf8",
  );
}

function existingMarks(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  return new Set([...readFileSync(path, "utf8").matchAll(/<!--\s*id:([^\s>]+)\s*-->/g)].map((m) => m[1]));
}

function allMarks(): Set<string> {
  if (!existsSync(paths.diary)) return new Set();
  return new Set(
    readdirSync(paths.diary)
      .filter((f) => f.endsWith(".md"))
      .flatMap((f) => [...existingMarks(join(paths.diary, f))]),
  );
}

/** Reordena las entradas del fichero por fecha, manteniendo la cabecera. */
function sortFile(path: string): void {
  const lines = readFileSync(path, "utf8").split("\n");
  const isEntry = (l: string) => l.startsWith("- **");
  const head = lines.filter((l) => !isEntry(l));
  const key = (l: string) => l.slice(4, 20);
  const entries = lines.filter(isEntry).sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  while (head.length && head.at(-1) === "") head.pop();
  writeFileSync(path, head.join("\n") + "\n\n" + entries.join("\n") + "\n", "utf8");
}

const localNow = () => clock(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone).iso;

/** Añade una entrada. Devuelve false si esa marca ya estaba registrada. */
export function addEntry(
  texto: string,
  tipo = "nota",
  { refs = [], mark, when = localNow() }: { refs?: string[]; mark?: string; when?: string } = {},
): boolean {
  if (mark && allMarks().has(mark)) return false;
  const path = monthFile(when);
  ensureFile(path, when);
  let linea = `- **${when.slice(0, 10)} ${when.slice(11, 16)}** · ${TIPOS[tipo] ?? TIPOS.nota} — ${texto}`;
  if (refs.length) linea += ` (${refs.join(", ")})`;
  if (mark) linea += ` <!-- id:${mark} -->`;
  appendFileSync(path, linea + "\n", "utf8");
  sortFile(path);
  return true;
}

export function fromGit(limit = 50): number {
  const out = execFileSync(
    "git",
    ["log", `-${limit}`, "--reverse", "--date=iso-strict", "--pretty=%H%x1f%ad%x1f%s"],
    { cwd: REPO, encoding: "utf8" },
  );
  let added = 0;
  for (const line of out.trim().split("\n").filter(Boolean)) {
    const [sha, fecha, asunto] = line.split("\x1f");
    if (addEntry(asunto, "commit", { refs: [`\`${sha.slice(0, 7)}\``], mark: `git:${sha}`, when: fecha })) {
      added++;
    }
  }
  return added;
}

export function fromRuns(): number {
  if (!existsSync(paths.runs)) return 0;
  let added = 0;
  for (const f of readdirSync(paths.runs).filter((f) => f.endsWith(".jsonl")).sort()) {
    for (const line of readFileSync(join(paths.runs, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      let r: Record<string, unknown>;
      try {
        r = JSON.parse(line);
      } catch {
        continue;
      }
      const texto = `\`${r.agent}\` — ${String(r.task ?? "").slice(0, 80)} ` +
        `→ **${r.outcome}** (${r.cost_usd} USD, ${r.turns} turnos)`;
      const when = typeof r.started === "string" && r.started ? r.started : undefined;
      if (addEntry(texto, "run", { mark: `run:${r.run_id}`, when })) added++;
    }
  }
  return added;
}

const USAGE = `uso: node factory/bitacora.ts <comando>

  add --tipo <${Object.keys(TIPOS).sort().join("|")}> --texto "..." [--refs A B ...]
  from-git     añade los commits aún no registrados
  from-runs    añade las ejecuciones aún no registradas`;

function fail(msg: string): number {
  console.error(`${USAGE}\nerror: ${msg}`);
  return 2;
}

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  if (cmd === "from-git") {
    console.log(`${fromGit()} commits añadidos`);
  } else if (cmd === "from-runs") {
    console.log(`${fromRuns()} ejecuciones añadidas`);
  } else if (cmd === "add") {
    let tipo = "nota";
    let texto: string | undefined;
    const refs: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i];
      if (arg === "--tipo") tipo = rest[++i];
      else if (arg === "--texto") texto = rest[++i];
      else if (arg === "--refs") while (i + 1 < rest.length && !rest[i + 1].startsWith("--")) refs.push(rest[++i]);
      else return fail(`argumento desconocido: ${arg}`);
    }
    if (!(tipo in TIPOS)) return fail(`tipo no válido: ${tipo}`);
    if (!texto) return fail("falta --texto");
    console.log(addEntry(texto, tipo, { refs }) ? "entrada añadida" : "ya estaba registrada");
  } else {
    return fail(cmd ? `comando desconocido: ${cmd}` : "falta el comando");
  }
  return 0;
}

if (process.argv[1] === import.meta.filename) process.exitCode = main(process.argv.slice(2));
