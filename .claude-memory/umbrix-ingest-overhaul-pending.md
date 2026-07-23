---
name: umbrix-ingest-overhaul-pending
description: Umbrix ingest overhaul (adapter split + tiered staggered cron + per-tier guard) is COMPLETE as of 2026-07-23; only the free-tier feed cap remains
metadata:
  node_type: memory
  type: project
  originSessionId: 0d80a319-3884-454a-81ab-7f550a113860
  modified: 2026-07-23T05:34:46.559Z
---

**Ingest overhaul: COMPLETE & VERIFIED IN PRODUCTION (2026-07-23, on
origin/main).** The pipeline now matches the CLAUDE.md/AGENTS.md structure.
Core commits:

- `c0d56bf` — tier-aware orchestrator + **per-tier rate guard**. `ingest-jobs.js`
  has `parseTierArg()` (`--tier=N` / `INGEST_TIER`) and `metaIdForTier()`, so the
  20h guard is keyed per tier (`ingest:tier{N}`) instead of one shared `ingest`
  doc — this was the coupling that would have made staggered runs skip. Un-tiered
  runs keep key `ingest`. Tests: `scripts/tier.test.js`.
- `baa7afb` — **adapter-file split**. Each source is `scripts/adapters/ingest-{source}.js`
  exporting `{ ats, tier, fetch }` (greenhouse/lever/ashby/smartrecruiters=tier3,
  adzuna=tier1). `ingest-jobs.js` builds ATS_FETCHERS + TIER_BY_ATS from an
  `ADAPTERS` registry and keeps the SHARED normalize/scam/upsert/reconcile
  pipeline — upsert was deliberately NOT duplicated into each adapter (rulebook's
  "less surface area / never duplicate" beats its literal per-adapter-upsert
  wording). Adding a source = new file + companies.json entries. Contract locked
  by `scripts/adapters.test.js`.
- `b0f5cdd` — **staggered cron**. `.github/workflows/ingest-jobs.yml` now fires
  00:00 UTC Tier 1 (Adzuna) and 04:00 UTC Tier 3 (ATS); tier routed from the
  firing cron → `INGEST_TIER`. `workflow_dispatch` takes a tier input (blank =
  all). Per-tier concurrency groups so runs don't cancel each other. **ADZUNA_APP_ID
  is confirmed present as a repo secret** (user, 2026-07-23).

Follow-up commits (same session):
- `89cec85` — CLAUDE.md billing section reconciled: feed-always-free, the "15
  cards/day" bullet removed. So that line is no longer "void in spirit only" —
  the rulebook itself now says unlimited feed.
- `5a6dd04` — fixed a dead Tier-3 board: `dreamsports` (Lever) 404'd every run;
  Dream Sports moved to SmartRecruiters, swapped entry to `Dream11`/smartrecruiters
  (valid board, 0 open roles now, ingests cleanly). Lesson: a persistent
  `[SOURCE] fetch: 404` in the run summary = a dead/moved slug in companies.json;
  probe other ATS platforms (gh/lever/ashby/smartrecruiters) before removing.
- `4f02323` — bumped both workflows to `actions/checkout@v5` + `setup-node@v5`
  on Node 24 (cleared the Node-20-runner deprecation). CI confirmed green on
  node v24.18.0 (typecheck + tests + build all pass).

**Verified in production (2026-07-23) via `gh workflow run ingest-jobs.yml -f
tier=N`:** Tier 1 selected only the 18 Adzuna shards → 5,864 jobs processed, 2
scam-blocked, 0/18 failed. Tier 3 selected only the 158 ATS boards → 14,783
processed, 1 blocked, 1/158 failed (the dreamsports 404, since fixed). Both
guards (`ingest:tier1`, `ingest:tier3`) are independent. Manual tier runs write
to prod Mongo and stamp that tier's guard (so the next same-tier cron within 20h
skips).

Environment note: the OneDrive machine now HAS node_modules + `.env.local`
(MONGODB_URI + ADZUNA_APP_KEY set; ADZUNA_APP_ID *not* local, so Adzuna can't run
locally, but keyless ATS fetchers do — verified greenhouse dry-run). Only 2 of
the rulebook's 4 tiers have a real source; Reed/Remotive/Muse/Internshala/
Freshersworld/Unstop/NCS/PSU adapters still don't exist — don't wire empty tiers.

**Feed is ALWAYS FREE — do NOT build a daily feed cap.** Owner decision
(2026-07-23), now baked into CLAUDE.md (commit `89cec85`): the feed is unlimited
for everyone. Paid tier monetizes other things (eligibility filtering, alerts,
AI tailoring/cover letters), never feed volume. Entitlements today gate tracker
slots + resume tailors, which is fine. Full rationale in
[[umbrix-feed-always-free]]. See also [[umbrix-repo-multi-machine]].
