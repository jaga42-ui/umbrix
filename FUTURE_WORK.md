# UMBRIX — Future Work & Backlog

Tracks planned enhancements, known gaps, and technical debt beyond the current MVP.
See [PRD.md](./PRD.md) for the product spec and [BUSINESS_MODEL.md](./BUSINESS_MODEL.md)
for the revenue strategy this backlog is prioritized against.

Legend: 🔴 high · 🟡 medium · 🟢 low

---

## 0. Strategic priorities (v2 — Indian freshers)

Per [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) v2, UMBRIX targets **Indian students /
freshers** with one integrated wedge (eligibility relevance + trust + speed/AI) and a
phased money model: **free B2C → cheap ₹ premium → B2B2C institutions**. The MVP is
well-built but was built for the wrong audience — so the current focus is **closing the
pivot gap**: serve real, fresher-eligible Indian inventory.

Current build order (detail in "★ Freshers pivot" below):
1. ✅ Generalize `Job` → **`Opportunity`** (type + eligibility scaffolding; collection
   pinned to `jobs`, existing docs backfilled). Eligibility population/matching still to come.
2. ✅ **Indian coverage, phase A** — Indian companies curated + `isIndia` location
   filter (feed defaults to India-only). ~1,093 active India roles live.
3. 🔴 **Indian ATS adapters** — Freshteam / Keka / Darwinbox / Zoho / SmartRecruiters / Workday.
4. ✅ **Eligibility extraction + matching** — experience (thorough), batch year, CGPA
   extracted at ingest; matching boosts fresher-eligible roles + "Fresher-friendly" badge.
   Branch extraction still to do.
5. 🟡 **Internships** as a first-class type (filter existing sources).
6. ⏸️ Later: hackathons/competitions, AI resume tailoring (Phase-2 premium), billing (Phase 2).

The shipped features below (ranking, tracker, feed perf, ingest reliability, security, CI,
billing foundation) are a **sound audience-agnostic foundation** — they carry forward, but
serve the wrong inventory until the pivot gap closes.

> **Trust is latent (honest note).** ATS feeds are clean, so the scam filter has caught ~0.
> With ATS-adapters-first sourcing, the near-term wedge leans on **relevance + Indian
> coverage + speed** — "we block scams" only becomes a felt benefit if messier sources are
> added later. Don't over-claim trust before it's real.

---

## ★ Freshers pivot — current focus (v2)

### Data model
- ✅ **Generalize `Job` → `Opportunity`** — `src/models/Opportunity.ts` (collection pinned
  to `jobs`, so no data migration) with `type` (`job` | `internship`; `hackathon` |
  `competition` reserved) + eligibility scaffolding (`batchYears[]`, `branches[]`,
  `minExperience`, `cgpaCutoff`, `roleType`, `isIndia`). Ingest tags `type` via
  `classifyType` (title heuristic); 13,022 existing docs backfilled (12,963 job / 59
  internship). Feed + ingest + tests migrated; verified (tests, build, live DB). Next:
  **populate** eligibility fields (extraction) and **use** them in matching — both empty/
  unused so far.

### Indian inventory (ATS-adapters-first)
- 🟡 **Telegram fresher channels (the real fresher-inventory unlock)** — clean ATS feeds
  are a senior-role pool (only ~41 India fresher roles even with full eligibility
  detection). The fresher jobs live on off-campus Telegram channels, read login-free via
  the `t.me/s/<channel>` web preview. `fetchTelegramChannel` parses the semi-structured
  posts (Company/Role/Batch/Location/Apply Link), resolves short links to the real
  destination + dedups, and runs the scam filter — **this is where the scam filter finally
  earns its keep** (Telegram is where the fraud is; `forms.gle` de-flagged since legit
  drives use it). New `Opportunity.companyName`/`source` fields. Verified: 9 real
  batch-tagged fresher/intern roles from one channel. Next: add the founder's channel list;
  pagination (`?before=`) for more depth; per-channel scam-block metrics.
- ✅ **Indian coverage, phase A** — Indian companies on Greenhouse/Lever/Ashby curated
  (Paytm, PhonePe, Meesho, Groww, CRED, Sarvam, Mindtickle, Epifi, Atlan + India offices of
  Postman/Observe.ai). `isIndiaLocation` populates `isIndia` (false-positive-safe, tested);
  the ingest run yielded **~1,093 active India roles**. Feed defaults to **India-only**
  (`india` param + 🇮🇳 toggle) with an Indian-metro location dropdown. Lesson: ATS slugs
  **collide** — porter/navi/kiwi returned foreign companies with the same slug (0 India);
  removed. Verify India ratio before curating.
