---
name: researcher-blocked-source-fallback
description: Use when a manufacturer page returns 403 or 429 in a fetch, or when a press quote cannot be read.
category: general
---

When the manufacturer page is blocked, leave the value null and do not fill it from press coverage. Press prices that disagree with each other are not a price, even if one of them looks plausible.

- Record the gap as an open question that names the page and the status code, for example `price: fiat.es devuelve 403 a fetch-page.ts`.
- Take specs from a T2 source the fetch can read, such as the IDAE database through `node factory/fetch-idae.ts`, and cite its URL and retrieval date.
- Do not mark a model on sale on the strength of the blocked page alone; the status rule in researcher-status-claims still applies.
- Before concluding the site is blocked, read the brand's listing page with `node factory/fetch-page.ts` (for example `https://www.toyota.es/coches`). A product page can return 403 while the listing reads fine and names the models and their fuel type.
- Never cite a press article, quote, or search snippet you did not read through `fetch-page.ts`. Write `no confirmado` and drop the citation; an attribution nobody can check is worse than a gap.
