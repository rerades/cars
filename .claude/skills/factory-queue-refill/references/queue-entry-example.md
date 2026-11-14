# Queue entry shape

Entries are appended as text to `factory/queue.yaml`. Each block carries a section comment, a unique id, the agent, and a quoted task that cites its rules.

```yaml
# Furgonetas, in scope since 2026-11-07 (PRD-001, section 3).
- id: furgonetas-renault
  agent: researcher
  task: "Renault: electric vans sold in Spain today that are not yet in data/raw/renault/, passenger or cargo. Up to 6 models. Follow the rules in .claude/agents/researcher.md and the schema in docs/architecture/data-model.md, including the IDAE route, and segment according to RF-11 of PRD-001. Images through the image fetch script, under the same rules. Do not touch models that already exist. Bitacora."
```

The design-cleanup and planner entries follow the same shape. Each one names the PRD section or design file it works from and ends with the bitácora requirement.