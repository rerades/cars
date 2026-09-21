"""Lógica del orquestador de la factoría.

Aplica lo definido en docs/architecture/adr/0002-presupuesto-control-observabilidad.md:
interruptor de parada, horario, concurrencia, límites diarios y presupuesto del periodo.
El CLI está en factory/run.py.
"""
from __future__ import annotations

import json
import os
import subprocess
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, date, time as dtime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

REPO = Path(__file__).resolve().parent.parent
BUDGETS = REPO / "factory" / "budgets.yaml"
LEDGER_DIR = REPO / "ops" / "runs"
LOCK = REPO / "factory" / ".run.lock"


# --------------------------------------------------------------------------- config

def load_config(path: Path = BUDGETS) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def agent_config(cfg: dict, agent: str) -> dict:
    agents = cfg.get("agents") or {}
    if agent not in agents:
        raise KeyError(f"agente desconocido: {agent}")
    return agents[agent] or {}


# --------------------------------------------------------------------------- ledger

def ledger_path(when: datetime) -> Path:
    return LEDGER_DIR / f"{when:%Y-%m}.jsonl"


def read_ledger(month: datetime) -> list[dict]:
    path = ledger_path(month)
    if not path.exists():
        return []
    rows = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue  # una línea corrupta no debe tumbar la factoría
    return rows


def append_ledger(record: dict, when: datetime) -> None:
    LEDGER_DIR.mkdir(parents=True, exist_ok=True)
    with open(ledger_path(when), "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")


def _run_day(row: dict) -> str:
    return (row.get("started") or "")[:10]


def runs_today(rows: list[dict], today: date, agent: str | None = None) -> int:
    iso = today.isoformat()
    return sum(
        1 for r in rows
        if _run_day(r) == iso and (agent is None or r.get("agent") == agent)
    )


def spent_in_period(rows: list[dict], agent: str | None = None) -> float:
    return round(sum(
        float(r.get("cost_usd") or 0)
        for r in rows
        if agent is None or r.get("agent") == agent
    ), 4)


# --------------------------------------------------------------------------- horario

def parse_window(window: str) -> tuple[dtime, dtime]:
    start_s, end_s = window.split("-")
    h1, m1 = (int(x) for x in start_s.strip().split(":"))
    h2, m2 = (int(x) for x in end_s.strip().split(":"))
    return dtime(h1, m1), dtime(h2, m2)


def in_window(now: datetime, window: str | None) -> bool:
    """True si `now` cae dentro de la ventana. Soporta ventanas que cruzan medianoche."""
    if not window:
        return True
    start, end = parse_window(window)
    current = now.time()
    if start <= end:
        return start <= current < end
    return current >= start or current < end


def now_in_tz(cfg: dict) -> datetime:
    tz = (cfg.get("global") or {}).get("timezone") or "UTC"
    return datetime.now(ZoneInfo(tz))


# --------------------------------------------------------------------------- guardas

@dataclass
class Decision:
    allowed: bool
    reason: str = ""


def check_can_run(cfg: dict, agent: str, now: datetime, rows: list[dict],
                  ignore_window: bool = False) -> Decision:
    g = cfg.get("global") or {}
    a = agent_config(cfg, agent)

    stop_file = REPO / (g.get("stop_file") or "factory/STOP")
    if stop_file.exists():
        return Decision(False, f"interruptor de parada activo ({stop_file.name})")

    if not ignore_window and not in_window(now, g.get("allowed_hours")):
        return Decision(False, f"fuera del horario permitido ({g.get('allowed_hours')})")

    if LOCK.exists():
        return Decision(False, "ya hay una ejecución en curso (factory/.run.lock)")

    max_global = g.get("max_runs_per_day")
    if max_global is not None and runs_today(rows, now.date()) >= max_global:
        return Decision(False, f"límite diario global alcanzado ({max_global})")

    max_agent = a.get("max_runs_per_day")
    if max_agent is not None and runs_today(rows, now.date(), agent) >= max_agent:
        return Decision(False, f"límite diario de {agent} alcanzado ({max_agent})")

    max_usd_global = g.get("max_usd_per_period")
    if max_usd_global is not None and spent_in_period(rows) >= max_usd_global:
        return Decision(False, f"presupuesto del periodo agotado ({max_usd_global} USD)")

    max_usd_agent = a.get("max_usd_per_period")
    if max_usd_agent is None:
        return Decision(False, f"{agent} no tiene presupuesto asignado")
    if spent_in_period(rows, agent) >= max_usd_agent:
        return Decision(False, f"presupuesto de {agent} agotado ({max_usd_agent} USD)")

    if a.get("max_usd_per_run") is None or a.get("max_turns_per_run") is None:
        return Decision(False, f"{agent} no tiene límites por ejecución definidos")

    return Decision(True)


