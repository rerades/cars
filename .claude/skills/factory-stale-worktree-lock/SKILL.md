---
name: factory-stale-worktree-lock
description: Use when factory run fails with index.lock File exists.
category: git-workflow
---

A `index.lock` left in `.git/worktrees/factory-state/` by a dead git process makes `syncState` in `factory/orchestrator.ts` throw, so the run exits before any agent starts. Clear it only after confirming no git process is alive.

## Steps

1. Find the failure: `grep -n "index.lock': File exists" ops/launchd.err.log`. A stack trace naming `syncState` and `cmdNext` means it came from `run.ts --next`.
2. Check the lock: `ls -la .git/worktrees/factory-state/index.lock` and `pgrep -fl "git "`.
3. If no git process is running, remove only that lock file and rerun `node factory/run.ts --next`. If a git process is running, wait for it; do not touch the lock.
4. Count occurrences on later nights. Nothing retries the lock today, so each occurrence costs one window. Report the pattern rather than patching `orchestrator.ts` from a session.

Known ceiling: the orchestrator has no stale-lock check. The lock hit by the 10 Nov 01:07 run was already gone the next day, and the designer run still opened its PR.