- 🟡 **Indian ATS adapters** — **SmartRecruiters ✅** (`fetchSmartRecruitersJobs`, paginated,
  apply URL constructed from posting id; added Freshworks/ServiceNow/Netskope/Gainsight →
  ~73 India roles). **Finding:** Freshteam's public endpoint didn't respond; the big Indian
  consumer-tech employers (Razorpay, Zerodha, Swiggy, Zomato, Flipkart) are **not** on any
  easy ATS — they use **Workday** (per-company tenant+datacenter+site, POST API, N+1 for
  apply URLs — doesn't fit the slug model), **Darwinbox / Keka** (no clean public API →
  scraping), or custom pages. The reachable ATS pool (GLA + SmartRecruiters) skews to
  startups/product/SaaS — which *fits the tech-grad beachhead*. Workday is buildable but its
  own focused task; Darwinbox/Keka need scraping (expansion, not beachhead).
- 🟢 **Bespoke career-page scraping** — only for a curated few high-value custom pages;
  brittle + high-maintenance + ToS risk, so last resort, not the strategy.

### Relevance
- ✅ **Eligibility extraction + matching** — ingest parses `minExperience` (thorough, the
  key fresher signal), `batchYears`, and `cgpaCutoff` from postings (`extractEligibility`,
  tested). `matchScore` boosts fresher-eligible roles (minExp 0–1) and penalizes
  experience-heavy ones, with a **"Fresher-friendly" badge** on the card. Follow-ups:
  **branch** extraction (needs a degree/branch dictionary); per-user experience matching
  (currently assumes the audience is freshers, which is fine for the beachhead).
- 🟡 **Internships** — surface as an `Opportunity` type (filter existing sources for
  intern/trainee) with a job/internship toggle on the feed.

### Expansion capture (the "LinkedIn problem" — BUSINESS_MODEL §1)
- 🟡 **Field waitlist** — the mission is universal but the beachhead is tech, so public
  channels attract non-beachhead jobseekers. When the feed is empty/sparse for a user, show
  *"strongest in tech/startup roles today — tell us your field, we'll notify you"* + capture
  their field. Keep the **tracker + scam-check field-agnostic** so they're usable anyway.
  Each signup = good impression + a **ranked demand signal** for which stream to expand to
  next + a warm launch list. Ship with the first public marketing push.

### Deferred (post-beachhead)
- ⏸️ **Hackathons / competitions** — new event data model + sources (Devfolio, Devpost,
  MLH, Unstop, HackerEarth). Reserved in the type enum; build after jobs + internships land.
  Note: this moves UMBRIX toward Unstop's territory — a deliberate, later bet.
- ⏸️ **AI resume/cover-letter tailoring** — the Phase-2 premium anchor.

### Open (decide before/while building — BUSINESS_MODEL §9)
- Narrow **beachhead** (which streams / role types / colleges)?
- Which fresher-eligible + ToS-safe **sources** beyond ATS?

---

## 1. Security & hardening
- ✅ **Demo mode can never run in production** — `resolveUserId` now fails closed:
  when server auth is unconfigured in a production runtime (`isProductionRuntime`)
  it returns 503 instead of granting unauthenticated demo access. Previews/dev keep
  demo mode.
- ✅ **Regex injection / ReDoS fixed** — `search`/`location`/`tag` were inserted raw
  into `$regex` in the jobs route; now escaped + length-capped via `safeRegexTerm`.
  Broader validation is covered: tracker/profile routes use the validation helpers.
- ✅ **Resume upload hardening** — 5MB cap, `application/pdf` MIME check, PDF magic-byte
  verification, and rate limiting were in place; added a 100k-char cap on the parsed +
  persisted `rawText` (bounds DB size / parse cost against a text-heavy or bomb PDF).
- 🟢 Security headers present in `next.config.ts` (X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, HSTS, Permissions-Policy). CSP deliberately omitted (breaks the Firebase
  auth popup); revisit with a nonce-based policy if tightening further.
- 🟡 **Rotate the MongoDB credential (precautionary).** Live Atlas creds in `.env.local`;
  git-ignored and never committed, so hygiene not incident — ops task, rotate before launch.

