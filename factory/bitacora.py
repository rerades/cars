#!/usr/bin/env python3
"""Bitácora del proyecto: registro cronológico de decisiones, hitos y ejecuciones.

Las entradas viven en docs/bitacora/YYYY-MM.md y se versionan con git.

Uso:
    python3 factory/bitacora.py add --tipo decision --texto "..." [--refs PR#2 ADR-0002]
    python3 factory/bitacora.py from-git          # añade los commits aún no registrados
    python3 factory/bitacora.py from-runs         # añade las ejecuciones aún no registradas

`from-git` y `from-runs` son idempotentes: cada entrada lleva su marca (hash del commit o
run_id) y no se duplica al volver a ejecutarlas.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DIARY = REPO / "docs" / "bitacora"

TIPOS = {
    "decision": "🧭 Decisión",
    "hito": "🏁 Hito",
    "commit": "📦 Commit",
    "run": "🤖 Ejecución",
    "nota": "📝 Nota",
}


def month_file(when: datetime) -> Path:
    return DIARY / f"{when:%Y-%m}.md"


def ensure_file(path: Path, when: datetime) -> None:
    if not path.exists():
        DIARY.mkdir(parents=True, exist_ok=True)
        path.write_text(
            f"# Bitácora {when:%Y-%m}\n\n"
            "Entradas en orden cronológico. La genera y actualiza `factory/bitacora.py`.\n\n",
            encoding="utf-8",
        )


def existing_marks(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return set(re.findall(r"<!--\s*id:([^\s>]+)\s*-->", path.read_text(encoding="utf-8")))


def all_marks() -> set[str]:
    marks: set[str] = set()
    for f in sorted(DIARY.glob("*.md")):
        marks |= existing_marks(f)
    return marks


def sort_file(path: Path) -> None:
    """Reordena las entradas del fichero por fecha, manteniendo la cabecera."""
    lines = path.read_text(encoding="utf-8").splitlines()
    head = [l for l in lines if not l.startswith("- **")]
    entries = sorted((l for l in lines if l.startswith("- **")),
                     key=lambda l: l[4:20])
    while head and head[-1] == "":
        head.pop()
    path.write_text("\n".join(head) + "\n\n" + "\n".join(entries) + "\n", encoding="utf-8")


def add_entry(texto: str, tipo: str = "nota", refs: list[str] | None = None,
              mark: str | None = None, when: datetime | None = None) -> bool:
    """Añade una entrada. Devuelve False si esa marca ya estaba registrada."""
    when = when or datetime.now().astimezone()
    if mark and mark in all_marks():
        return False
    path = month_file(when)
    ensure_file(path, when)
    linea = f"- **{when:%Y-%m-%d %H:%M}** · {TIPOS.get(tipo, TIPOS['nota'])} — {texto}"
    if refs:
        linea += f" ({', '.join(refs)})"
    if mark:
        linea += f" <!-- id:{mark} -->"
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(linea + "\n")
    sort_file(path)
    return True


def from_git(limit: int = 50) -> int:
    out = subprocess.run(
        ["git", "log", f"-{limit}", "--reverse", "--date=iso-strict",
         "--pretty=%H%x1f%ad%x1f%s"],
        cwd=REPO, capture_output=True, text=True, check=True).stdout
    added = 0
    for line in out.strip().splitlines():
        sha, fecha, asunto = line.split("\x1f")
        when = datetime.fromisoformat(fecha)
        if add_entry(asunto, "commit", refs=[f"`{sha[:7]}`"], mark=f"git:{sha}", when=when):
            added += 1
    return added


def from_runs() -> int:
    added = 0
    for f in sorted((REPO / "ops" / "runs").glob("*.jsonl")):
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            texto = (f"`{r.get('agent')}` — {r.get('task', '')[:80]} "
                     f"→ **{r.get('outcome')}** ({r.get('cost_usd')} USD, {r.get('turns')} turnos)")
            when = datetime.fromisoformat(r["started"]) if r.get("started") else None
            if add_entry(texto, "run", mark=f"run:{r.get('run_id')}", when=when):
                added += 1
    return added


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Bitácora del proyecto")
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("add", help="añade una entrada manual")
    a.add_argument("--tipo", choices=sorted(TIPOS), default="nota")
    a.add_argument("--texto", required=True)
    a.add_argument("--refs", nargs="*", default=[])

    sub.add_parser("from-git", help="añade los commits aún no registrados")
    sub.add_parser("from-runs", help="añade las ejecuciones aún no registradas")

    args = p.parse_args(argv)
    if args.cmd == "add":
        ok = add_entry(args.texto, args.tipo, args.refs)
        print("entrada añadida" if ok else "ya estaba registrada")
    elif args.cmd == "from-git":
        print(f"{from_git()} commits añadidos")
    elif args.cmd == "from-runs":
        print(f"{from_runs()} ejecuciones añadidas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
