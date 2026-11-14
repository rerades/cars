---
name: factory-queue-refill
description: Use when the agent queue is empty, agents are idle, or the user asks to add or queue more tasks (podemos meter más tareas en la cola, encolar, rellenar la cola).
category: general
---

Refill `factory/queue.yaml` from the current PRDs and design docs, technical work first. "Encolar" for this user means the whole cycle: bitácora, PR, green CI, merge, then `git pull --ff-only` in the main copy.

## Steps

1. Check the state: `node factory/run.ts --status` (queue count, budgets), `gh issue list --state all` and open PRs, so nothing is queued twice. Then check the content: on main, `ls data/raw/<brand>/` and `grep -rl '<model>' data/raw` for each model the task names. A model already in `data/raw/` is not a new task. This refill queued a Toyota van task for Proace, Proace City and Proace Max, which were already on main, and had to be removed the same night. A run cut by a limit can still open issues or PRs before it stops: for a task you re-queue, list what its epic already holds and rewrite the task to complete the missing part, not to create it again.
2. Read the PRD sections and `docs/design/` files that changed. A scope change goes first into the PRD: a new row in its changelog table, the RF/CA amended in place, the superseded wording kept as "texto anterior". Then the design spec. Then the task.
3. Order the tasks: designer spec cleanup, then planner (epics and stories), then developer, then researcher discovery. A developer task that needs planner stories waits until those stories exist; the queue has no dependency guard. Queue only the first link of a dependency chain (the base story, not the stories built on it), and add the dependents in the next refill after that PR merges.
4. Keep each task inside the daily budget of its agent in `factory/budgets.yaml`. Split large researcher sweeps by manufacturer.

Pick researcher work by gaps before refreshing. Count them read-only over `data/raw/` (models with `images: []`, models with no version price, `needs_review`, and `status.retrieved` by month). Queue missing data first: photos for models with no image, then prices. Refreshing records already verified (for example 45 models last checked in October) waits until discovery is done. Size each task at 5–6 models, and check remaining monthly USD in `--status` first, so the batch fits. The per-run caps (`max_usd_per_run`, `max_turns_per_run`) are a separate limit: a run that hits one ends as `budget_exceeded` and leaves nothing behind. To repeat it, raise that per-run cap (monthly caps stay), queue the task again under a new id such as `-2`, and delete the cut entry from `queue.yaml`, because `--status` keeps listing failed entries while they remain in the file. `--status` reads the queue from the factory-state worktree, so re-check it after the PR merges.
5. Cite the rule instead of paraphrasing it: "sigue las reglas de .claude/agents/researcher.md y docs/architecture/data-model.md", and cite the PRD section for scope. Entry shape: `references/queue-entry-example.md`.
6. Append as text with `cat >> factory/queue.yaml`, with a unique `id`, `agent`, and a quoted `task`. Do not rewrite the file through a YAML parser. Verify the count afterwards with `run.ts --status`, and check that the file still parses: `node -e 'require("yaml").parse(require("fs").readFileSync("factory/queue.yaml","utf8"))'`. Put a `# comment` line above each batch of entries so the file stays readable.
7. Record the decisions: `node factory/bitacora.ts add --tipo decision` when a product choice has discarded alternatives, `nota` for the refill. Then `pnpm test && pnpm run typecheck`.
8. Commit in English as `docs(...)` or `chore(...)`, PR title and body in English, bitácora in Spanish. Open the PR, wait for CI, `gh pr merge --merge --delete-branch`, then pull main. `gh pr checks <n> --watch` piped through grep printed nothing in this run, so read the verdict with `gh pr view <n> --json statusCheckRollup --jq '[.statusCheckRollup[]|"\(.name):\(.conclusion)"]|join(" ")'`, and wait until every check is SUCCESS or SKIPPED.

## When a night produced no runs

Before blaming the agents, check whether the queue was empty at the window: `ops/launchd.out.log` prints `cola vacía` on every orchestrator wake-up (count it with `grep -c "cola vacía"`). An empty queue at 01:00 means the refill came too late, so refill before the window closes, not after. If the queue had tasks and nothing ran, the cause is a stuck git lock; see the factory-stale-worktree-lock skill.

## Product answers given in chat

When the user settles an open PRD question in chat, write it into the PRD and the design spec before queueing anything that depends on it. Then queue the cleanup and follow-up tasks. If a story would depend on an open question, leave it out and name the blocker in the summary.
