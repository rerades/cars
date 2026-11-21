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
  // Una dependencia nueva se declara en package.json y se revisa en la PR; `pnpm install` a
  // secas (sin paquete) sí se permite, es el que instala lo ya declarado. Las reglas de npm se
  // conservan aunque el gestor sea pnpm (ADR-0007): si no, `npm install x` reintroduce un
  // package-lock.json por la puerta de atrás.
  // Los flags se saltan: lo que se busca es un paquete suelto detrás del subcomando.
  // Only at the start of the command or after a separator (newline included): text that mentions
  // `pnpm install` (a bitácora entry, a grep) runs nothing.
  [/(?:^|[;&|(\n]\s*)(?:npm|pnpm|yarn|bun)\s+(?:i|in|install|add)\b(?:\s+-{1,2}[\w-]+)*\s+(?!-)[^\s;&|)]/,
    "declara la dependencia en package.json y usa `pnpm install` sin argumentos"],
  [/(?:^|[;&|(\n]\s*)(?:(?:npx|pnpx|pnx|bunx)\b|(?:npm|pnpm|bun)\s+(?:create|init|exec|dlx)\b|yarn\s+dlx\b)/,
    "ejecutar un paquete que no está en package.json no está permitido"],
  // Revisar es informar: quien decide si una PR entra es una persona.
  [/\bgh\s+pr\s+(?:merge|review|close|ready)\b/, "aprobar, cerrar o fusionar una PR no es de un agente"],
];

// An agent reaches the network only through factory/fetch-*.ts, which check the source registry
// and robots.txt (ADR-0001). A `Bash(x:*)` rule matches the start of the line, so
// `node factory/fetch-idae.ts X; for u in …; do curl` passed it (PR #824), and curl alone ran too.
// Matched at command position (start, after a separator or a shell keyword) in the command with its
// quoted text removed: a bitácora entry or a PR comment that mentions curl runs nothing.
const NETWORK = /(?:^|[;&|(\n]|\bdo\b|\bthen\b|\belse\b)\s*(?:\S*\/)?(?:curl|wget|nc|ncat|socat|telnet|ssh|scp|sftp|ftp|rsync)\b/;

// Inline code with network APIs: `Bash(node:*)` would let `node -e "fetch(…)"` skip ADR-0001.
// ponytail: a script written to disk and then run with node is not seen; a network sandbox would.
const NODE_EVAL_NET = /(?:^|[;&|(\n]\s*)node\s+(?:-e|--eval|-p|--print)\b[\s\S]*(?:\b(?:fetch|https?\.(?:get|request)|WebSocket|net\.connect|node:(?:https?|net|dgram))\b|['"](?:https?|net|dgram|undici)['"])/;

// A shell redirection (`>`, `>>`, `tee`) to an absolute path, `~` or `..`. Writes inside the
// worktree are caught after the run by the write_paths eval; these would land outside it.
const REDIRECT = /(?:^|[^<>&\d])\d?>>?\|?\s*([~/][^\s;&|()<>]*|\.\.\/[^\s;&|()<>]*)|\btee\s+(?:-a\s+)?([~/][^\s;&|()<>]*|\.\.\/[^\s;&|()<>]*)/g;
const SCRATCH = ["/dev/", "/tmp/", "/private/tmp/", "/var/folders/"];

/** Heredoc bodies are text, not commands: `a > /b` inside one writes nothing. */
function withoutHeredocs(command: string): string {
  return command.replace(/<<-?\s*(['"]?)(\w+)\1([^\n]*\n)[\s\S]*?\n\s*\2(?=\n|$)/g, (_m, _q, tag, head) => `<<${tag}${head}`);
}

/** The command without its quoted text, except double quotes that run something (`"$(…)"`, backticks). */
function unquoted(command: string): string {
  return command
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:[^"\\$`]|\\.)*"/g, '""');
}

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
    if (NETWORK.test(unquoted(command)) || NODE_EVAL_NET.test(command)) {
      deny("la red solo con factory/fetch-page.ts, fetch-idae.ts o fetch-image.ts (ADR-0001)");
    }
    for (const m of unquoted(withoutHeredocs(command)).matchAll(REDIRECT)) {
      const target = m[1] ?? m[2];
      if (target.startsWith("~")) deny(`${agent} intenta escribir fuera del repositorio: ${target}`);
      const abs = real(isAbsolute(target) ? target : resolve(repo, target));
      if (SCRATCH.some((d) => abs.startsWith(d) || target.startsWith(d)) || relativeToRepo(repo, abs) !== null) continue;
      deny(`${agent} intenta escribir fuera del repositorio: ${target}`);
    }
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
