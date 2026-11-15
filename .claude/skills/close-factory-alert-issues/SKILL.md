---
name: close-factory-alert-issues
description: Use when closing a factory [ALERT] or [WARNING] issue.
category: git-workflow
---

# Close factory alert issues only with their cause and fix

Close a `[ALERT]` or `[WARNING]` factory issue only after its cause is resolved, and always pass `gh issue close <n> -c "<cause and fix>"`. The comment names what failed and what fixed it: the requeued task or PR number, or the count of runs that resumed.

Before closing, confirm the fix is real with `node factory/run.ts --status` so the comment describes the current state, not a guess.
