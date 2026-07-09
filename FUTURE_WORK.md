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
1. 🔴 **Personalized feed ranking** (§2) — flagship Premium feature, #1 conversion lever.
2. 🔴 **Scam filter + feed freshness** (§2, §3) — the trust moat; retention + positioning.
3. 🟡 **Tracker free-cap + reminders** (§4) — second conversion lever (free → unlimited).
4. 🟡 **Billing infrastructure** (§7) — required before any revenue can be collected.
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
- 🔴 **Personalized ranking (Premium)** — use `UserProfile` (skills/experience) to
  rank/filter the feed instead of a flat curated list. The flagship paid feature.
- 🔴 **Feed freshness/rotation (moat)** — define what "daily" means, dedup across
  ingests, and expire stale roles (`status: Closed`). Trust depends on it.
- 🟡 Advanced filters & search — Premium gate: remote, seniority, tags, location.
- 🟢 Save/hide/dismiss signals to inform future ranking.

## 3. Data ingestion  ⭐ moat
- 🟡 **Add more ATS sources** — Greenhouse and Lever ship today (128 companies). Extend
  to Ashby, Workday, and others. Feed breadth gates perceived value and conversion.
- 🔴 **Formalize & evaluate the scam-filter heuristic (moat)** — add test cases and
  metrics; keeping scams out of the feed is a core positioning promise, not a nice-to-have.
- 🟡 Schedule ingestion (cron) instead of manual runs; add run logging/observability.
- 🟢 Company management UI/config instead of hand-edited `scripts/companies.json`.

## 4. Application tracker  ⭐ conversion
- 🟡 **Free-tier cap + Premium unlimited** — enforce a free active-role limit
  (hypothesis: ~10) as the second conversion lever. See BUSINESS_MODEL §5.
- 🟡 Reminders / follow-up dates per application (Premium) — e.g. "nudge after 7 days".
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
- 🟡 **Billing infrastructure** — subscription plans, checkout, and webhook handling
  (Stripe is the default). Nothing can be charged until this exists.
- 🟡 **Entitlement / feature gating** — a clean way to gate Premium features (feed
  personalization, unlimited tracker, filters) behind an active subscription.
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
