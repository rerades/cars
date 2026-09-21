#!/usr/bin/env python3
"""Lanza una tarea de un agente aplicando los límites de factory/budgets.yaml.

Uso:
    python3 factory/run.py <agente> "<tarea>"
    python3 factory/run.py <agente> "<tarea>" --dry-run   # muestra el comando, no ejecuta
    python3 factory/run.py <agente> "<tarea>" --ignore-window  # ignora el horario nocturno
    python3 factory/run.py --status                      # gasto y ejecuciones del periodo
"""
from __future__ import annotations

import argparse
import json
import sys

import pathlib, sys as _sys
_sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from orchestrator import (  # noqa: E402
    append_ledger, check_can_run, execute, load_config, now_in_tz,
    read_ledger, runs_today, spent_in_period,
)


def cmd_status(cfg: dict) -> int:
    now = now_in_tz(cfg)
    rows = read_ledger(now)
    g = cfg.get("global") or {}
    print(f"Periodo {now:%Y-%m} · hoy {now:%Y-%m-%d %H:%M %Z}")
    print(f"  gasto total: {spent_in_period(rows)} / {g.get('max_usd_per_period')} USD")
    print(f"  ejecuciones hoy: {runs_today(rows, now.date())} / {g.get('max_runs_per_day')}")
    print(f"  horario: {g.get('allowed_hours') or 'sin restricción'}")
    for agent, a in (cfg.get("agents") or {}).items():
        print(f"  - {agent}: {spent_in_period(rows, agent)}/{a.get('max_usd_per_period')} USD · "
              f"{runs_today(rows, now.date(), agent)}/{a.get('max_runs_per_day')} ejecuciones hoy")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Orquestador de la factoría")
    p.add_argument("agent", nargs="?", help="nombre del agente (ver factory/budgets.yaml)")
    p.add_argument("task", nargs="?", help="tarea a ejecutar")
    p.add_argument("--dry-run", action="store_true", help="no ejecuta; muestra el comando")
    p.add_argument("--ignore-window", action="store_true", help="ignora el horario permitido")
    p.add_argument("--status", action="store_true", help="muestra el estado del presupuesto")
    args = p.parse_args(argv)

    cfg = load_config()
    if args.status:
        return cmd_status(cfg)
    if not args.agent or not args.task:
        p.error("hacen falta <agente> y \"<tarea>\"")

    now = now_in_tz(cfg)
    rows = read_ledger(now)
    decision = check_can_run(cfg, args.agent, now, rows, ignore_window=args.ignore_window)
    if not decision.allowed:
        print(f"[bloqueado] {decision.reason}", file=sys.stderr)
        return 3

    record = execute(cfg, args.agent, args.task, now, dry_run=args.dry_run)
    if args.dry_run:
        print(json.dumps(record, ensure_ascii=False, indent=2))
        return 0

    append_ledger(record, now)
    print(f"[{record['outcome']}] {record['run_id']} · {record['cost_usd']} USD · {record['turns']} turnos")
    return 0 if record["outcome"] == "success" else 1


if __name__ == "__main__":
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
    raise SystemExit(main())
