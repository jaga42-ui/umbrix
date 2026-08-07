---
name: getfreetoolsai-repo
description: "getfreetoolsai.com (the \"multi tool\" site) lives at C:/Users/gurup/Downloads/multi tool — separate repo from Umbrix"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7cd8b830-92e6-4608-97d3-37bacdcc41ee
  modified: 2026-08-06T19:28:44.714Z
---

The GetFreeToolsAI site (https://www.getfreetoolsai.com) is a **separate repo** from Umbrix:
`C:/Users/gurup/Downloads/multi tool` → github.com/jaga42-ui/getfreetoolsai.

Next.js 14.2.15 App Router + React 18 + Tailwind + next-intl, deployed on Vercel.
Not the Umbrix stack — no MongoDB, no Firebase. All tools run client-side (WASM).

Gotchas found 2026-08-06:
- Feature branches are often left checked out **behind `main`**. `main` == `origin/main` == what
  is deployed. Always `git checkout main` before branching.
- `.claude/worktrees/` inside the repo holds stale copies — grep hits there are noise, filter them out.
- Locale routes only exist for `/[locale]/image/convert/[pair]` (4 locales × 6 pairs) plus locale
  homepages. English is unprefixed at the top level; middleware is scoped to the 4 locale prefixes only.
- One root `<html lang="en">` in `app/layout.tsx` serves every route, so localized pages can't set
  `lang` server-side without either multiple root layouts (route-group refactor) or `headers()` in the
  root layout — the latter would opt the whole site out of static rendering. `components/HtmlLang.tsx`
  is the client-side stopgap.

See [[getfreetoolsai-seo-audit]] for the audit findings and what's been fixed.
