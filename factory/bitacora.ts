/**
 * Bitácora del proyecto: registro cronológico de decisiones, hitos y ejecuciones.
 *
 * One file per entry: docs/bitacora/YYYY-MM/<YYYY-MM-DDTHHMM>-<id>.md. Two branches that each add
 * an entry create different files, so they never conflict on rebase or merge. Filenames start
 * with the date, so `cat docs/bitacora/YYYY-MM/*.md` prints the month in order. The older
 * docs/bitacora/YYYY-MM.md files (up to 2026-10-05) are no longer written to, but their marks
 * still count.
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
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

/**
 * `when` is an ISO timestamp with offset; the entry is dated by its wall-clock time. An entry with
 * a mark gets a name derived from it, so the same import on two branches writes the same file with
 * the same content (git merges that cleanly). Without a mark, a random suffix keeps names unique.
 */
function entryFile(when: string, mark?: string): string {
  const id = mark ? mark.replace(/[^\w.-]+/g, "-") : randomBytes(4).toString("hex");
  return join(paths.diary, when.slice(0, 7), `${when.slice(0, 10)}T${when.slice(11, 13)}${when.slice(14, 16)}-${id}.md`);
}

/** Marks in every .md under the diary, in the old monthly files and in the per-entry folders. */
function allMarks(): Set<string> {
  if (!existsSync(paths.diary)) return new Set();
  const files = readdirSync(paths.diary, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".md"));
  return new Set(
    files.flatMap((f) =>
      [...readFileSync(join(paths.diary, f), "utf8").matchAll(/<!--\s*id:([^\s>]+)\s*-->/g)].map((m) => m[1])
    ),
  );
}

const localNow = () => clock(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone).iso;

/** Añade una entrada. Devuelve false si esa marca ya estaba registrada. */
export function addEntry(
  texto: string,
  tipo = "nota",
  { refs = [], mark, when = localNow() }: { refs?: string[]; mark?: string; when?: string } = {},
): boolean {
  if (mark && allMarks().has(mark)) return false;
  const path = entryFile(when, mark);
  mkdirSync(dirname(path), { recursive: true });
  let linea = `- **${when.slice(0, 10)} ${when.slice(11, 16)}** · ${TIPOS[tipo] ?? TIPOS.nota} — ${texto}`;
  if (refs.length) linea += ` (${refs.join(", ")})`;
  if (mark) linea += ` <!-- id:${mark} -->`;
  writeFileSync(path, linea + "\n", "utf8");
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
