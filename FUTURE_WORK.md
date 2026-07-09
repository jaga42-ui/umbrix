# UMBRIX — Future Work & Backlog

Tracks planned enhancements, known gaps, and technical debt beyond the current MVP.
See [PRD.md](./PRD.md) for the product spec and [BUSINESS_MODEL.md](./BUSINESS_MODEL.md)
for the revenue strategy this backlog is prioritized against.

Legend: 🔴 high · 🟡 medium · 🟢 low

---

## 0. Strategic priorities (from the business model)

The revenue model is **B2C premium subscription** — we monetize the job seeker, not
employers or ads. Backlog priority is therefore driven by two questions:
**does it convert free users to paying ones?** and **does it protect the premium moat?**

The current top of the list, in order:
1. ✅ **Personalized feed ranking** (§2) — shipped. Feed now ranks by a heuristic match
   score (skills, domain, seniority, description) via `src/lib/matchScore.ts`.
2. ✅ **Scam filter + feed freshness** (§2, §3) — shipped. Weighted scam heuristic
   (`scripts/scamFilter.js`, 20 tests) + ingest-time stale-role reconciliation.
3. ✅ **Tracker free-cap + reminders** (§4) — shipped. Free active-app cap (first
   consumer of the entitlement layer) + per-application follow-up dates with a
   due-soon/overdue badge.
4. 🟡 **Billing infrastructure** (§7) — entitlement foundation shipped; still needs a
   payment provider + checkout/webhooks before revenue can be collected.
5. 🟡 **More ATS sources** (§3) — Greenhouse + Lever ship today; extend breadth further.

Employer/marketplace features are **off-strategy** and deliberately not built (§8).

---

## 1. Security & hardening
- 🟡 **Rotate the MongoDB credential (precautionary).** The connection string in
  `.env.local` holds live Atlas credentials. Confirmed git-ignored and never committed,
  so this is hygiene, not an incident — rotate since it was exposed in plaintext locally.
- 🔴 Decide whether demo mode (unconfigured Firebase → mocked auth, no token checks)
  can ever run in production. Gate it to non-production environments explicitly.
- 🟡 Add input validation/sanitization coverage audit across all API routes.
- 🟡 Restrict resume uploads: max file size, PDF-only MIME enforcement, and scan/limit
  extracted `rawText` size before persisting.
- 🟢 Add security headers (CSP, HSTS, etc.) and review CORS on API routes.

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
- 🟡 Advanced filters & search — Premium gate: remote, seniority, tags, location.
- 🟢 Save/hide/dismiss signals to inform future ranking.

## 3. Data ingestion  ⭐ moat
- 🟡 **Add more ATS sources** — Greenhouse and Lever ship today (128 companies). Extend
  to Ashby, Workday, and others. Feed breadth gates perceived value and conversion.
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
- 🔴 **Testing** — no test suite exists yet. Add unit tests (parsing, scam filter,
  validation) and integration tests for API routes + auth scoping.
- 🟡 CI/CD pipeline (lint, typecheck, test, preview deploys) on Vercel.
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
- ✅ **Entitlement / feature gating** — the mechanism exists: `computeEntitlement` +
  `FREE_TRACKER_ACTIVE_LIMIT` gate off a single source of truth, fail-safe to free.
  Not yet *consumed* — first consumer is the tracker free-cap (§4). Feed personalization
  is still ungated by choice (avoid a free-tier regression until checkout exists).
- 🟡 **Plans & pricing** — Free vs Premium tiers; monthly + annual (see BUSINESS_MODEL §5).
- 🟢 **Pause / dormant tier** — low-cost tier to retain users between job searches
  (churn-by-design mitigation, BUSINESS_MODEL §5).
- 🟢 **Email digest of matched roles (Premium)** — recurring-value hook + retention.
- 🟢 Career-services affiliate/partnerships (resume review, coaching) — non-conflicting
  secondary revenue; only post-PMF (BUSINESS_MODEL §4.2).

## 8. Off-strategy (explicitly not building)
Kept here so the decision is visible, not forgotten:
- ❌ Employer/recruiter side of the marketplace — reintroduces incentive conflict.
- ❌ Display ads / data sales — poisons the premium, trust-based positioning.
- ⏸️ In-app apply / autofill, mobile native apps — revisit only after PMF.

---

*Add new items here as they surface. Re-check each against
[BUSINESS_MODEL.md](./BUSINESS_MODEL.md) — if a feature doesn't serve the model, it's
probably off-strategy. Promote 🔴 items into PRD scope when committed to a release.*
