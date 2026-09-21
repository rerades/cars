#!/usr/bin/env python3
"""PreToolUse/PostToolUse: registra cada acción del agente en ops/actions/<run_id>.jsonl."""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

MAX = 300


def main() -> None:
    run_id = os.environ.get("FACTORY_RUN_ID")
    if not run_id:
        sys.exit(0)
    try:
        event = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    out_dir = Path(os.environ.get("FACTORY_REPO", ".")) / "ops" / "actions"
    out_dir.mkdir(parents=True, exist_ok=True)
    record = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run_id": run_id,
        "agent": os.environ.get("FACTORY_AGENT"),
        "event": event.get("hook_event_name"),
        "tool": event.get("tool_name"),
        "input": json.dumps(event.get("tool_input") or {}, ensure_ascii=False)[:MAX],
    }
    with open(out_dir / f"{run_id}.jsonl", "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