## 2. Discovery feed  ⭐ conversion + moat
- ✅ **Personalized ranking** — `/api/jobs` scores every job against the user's
  `UserProfile` (skills, domain, seniority) via `src/lib/matchScore.ts` and ranks the
  feed by fit (recency tiebreak). No-resume users fall back to recency, preserving the
  upload upsell. Follow-ups: gate behind Premium once billing exists (§7); tune weights
  against real ingested-job tag quality.
- ✅ **Feed freshness/rotation (moat)** — the ingest stamps `lastSeenAt` and closes a
  company's still-`Active` jobs not seen in a successful run (`reconcileStaleJobs`),
  so stale postings drop out of the feed; reappearing jobs auto-revive. Follow-up:
  a global TTL sweep to close "zombie" jobs from companies *removed* from
  `companies.json` (no longer reconciled per-company); dedup near-identical postings
  across companies.
- ✅ **Feed organization** — grouped into match tiers (Strong / Good / More roles) with
  per-section counts, top-30 render + "Load more", and a slimmed payload (drops unused
  `descriptionHtml`, caps to top `FEED_MAX=120` with `total`).
- ✅ **Feed performance at scale** — the old query sorted *all* active jobs in memory and
  at ~12.4k **exceeded MongoDB's 32MB sort limit** (feed was erroring into the mock
  fallback). Fixed with a `{status, createdAt}` index (declared + created in DB), plus
  `.select()` (no `descriptionHtml`), `.lean()`, and a bounded candidate window
  (`.limit()`: `FEED_MAX` for no-resume/recency users, `CANDIDATE_LIMIT=2000` newest for
  resume users) with a conditional `countDocuments`. Payload ~100MB→0.58MB. Trade-off:
  resume users score the 2000 most-recent postings (freshness-biased; tunable). Follow-up:
  for very large catalogs, a skill-tag-targeted candidate query would beat a recency window.
- 🟡 Advanced filters & search — Premium gate: remote, seniority, tags, location.
- 🟢 Save/hide/dismiss signals to inform future ranking.

## 3. Data ingestion  ⭐ moat
- ✅ **More ATS sources** — Greenhouse + Lever + **Ashby** now ship (`fetchAshbyJobs`,
  case-sensitive board slugs, drops unlisted postings). 137 companies, ~12.4k active jobs.
  Follow-up: add Workday / SmartRecruiters / Recruitee (the `ATS_FETCHERS` registry makes
  this a one-function add).
- ✅ **Ingest reliability** — the DB writes (`bulkWrite` + reconcile) are now retried via
  `withRetry` (both idempotent), the Mongo connection is hardened (`maxPoolSize`, server-
  selection/socket timeouts, `retryWrites`), and `runIngestPass` retries first-pass
  failures once, sequentially. Failures are phase-tagged (fetch/db/config) in the summary.
  Took the last run from **19/137 → 0/137 companies failed**. Covered by offline tests
  (`ingest-reliability.test.js`).
- ✅ **Scam-filter heuristic (moat)** — weighted, auditable rules in
  `scripts/scamFilter.js` (pay-to-apply, deposits, WhatsApp/Telegram funnels, personal
  emails, suspicious apply hosts) with disclaimer-stripping and 20 pinned tests. Blocked
  postings are logged with reasons at ingest. Follow-up: track block-rate metrics over time.
- 🟡 Schedule ingestion (cron) instead of manual runs; add run logging/observability.
- 🟢 Company management UI/config instead of hand-edited `scripts/companies.json`.

## 4. Application tracker  ⭐ conversion
- ✅ **Free-tier cap + Premium unlimited** — `POST /api/tracker` enforces a free cap of
  `FREE_TRACKER_ACTIVE_LIMIT` (10) active apps (Saved/Applied/Interview; Rejected is
  free), returning 403 `LIMIT_REACHED`. The board shows a usage meter + upgrade nudge and
  both entry points (tracker add, feed save) handle the cap. First consumer of the
  entitlement layer. Follow-ups: wire the upgrade CTA to checkout once a provider exists
  (§7); optional opt-in DB test for the 403 path; PUT-reactivation of a Rejected card is a
  minor, un-enforced cap bypass (soft conversion nudge, not a security boundary).
- ✅ **Reminders / follow-up dates per application** — optional `reminderAt` with a
  color-coded overdue/due-soon badge (`src/lib/reminders.ts`, 10 tests); set/clear in the
  add & edit modals. Shipped ungated (Premium-gate deferred with billing, §7). Follow-ups:
  active *notification* (email/push when due — pairs with the §7 email digest); recurring
  "nudge after N days".
