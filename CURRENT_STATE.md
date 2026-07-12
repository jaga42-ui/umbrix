# UMBRIX — Current State (Snapshot)

**Last updated:** 2026-07-13
**Owner:** Guruprasad Jena

> A factual snapshot of what UMBRIX actually is *right now* — inventory, pipeline, app,
> infra, and what's live vs scaffolded. Strategy lives in
> [BUSINESS_MODEL.md](./BUSINESS_MODEL.md), [FIRST_100K_PLAN.md](./FIRST_100K_PLAN.md),
> [COMPETITORS.md](./COMPETITORS.md); backlog in [FUTURE_WORK.md](./FUTURE_WORK.md).

**What it is:** a discovery feed of real, scam-checked, fresher-eligible jobs for Indian
students/grads — across every field — with personalized match scoring, resume-aware profiles,
and an application tracker.

---

## 1. Live inventory (as of the last ingest, 2026-07-13)

| Metric | Value |
|---|---|
| Active opportunities (total) | **18,953** |
| Active **India** roles (feed default) | **6,419** |
| From ATS boards | ~13,000 (tech/product companies, senior-skewed) |
| From Adzuna aggregator | **5,902** active (5,254 India) across 18 fields |
| Scams caught (this run / all-time) | 2 / 2 — *scam filter now firing for the first time* |

**Adzuna field breadth (active roles per shard):**

```
it 400   engineering 400   customer-service 400   hospitality 400
finance 400   marketing 400   sales 400   logistics 400   hr 400
healthcare 400   admin 398   consultancy 350   teaching 316
creative 298   manufacturing 229   retail 187   graduate 69   general 55
```

---

## 2. Inventory sources (164 total)

Configured in `scripts/companies.json`, fetched by `scripts/ingest-jobs.js`.

- **ATS adapters (146):** Greenhouse (121), Lever (10), Ashby (11), SmartRecruiters (4).
  Clean corporate boards; tech/product-heavy; each entry is one company.
- **Adzuna aggregator (18 shards):** one documented API, India endpoint, sharded by
  category (`sales-jobs`, `pr-advertising-marketing-jobs`, `accounting-finance-jobs`, `it-jobs`,
  `engineering-jobs`, `hr-jobs`, `customer-services-jobs`, `admin-jobs`, `retail-jobs`,
  `logistics-warehouse-jobs`, `healthcare-nursing-jobs`, `teaching-jobs`,
  `hospitality-catering-jobs`, `creative-design-jobs`, `consultancy-jobs`, `manufacturing-jobs`,
  `graduate-jobs`, `other-general-jobs`). Field-agnostic fresher query, ~400 roles/field/run.
- **Removed:** Telegram off-campus channels — dropped for low data quality (see FUTURE_WORK).

---

## 3. Ingest pipeline (`scripts/ingest-jobs.js`)

Normalizes every source into one shape, then scores, tags, and upserts. Run: `npm run ingest`.

- **Normalization:** each adapter → `{ title, companyName, location, content, applyUrl, department }`.
- **Scam filter** (`scripts/scamFilter.js`): weighted heuristics for pay-to-apply, deposits,
  training-kit fees, WhatsApp/Telegram funnels, unresolved shorteners; disclaimer-aware so honest
  "we never charge a fee" JDs aren't flagged. Now has messy Adzuna input to actually catch scams.
- **Tagging** (`extractTags`): whole-word skill matching (word boundaries — no more "AI" matching
  inside "trainee").
- **Eligibility extraction** (`extractEligibility`): parses `minExperience`, `batchYears`,
  `branches`, `cgpaCutoff`, `roleType` at ingest. `classifyType` → job/internship. `isIndia` via
  `isIndiaLocation`.
- **Freshness:** `reconcileStaleJobs` closes any active posting for a source no longer seen →
  structural edge over boards that let dead roles rot. `lastSeenAt` stamped each run.
- **Robustness:** bounded concurrency (8), per-source retry, ATS-interleaving, idempotent
  upsert by `applyUrl` (reappearing jobs auto-revive).
- **Rate limit (once/day):** DB guard (`meta.lastRunAt`) skips any run started <20h after the
  last, regardless of trigger — protects the Adzuna free tier (~250 calls/day; one run ≈144).
  Override with `--force` / `FORCE_INGEST=1`.

---

## 4. The app (Next.js App Router)

