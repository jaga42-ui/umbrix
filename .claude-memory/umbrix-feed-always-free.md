---
name: umbrix-feed-always-free
description: Umbrix product rule — the job feed is always free/unlimited; never build a daily feed cap
metadata: 
  node_type: memory
  type: feedback
  originSessionId: df910e69-e8bd-45ad-8cd5-78b907c7d204
  modified: 2026-07-23T05:34:56.975Z
---

The Umbrix feed is **always free and unlimited for every user** — no per-day job
card limit, ever. Owner said this explicitly (2026-07-23), reacting against the
CLAUDE.md billing line "Free tier: 15 job cards per day."

**Why:** the feed is the core value and retention driver (north-star = Day-7
retention); capping it fights the product's own rules ("never block the feed
behind mandatory signup", "guest/demo mode must always work"). Monetization
comes from other surfaces — eligibility filtering (batch/branch/CGPA), instant
alerts, AI resume tailoring, AI cover letters — never from feed volume.

**How to apply:** do NOT implement a "15 cards/day" (or any) feed cap.
`computeEntitlement` may gate tracker slots and resume tailors, but must not gate
feed access or volume. CLAUDE.md has already been reconciled (commit `89cec85`,
2026-07-23) — its billing section now says "feed is always free and unlimited";
the old "15 job cards per day" bullet is gone. See [[umbrix-ingest-overhaul-pending]].
