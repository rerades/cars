# ops/

- `runs/YYYY-MM.jsonl`: ledger de ejecuciones de agentes (una línea por ejecución). Es la fuente de verdad del gasto.
- `actions/`: log de acciones por ejecución (hooks PreToolUse y PostToolUse). No se versiona.
- `traces/<run_id>.jsonl`: traza completa de cada ejecución (`stream-json`). No se versiona. Se ve con `node factory/run.ts --trace <run_id>`.

Ver ADR-0002 y ADR-0004.
