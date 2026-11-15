---
name: conflict-free-parallel-prs
description: Use when parallel PRs keep conflicting on one file.
---

# Parallel PRs that all touch one shared file

**When to use:** many parallel PRs (agent branches) conflict after each merge because they all
append to or edit the same shared file (changelog, logbook, registry, queue).

## Diagnose
`git diff --name-only origin/main...<branch>` across the open PRs: if every PR touches the same
append-only file (logbook month file, `registry.yaml`, a queue), that file is the conflict source.

## Structural fix (instead of repeated manual rebases)
- Split the shared file into **one file per entry**: e.g.
  `docs/bitacora/YYYY-MM/<timestamp>-<slug>.md`, `data/sources/<id>.yaml`. Readers glob and sort
  by name; new entries never touch the same path.
- Machine-written state (queue/ledger) goes to a dedicated state branch and its own PR, not into
  every feature branch.
- Prove it with a real git test: two branches add entries, merge one, rebase the other → no conflict.

## Branches created before the split
- Old monthly log file: `git merge-file --union ours base theirs`, then re-sort entries by date.
- Old registry edit: move the change by hand into the per-item file; edit YAML with
  `parseDocument` (keeps comments) and `lineWidth: 0`.
- Any other conflict: stop and look; in code keep both sides and rerun tests/typecheck/build.

## Merging the backlog
One at a time: rebase on `origin/main`, wait for CI green (`gh pr checks --watch`; "no checks
reported" means CI hasn't started), merge, next. Rebase in a separate worktree, never in the
user's working copy.
