---
name: researcher-status-claims
description: Use when a claim says discontinued, withdrawn, or not sold.
category: general
---

A status claim (discontinued, withdrawn, production ceased, not on sale in Spain) goes into `data/raw/` or the bitácora only when the page that states it was opened and read in this run, with `node factory/fetch-page.ts` or the IDAE fetch. A search snippet, a headline, or an article another page cites does not count as read.

- If the page was not read, leave the model out of `data/raw/` and name the open question in the bitácora. Queue a follow-up task that fetches that page.
- If a review finds a claim with no read source, fix the data file and the bitácora entry that repeated the claim in the same PR, and record what changed.
- If two read sources disagree, record both and do not pick one silently.
- A positive claim (on sale, launched, orders open) that rests only on a T3 article goes in with `needs_review: true` and an open question saying no source confirms it today. A review does not clear it.
