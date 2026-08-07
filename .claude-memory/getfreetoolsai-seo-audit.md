---
name: getfreetoolsai-seo-audit
description: "getfreetoolsai.com SEO audit 2026-08-06 scored 68/100; the real ceiling is zero external authority, not on-page"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7cd8b830-92e6-4608-97d3-37bacdcc41ee
  modified: 2026-08-06T19:29:23.450Z
---

Full SEO audit of getfreetoolsai.com on 2026-08-06 (363 pages crawled): **68/100**.

The engineering is strong — zero 4xx/5xx, SSR, CLS 0.000, valid schema everywhere, no fake
`aggregateRating`. Scores are dragged down by a few cheap defects and one expensive one.

**The expensive one:** the domain has no external corroboration. An exact brand-name search returns
competitors, not the site. `foundingDate: 2026`, no real social presence, no third-party mentions.
On-page work is capped by this — link building / directory listings / original data are the
unblocking moves, not more meta-tag polish.

**Fixed on branch `seo/audit-phase1`** (2026-08-06): removed 5 dead `sameAs` URLs (all verified 404 —
they were the only actively false claim on the site); scoped the 134-item `ItemList` from all 363
pages to the homepage alone (tool-page JSON-LD 19KB → 3.2KB); dropped 66 generic
"How to use this free online tool" HowTo blocks; added crawlable cross-locale links that de-orphan
the 24 localized pages; per-locale `og:locale` + translated FAQ headings; GTM preconnect;
trimmed 85 over-long meta descriptions.

**Still open, in priority order:** homepage renders all 134 tools (drives TBT 2,570ms — poor, and
predicts INP; needs a product decision on what to show instead); ~85 meta descriptions still >160
chars; flat internal link graph (~101 near-identical outbound links/page, leaf pages have as many
inbound links as the homepage); no named author on 44 YMYL calculators; the 70-page `/how-to/` exam
cluster is 270-word median with up to 0.89 pairwise similarity (scaled-content risk).

Audit artifacts: `HIKARI/.claude/worktrees/seo-audit-getfreetoolsai-5eeb3e/getfreetoolsai.com-audit/`.

Measurement is blind: no Google API key, no Search Console, no Moz/Bing — every perf number is a
Playwright lab estimate. Wiring up credentials is the cheapest next win. See [[getfreetoolsai-repo]].