**Pages:** landing (`/`), `/feed`, `/profile`, `/tracker`, `/scam-check` (public).
**API routes:** `/api/jobs`, `/api/profile`, `/api/tracker`, `/api/entitlement`, `/api/health`,
`/api/scam-check` (public, IP-rate-limited).

- **Discovery feed** (`/feed`, `JobCard.tsx`): India-default, search/location/tag filters,
  per-card personalized match score + "why this matches", "verified / no scams" stamp,
  "Fresher-friendly" badge, save + apply.
- **Match scoring** (`src/lib/matchScore.ts`): explainable 0–99 score from skill overlap,
  domain alignment, seniority fit, description hits, and fresher-eligibility (`minExperience`).
  Neutral baseline when no resume yet (nudges upload).
- **Profile / resume** (`resumeParser.ts`, `pdf-parse`): upload résumé → parsed skills/title →
  powers matching.
- **Application tracker** (`/tracker`, kanban via `@hello-pangea/dnd`, `Application` model).
- **Auth:** Firebase (`verifyFirebaseToken.ts`, `serverAuth.ts`), guest/demo mode supported.
- **Billing scaffold:** `Subscription` model, `computeEntitlement`, `BillingProvider` seam,
  `/api/entitlement`, `entitlements.ts` — **checkout/webhooks not built yet** (Phase 2).
- **App-level rate limiting:** Upstash Redis (`src/lib/rateLimit.ts`) for API abuse (separate
  from the ingest daily guard).

---

## 5. Data model (MongoDB via Mongoose)

- **`Opportunity`** (collection `jobs`): the core unit — company, title, location, tags,
  applyUrl, status (Active/Closed), type, eligibility fields, `isIndia`, `lastSeenAt`. Indexed
  for the feed hot paths. (`source` field removed with the Telegram drop.)
- **`UserProfile`**: skills, title, experience — the match profile.
- **`Application`**: tracker entries (stage/order).
- **`Subscription`**: billing/entitlement state.
- **`meta`** (raw collection): ingest bookkeeping (`lastRunAt` for the daily guard).

---

## 6. Infrastructure

- **Ingest:** GitHub Actions `Nightly Job Ingestion` — cron `0 0 * * *` (00:00 UTC = 5:30 AM
  IST), plus manual `workflow_dispatch`. Runs tests, then `npm run ingest`.
- **Secrets (GitHub Actions):** `MONGODB_URI`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`. ✅ all set.
- **DB:** MongoDB Atlas. **Web app:** Next.js (Vercel-oriented). **Local:** `.env.local` holds
  the same keys for manual runs.
- **CI** (`ci.yml`): lint / typecheck / tests on push.

---

## 7. Live vs scaffolded

| Capability | Status |
|---|---|
| All-field India fresher inventory | ✅ live (ATS + Adzuna) |
| Scam filtering | ✅ live, now firing on real data |
| Freshness / stale-close | ✅ live |
| Personalized match scoring + explanations | ✅ live |
| Resume upload → profile skills | ✅ live |
| Application tracker | ✅ live |
| Fresher eligibility — `minExperience` in ranking + badge | ✅ live |
| Fresher eligibility — batch/branch/CGPA filters + matching | 🟡 extracted, not yet surfaced |
| Auth (Firebase) + guest mode | ✅ live |
| Billing entitlements seam | 🟡 scaffolded; checkout/webhooks not built |
| AI résumé/cover-letter tailoring (premium anchor) | ❌ not started |
| "Scam Check" standalone tool (growth wedge) | ✅ live at `/scam-check` — public, shareable |

---

## 8. Recent change log

- **Dropped Telegram** as a source (low quality); retired 220 ingested rows to Closed.
- **Added Adzuna** aggregator — 18 category shards → all-field India fresher inventory.
  Active India roles **1,170 → 6,419**.
- **Scam filter earned its keep** — first real scams caught (2).
- **Once-a-day ingest guard** added; Adzuna keys wired into CI secrets.
- **Scam Check** shipped — public `/scam-check` tool reusing the scam filter; also fixed a
  filter bug where periods in emails/URLs defeated the personal-email / untrusted-host checks.

---

## 9. Known constraints

- **Adzuna free tier** ~250 calls/day; run uses ~144, so **one ingest/day** (enforced).
- ATS inventory skews senior/tech — Adzuna is what makes the feed fresher-appropriate.
- Eligibility beyond `minExperience` isn't user-facing yet.
- No revenue mechanism live yet (billing checkout unbuilt) — see FIRST_100K_PLAN for the path.

---

*Living snapshot. Update after any change to sources, pipeline, models, or infra.*
