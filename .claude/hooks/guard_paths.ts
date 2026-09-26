/**
 * PreToolUse: bloquea escrituras fuera de las rutas permitidas del agente.
 *
 * Lee el JSON del hook por stdin. Bloquea con exit 2 y el motivo en stderr.
 * Las rutas permitidas llegan en FACTORY_WRITE_PATHS (JSON) y el repo en FACTORY_REPO.
 * Fuera de una ejecución de la factoría (sin FACTORY_AGENT) no bloquea nada.
 * Dentro de una ejecución falla cerrado: cualquier error interno bloquea, porque para
 * Claude Code un hook que termina con otro código distinto de 2 no bloquea.
 */
import { readFileSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

// Nunca, ni siquiera dentro de write_paths: configuración de la factoría y secretos.
const PROTECTED = ["factory/", ".claude/", ".git/", ".secrets/", "ops/runs/"];

const BANNED_BASH: [RegExp, string][] = [
  [/\bgit\s+push\b/, "git push está reservado al orquestador"],
  [/\bgit\s+(checkout|switch)\s+main\b/, "no se trabaja directamente sobre main"],
  [/\brm\s+-rf\b/, "borrado recursivo no permitido"],
  [/\bsudo\b/, "sudo no permitido"],
  [/\.secrets\b/, "acceso a secretos no permitido"],
  [/\bcurl\b[^|]*\|\s*(ba)?sh\b/, "descargar y ejecutar no permitido"],
  // Una dependencia nueva se declara en package.json y se revisa en la PR; `npm install` a
  // secas (sin paquete) sí se permite, es el que instala lo ya declarado.
  // Los flags se saltan: lo que se busca es un paquete suelto detrás del subcomando.
  [/\bnpm\s+(?:i|install|add)\b(?:\s+-{1,2}[\w-]+)*\s+(?!-)\S/,
    "declara la dependencia en package.json y usa `npm install` sin argumentos"],
  [/\bnpx\b|\bnpm\s+(?:create|init|exec)\b/, "ejecutar un paquete que no está en package.json no está permitido"],
  // Revisar es informar: quien decide si una PR entra es una persona.
  [/\bgh\s+pr\s+(?:merge|review|close|ready)\b/, "aprobar, cerrar o fusionar una PR no es de un agente"],
];

function deny(reason: string): never {
  process.stderr.write(`[guard_paths] bloqueado: ${reason}\n`);
  process.exit(2);
}

/** realpath que admite rutas que aún no existen: resuelve el antecesor que sí existe. */
function real(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    const parent = dirname(p);
    return parent === p ? p : join(real(parent), basename(p));
  }
}

/** Ruta relativa al repo, o null si queda fuera. */
function relativeToRepo(repo: string, target: string): string | null {
  const root = real(repo);
  const rel = relative(root, real(isAbsolute(target) ? target : resolve(repo, target)));
  return rel.startsWith("..") || isAbsolute(rel) ? null : rel;
}

function main(agent: string): void {
  const event = JSON.parse(readFileSync(0, "utf8"));
  const repo = process.env.FACTORY_REPO || ".";
  const allowed: string[] = JSON.parse(process.env.FACTORY_WRITE_PATHS || "[]");
  const tool: string = event.tool_name ?? "";
  const input = event.tool_input ?? {};

  if (WRITE_TOOLS.has(tool)) {
    const target: string = input.file_path || input.notebook_path || "";
    const rel = relativeToRepo(repo, target);
    if (rel === null) deny(`${agent} intenta escribir fuera del repositorio: ${target}`);
    if (PROTECTED.some((p) => rel.startsWith(p))) deny(`${rel} es una ruta protegida`);
    if (!allowed.some((p) => rel.startsWith(p))) {
      deny(`${agent} solo puede escribir en ${JSON.stringify(allowed)}; intentaba ${rel}`);
    }
  } else if (tool === "Bash") {
    const command: string = input.command ?? "";
    for (const [pattern, reason] of BANNED_BASH) if (pattern.test(command)) deny(reason);
  }
}

const agent = process.env.FACTORY_AGENT;
if (agent) {
  try {
    main(agent);
  } catch (e) {
    deny(`error interno del guardián: ${(e as Error).message}`);
  }
}