# --------------------------------------------------------------------------- ejecución

def build_command(cfg: dict, agent: str, task: str) -> list[str]:
    g = cfg.get("global") or {}
    a = agent_config(cfg, agent)
    cmd = [
        "claude", "-p", task,
        "--agent", agent,
        "--output-format", "json",
        "--model", a.get("model") or g.get("default_model") or "sonnet",
        "--max-turns", str(a["max_turns_per_run"]),
        "--max-budget-usd", f"{float(a['max_usd_per_run']):.2f}",
        "--permission-mode", a.get("permission_mode") or "acceptEdits",
    ]
    allowed = a.get("allowed_tools")
    if allowed:
        cmd += ["--allowedTools", *allowed]
    denied = a.get("denied_tools")
    if denied:
        cmd += ["--disallowedTools", *denied]
    return cmd


RATE_LIMIT_MARKERS = ("usage limit", "rate limit", "límite de uso", "try again later")


def classify(returncode: int, payload: dict, stderr: str) -> str:
    blob = json.dumps(payload, ensure_ascii=False).lower() + " " + (stderr or "").lower()
    if any(m in blob for m in RATE_LIMIT_MARKERS):
        return "rate_limited"
    if "budget limit reached" in blob or "budget" in blob and "reached" in blob:
        return "budget_exceeded"
    if returncode == 0 and not payload.get("is_error"):
        return "success"
    return "failed"


def execute(cfg: dict, agent: str, task: str, now: datetime, dry_run: bool = False) -> dict:
    a = agent_config(cfg, agent)
    run_id = f"{now:%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6]}"
    cmd = build_command(cfg, agent, task)

    record = {
        "run_id": run_id,
        "agent": agent,
        "task": task,
        "started": now.isoformat(timespec="seconds"),
        "ended": None,
        "cost_usd": 0.0,
        "cost_kind": "estimated" if (cfg.get("billing") or {}).get("mode") == "subscription" else "billed",
        "turns": 0,
        "outcome": "dry_run",
        "model": cmd[cmd.index("--model") + 1],
        "pr": None,
    }
    if dry_run:
        record["command"] = cmd
        return record

    env = dict(os.environ)
    env.update({
        "FACTORY_AGENT": agent,
        "FACTORY_RUN_ID": run_id,
        "FACTORY_REPO": str(REPO),
        "FACTORY_WRITE_PATHS": json.dumps(a.get("write_paths") or []),
    })

    LOCK.write_text(f"{run_id}\n{agent}\n", encoding="utf-8")
    try:
        proc = subprocess.run(cmd, cwd=REPO, env=env, capture_output=True, text=True)
        try:
            payload = json.loads(proc.stdout or "{}")
        except json.JSONDecodeError:
            payload = {"raw": (proc.stdout or "")[-2000:]}
        record["cost_usd"] = round(float(payload.get("total_cost_usd") or 0), 4)
        record["turns"] = int(payload.get("num_turns") or 0)
        record["outcome"] = classify(proc.returncode, payload, proc.stderr)
        record["result"] = (payload.get("result") or "")[:500]
        if proc.stderr:
            record["stderr"] = proc.stderr[-500:]
    finally:
        LOCK.unlink(missing_ok=True)
        record["ended"] = datetime.now(now.tzinfo).isoformat(timespec="seconds")

    return record
