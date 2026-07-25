---
name: umbrix-roadmap
description: "Umbrix post-launch roadmap / priority order — ingest expansion, PWA→native, legal pages, then SEO"
metadata: 
  node_type: memory
  type: project
  originSessionId: df910e69-e8bd-45ad-8cd5-78b907c7d204
  modified: 2026-07-25T05:40:27.010Z
---

Owner's prioritized roadmap after the 2026-07-25 launch (in this order):

**1. Expand job inventory (biggest lever — relevance/coverage).**
- Add **Internshala** + other platforms via **scraping** (freshers-focused sources
  like Internshala, Freshersworld, Unstop, etc.).
- Add **company career pages** directly.
- Fits the existing tiered-cron + adapter structure: tier 2 = India scrapers,
  tier 3 = ATS / company career pages (see [[umbrix-ingest-overhaul-pending]]).
  Each new source = a `scripts/adapters/ingest-{source}.js` + companies/config.
- CONSTRAINT: follow CLAUDE.md scraper ethics — public pages only, respect
  robots.txt + each site's ToS, UmbrixBot User-Agent, ≥2s rate limit, metadata
  only (content ≤500 chars, no full JD), scamFilter every posting. Internshala
  ToS/robots must be checked before writing that scraper.

**2. Web → PWA → native, staged by user growth.**
- First: make the site a **PWA** (manifest + service worker + installable/offline
  shell). Cheap, immediate — matters for the mobile-first fresher audience.
- After a user threshold: wrap to **Android** (TWA or Capacitor), then **iOS**.
- Legal pages (#3) are a prerequisite for the app stores.

**3. Legal pages: privacy policy, terms & conditions, then other legal.**
- NOTE (founder): these are cheap and unblock several things — Google OAuth
  "verified app" consent, app-store submission (#2), payments later, and basic
  student trust. Worth doing EARLY even though it's listed 3rd.

**4. SEO — rank high on Google.**
- Technical SEO pass, then SEO-optimized / programmatic pages (e.g. per-role,
  per-city, per-field landing pages) to capture fresher search intent.
- The `seo-*` skills + `seo-audit`/`seo-technical`/`seo-programmatic` are available.

Monetization is deliberately NOT on this list yet — hold payments until the
analytics show engaged users hitting free limits (see [[umbrix-auth-google-only]]
context: launch free, let data trigger paid). Feed stays free
([[umbrix-feed-always-free]]).
