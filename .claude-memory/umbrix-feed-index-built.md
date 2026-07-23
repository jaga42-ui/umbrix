---
name: umbrix-feed-index-built
description: "The {status,isIndia,createdAt} feed index is already built on the production Atlas (manually, ahead of deploy) and verified in use"
metadata: 
  node_type: memory
  type: project
  originSessionId: df910e69-e8bd-45ad-8cd5-78b907c7d204
  modified: 2026-07-23T14:31:23.483Z
---

The compound index `status_1_isIndia_1_createdAt_-1` on the `jobs` collection is
**already built on the production MongoDB Atlas** as of 2026-07-23 — created
manually via `createIndex` from a local verification script, not just declared in
code. So prod has it *before* the deploy that ships commit `97be84e` (which adds
`OpportunitySchema.index({status:1, isIndia:1, createdAt:-1})`). Mongoose
`autoIndex` (default on; no override in mongodb.ts) will see the identical
key/name on deploy and no-op — no conflict.

**Why it exists:** it covers the default feed query (`{status:"Active",
isIndia:true}` sorted `createdAt` desc). Verified via `explain("executionStats")`:
the old `status_1_createdAt_-1` examined 3187 docs to return 2000 (fetch-to-filter
isIndia in memory); the new index examines exactly 2000 → returns 2000 (1.00x),
~37% fewer doc fetches on the app's hottest query. Planner confirmed to pick it.

Don't re-create or worry it's missing — it's live. See the feed query review in
[[umbrix-ingest-overhaul-pending]] context (route: src/app/api/jobs/route.ts).