- 🟡 Bulk actions and archiving for old applications.
- 🟢 Customizable pipeline stages beyond the fixed four.
- 🟢 Activity timeline / notes history per application (durable value → retention).

## 5. Profile & resume
- 🟡 Improve resume parsing accuracy; support DOCX in addition to PDF.
- 🟡 Editable structured profile UI (correct parsed fields, add manually).
- 🟢 Multiple resume versions and per-application resume tagging (Premium).

## 6. Platform, quality & DX
- ✅ **Test harness** — `tsx` lets `node --test` run `src/**/*.test.ts` next to the
  `scripts/*.test.js` suite. Pure logic is covered: scam filter, match scoring,
  entitlements + tracker cap, reminders, and validation (incl. the regex-escaping).
  ~37 tests. Follow-ups: integration tests for API routes + auth scoping (the opt-in DB
  test in `freshness.test.js` is the pattern); a src-level API-route harness.
- ✅ **CI pipeline** — `.github/workflows/ci.yml` runs typecheck → test → build (hard
  gates, green without secrets) on push/PR to `main`; lint is advisory for now.
  Follow-up: clear the lint debt (a few `any`s + setState-in-effect) so lint can become a
  blocking gate. Preview deploys are handled by the Vercel Git integration.
- 🟡 Error monitoring & structured logging (currently minimal).
- 🟡 Analytics/metrics instrumentation — required to measure the conversion/LTV/CAC
  levers in BUSINESS_MODEL §6 and the PRD success metrics.
- 🟢 Accessibility audit (keyboard nav for drag-and-drop, ARIA, contrast).
- 🟢 Loading/skeleton and empty states across feed, tracker, and profile.

## 7. Monetization & billing  ⭐ revenue
- 🟡 **Billing infrastructure** — entitlement foundation ✅ (provider-agnostic
  `Subscription` model, pure `entitlements.ts`, `getEntitlement()`, `/api/entitlement`,
  `useEntitlement()` hook, `BillingProvider` seam). **Still to do:** pick a provider
  (Stripe / Paddle / Lemon Squeezy — deferred), implement `src/lib/billing/<provider>.ts`
  against the seam, and add checkout + webhook routes (webhook upserts the Subscription).
  Under v2 this is **Phase 2**, priced in **₹**, and only needed once a free B2C base
  exists — not the current focus. The same `Subscription` powers Phase-3 institutional seats.
- ✅ **Entitlement / feature gating** — the mechanism exists: `computeEntitlement` +
  `FREE_TRACKER_ACTIVE_LIMIT` gate off a single source of truth, fail-safe to free.
  Not yet *consumed* — first consumer is the tracker free-cap (§4). Feed personalization
  is still ungated by choice (avoid a free-tier regression until checkout exists).
- 🟡 **Plans & pricing** — free + cheap ₹ premium (Phase 2) + institutional seats
  (Phase 3, B2B2C — the real engine); see BUSINESS_MODEL §3–4.
- 🟢 **B2B2C institutional dashboard** (Phase 3) — placement-cell view over a batch's usage
  + outcomes; the pitch to colleges/training institutes.
- 🟢 **Pause / dormant tier** — low-cost tier to retain users between job searches
  (churn-by-design mitigation, BUSINESS_MODEL §5).
- 🟢 **Email digest of matched roles (Premium)** — recurring-value hook + retention.
- 🟢 Career-services affiliate/partnerships (resume review, coaching) — non-conflicting
  secondary revenue; only post-PMF (BUSINESS_MODEL §4.2).

## 8. Off-strategy (explicitly not building)
Kept here so the decision is visible, not forgotten:
- ❌ Employer/recruiter-paid ranking or a two-sided marketplace — reintroduces the
  incentive conflict. (Note: **B2B2C selling to institutions is on-strategy** — Phase 3 §7 —
  the buyer is a college/institute, not an employer bidding for candidate attention.)
- ❌ Display ads / data sales — poisons the trust-based positioning.
- ⏸️ In-app apply / autofill, mobile native apps — revisit only after PMF.
- ⏸️ Serving senior / experienced / non-India hires — out of the v2 audience.

---

*Add new items here as they surface. Re-check each against
[BUSINESS_MODEL.md](./BUSINESS_MODEL.md) — if a feature doesn't serve the model, it's
probably off-strategy. Promote 🔴 items into PRD scope when committed to a release.*
