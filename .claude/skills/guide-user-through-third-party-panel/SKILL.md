---
name: guide-user-through-third-party-panel
description: Use when the user must do steps in a provider panel.
---

# Handing panel steps to the user

**When to use:** the user must enter values or click steps in a third-party dashboard (DNS
registrar, hosting panel, GitHub App install) that the session's MCP/API cannot do itself.

## Values: real, never templated
- Read the exact values from the provider (MCP, API, `dig`, `gh api`) before giving them: record
  type, host, target. Never paste "typical" values from docs.
- Say explicitly which existing records must stay untouched (MX, SPF, other services).
- `www` and the apex may be separate custom domains (and billed separately) on some hosts.

## Steps
- Number the steps, one panel action each, with the exact menu path.
- Mark which steps only the user can do (MCP can't add domains; keychain credentials are blocked
  by auto mode — ask, don't retry).
- After the user says "done", verify everything yourself (`dig`, deploy status, HTTPS) and report.

## Gotchas seen
- A GitHub App under "Authorized GitHub Apps" is not enough to deploy: it must appear under
  "Installed GitHub Apps" on the account (user vs organization) that owns the repo, with access to
  that repo.
- A certificate from the old host after a DNS change is usually local DNS cache. Check the new one
  directly: `openssl s_client -connect <new-ip>:443 -servername www.example.com`.
