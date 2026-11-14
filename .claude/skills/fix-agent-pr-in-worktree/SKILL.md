---
name: fix-agent-pr-in-worktree
description: Use when a review fix must land on an agent PR branch.
category: git-workflow
---

Fix an agent's PR branch in a throwaway worktree of its remote head, never in the user's checkout.

1. Pin the PR head by SHA, not FETCH_HEAD: `sha=$(gh pr view <n> --json headRefOid --jq .headRefOid)`, then `git fetch origin <branch>` and `git worktree add /tmp/<name> $sha -b fix/<name>`. A later fetch in the same shell overwrites FETCH_HEAD, and the worktree lands on `main`. Before editing, check `git -C /tmp/<name> log -1 --format=%H` equals `$sha`. Make the change there, commit, `git push origin HEAD:<branch>`, and comment on the PR with what changed.
2. A new worktree has no `node_modules`, so any `node factory/*.ts` script fails with `ERR_MODULE_NOT_FOUND` (`validate-data.ts`, `bitacora.ts`, `run.ts`). Symlink the main checkout's `node_modules` in, run the script, then `rm node_modules` before `git add -A`, or the symlink lands in the commit.
3. Work that the finding does not require (queue entries, budgets, follow-up tasks) goes on its own branch from `main`, not on the agent's PR branch.
4. Once the push lands, remove the worktree and the local branch: `git worktree remove` and `git branch -D`.
5. A finding the agent says is "already fixed" is not verified. Before the re-review, grep the PR head for the removed text and check that each cited URL is in a page the run actually read. Only then comment and merge. Before merging, wait for CI on the new head (`gh pr checks <n> --watch --interval 15`): the fix push restarts the checks. When a human decision drives the fix, say in a PR comment what was removed, why, and that it is approved, then merge.
