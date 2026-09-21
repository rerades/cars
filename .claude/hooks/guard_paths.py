#!/usr/bin/env python3
"""PreToolUse: bloquea escrituras fuera de las rutas permitidas del agente.

Lee el JSON del hook por stdin. Bloquea con exit 2 y el motivo en stderr.
Las rutas permitidas llegan en FACTORY_WRITE_PATHS (JSON) y el repo en FACTORY_REPO.
Fuera de una ejecución de la factoría (sin FACTORY_AGENT) no bloquea nada.
"""
import json
import os
import re
import sys
from pathlib import Path

WRITE_TOOLS = {"Write", "Edit", "MultiEdit", "NotebookEdit"}

# Nunca, ni siquiera dentro de write_paths: configuración de la factoría y secretos.
PROTECTED = ("factory/", ".claude/", ".git/", ".secrets/", "ops/runs/")

BANNED_BASH = [
    (r"\bgit\s+push\b", "git push está reservado al orquestador"),
    (r"\bgit\s+(checkout|switch)\s+main\b", "no se trabaja directamente sobre main"),
    (r"\brm\s+-rf\b", "borrado recursivo no permitido"),
    (r"\bsudo\b", "sudo no permitido"),
    (r"\.secrets\b", "acceso a secretos no permitido"),
    (r"\bcurl\b[^|]*\|\s*(ba)?sh\b", "descargar y ejecutar no permitido"),
]


def deny(reason: str) -> None:
    print(f"[guard_paths] bloqueado: {reason}", file=sys.stderr)
    sys.exit(2)


def relative(repo: Path, target: str) -> str | None:
    try:
        p = Path(target)
        p = p if p.is_absolute() else repo / p
        return str(p.resolve().relative_to(repo.resolve()))
    except (ValueError, OSError):
        return None  # fuera del repo


def main() -> None:
    agent = os.environ.get("FACTORY_AGENT")
    if not agent:
        sys.exit(0)  # uso interactivo: no aplica

    try:
        event = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    repo = Path(os.environ.get("FACTORY_REPO", "."))
    allowed = json.loads(os.environ.get("FACTORY_WRITE_PATHS", "[]"))
    tool = event.get("tool_name", "")
    tool_input = event.get("tool_input") or {}

    if tool in WRITE_TOOLS:
        target = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
        rel = relative(repo, target)
        if rel is None:
            deny(f"{agent} intenta escribir fuera del repositorio: {target}")
        if any(rel.startswith(p) for p in PROTECTED):
            deny(f"{rel} es una ruta protegida")
        if not any(rel.startswith(p) for p in allowed):
            deny(f"{agent} solo puede escribir en {allowed}; intentaba {rel}")

    elif tool == "Bash":
        command = tool_input.get("command", "")
        for pattern, reason in BANNED_BASH:
            if re.search(pattern, command):
                deny(reason)

    sys.exit(0)


if __name__ == "__main__":
    main()
