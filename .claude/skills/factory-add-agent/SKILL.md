---
name: factory-add-agent
description: Use when adding a new factory agent or budgets.yaml entry.
category: dev-tooling
---

A new factory agent is not done when its prompt file exists. Change every registry the factory reads in one PR, then check the budget sum before committing.

## Checklist

- **Prompt:** `.claude/agents/<name>.md`. The orchestrator runs `claude --agent <name>`, so the file name is the registry. Nothing in `factory/run.ts` or `factory/orchestrator.ts` lists agents.
- **Budget:** a `factory/budgets.yaml` entry with `max_runs_per_day`, `max_usd_per_period`, `max_usd_per_run`, `max_turns_per_run`, `api_key_env`, `write_paths`, `allowed_tools`, `network: false`. The per-agent caps must sum to no more than the global cap. If you move money from another agent, say so in its comment and check the sum by parsing the YAML.
- **allowed_tools is the real restriction on bash.** The hook blocks `rm -rf` and branch switches, not `rm data/...`. List exact command patterns for everything the agent may run.
- **Evals:** if the agent writes a field that `docs/architecture/data-model.md` already allows, confirm `factory/evals.ts` accepts it. Otherwise the first run fails on every item. Add a check that fails any write outside the agent's allowed fields.
- **Merge:** an agent whose PRs need a person is excluded in `factory/merge.ts`, with a test in `factory/tests/merge.test.ts`. Do not rely on another rule to block it by accident.
- **Docs:** a row in `docs/process/agents.md`, the status line of the ADR that decided the agent, and the "Estado actual" in `CLAUDE.md`. Log the decision with `node factory/bitacora.ts add --tipo decision`.
- **Dry run:** `node factory/run.ts <agent> "prueba" --dry-run`. Outside the night window it prints `[bloqueado] fuera del horario permitido (01:00-07:00)`. That is the schedule guard, not a broken agent; check where the window is configured before debugging the agent.
- **Verify:** `pnpm test`, `pnpm run typecheck`, `node factory/validate-data.ts`.
