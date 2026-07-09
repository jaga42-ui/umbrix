# UMBRIX — Product Requirements Document

**Status:** Built MVP, mid strategic pivot
**Last updated:** 2026-07-10
**Owner:** Guruprasad Jena

> **Aligned to [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) v2.** The MVP is built, but it was
> built for the wrong audience (elite US tech roles). UMBRIX is pivoting to **Indian
> students / freshers**. This PRD reflects both what exists today and the gap the roadmap
> must now close to serve that audience. See [FUTURE_WORK.md](./FUTURE_WORK.md) for the
> backlog.

---

## 1. Overview

UMBRIX helps **Indian students and freshers** find their first real job or internship
without wading through scams and irrelevant listings. It combines a **verified, eligibility-
aware discovery feed** with a **Kanban application tracker** and a resume-aware profile.

The one-line promise (BUSINESS_MODEL §2):
> *Find the fresher jobs you're actually **eligible** for, guaranteed **real** (not scams),
> and **apply fast** with AI.*

### 1.1 Problem
Indian freshers face a job market that is hostile in specific ways:
- **Fraud & noise** — pay-to-apply scams, fake HR on WhatsApp/Telegram, "₹40k WFH" bait.
- **Eligibility confusion** — endless time wasted on roles that filter them out (batch year,
  branch, CGPA, "needs 3 yrs experience"). The single biggest time-sink.
- **Scattered off-campus discovery** — real openings spread across LinkedIn, Telegram,
  company pages, and drives, with no trustworthy single surface.
- **Volume & speed** — hundreds of applications; early applicants get most callbacks.

### 1.2 Solution
- Ingest **fresher-eligible** roles and verify each one, filtering out scams before the user
  sees them.
- Rank by **eligibility + fit**, not just keyword overlap.
- Let users track applications end-to-end with reminders.
- (Phase 2) Help users **apply fast** with AI-tailored resumes/cover letters.

### 1.3 Target user
**Indian students / freshers (0–2 yrs)** seeking a first job or internship — value trust,
relevance, and speed. (v1 targeted "high-performing Western professionals"; that was wrong —
see BUSINESS_MODEL §0.)

---

## 2. Goals & non-goals

### Delivered so far (audience-agnostic foundation)
- Verified discovery feed with scam filtering + freshness reconciliation.
- Personalized match ranking (skills / domain / seniority) with match-tier grouping.
- Per-user application tracker: stages, drag-and-drop, notes, reminders, a free-tier cap.
- Resume upload → structured profile (PDF).
- Secure auth (Firebase ID-token verification), fail-closed in production.
- Provider-agnostic billing/entitlement foundation.
- CI + test harness; hardened ingestion across 3 ATS sources.

### Now required to actually serve freshers (the pivot gap)
- 🔴 **Inventory pivot** — replace the elite-US-company list with fresher-eligible Indian /
  off-campus / internship sources.
- 🔴 **Eligibility metadata** — capture batch year, branch, min-experience, CGPA cutoff on
  jobs, and filter/rank on them.
- 🔴 **Trust in practice** — ingest messier sources (where scams actually appear) so the
  scam filter earns its keep, and show a visible "verified" signal.
- 🟡 **AI resume/cover-letter tailoring** — the Phase-2 premium anchor.

### Non-goals
- Recruiter/employer-paid ranking or a two-sided marketplace (incentive conflict).
- Ads or selling user data.
- Serving senior / experienced / Western hires (out of audience).
- Native mobile apps (for now).

---

## 3. Tech stack

| Layer      | Technology |
|------------|------------|
| Frontend   | Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion |
| Backend    | Next.js API Routes / Server Components (Node.js) |
| Database   | MongoDB via Mongoose |
| Auth       | Firebase Authentication (ID-token verification, no service-account key) |
| Rate limit | Upstash Redis + `@upstash/ratelimit` |
| Ingestion  | Standalone Node.js script against public ATS APIs (Greenhouse, Lever, Ashby) |
| Billing    | Provider-agnostic entitlement layer (`BillingProvider` seam; provider TBD) |
| Testing/CI | `node --test` + `tsx` for `src/**/*.test.ts`; GitHub Actions CI |
| Resume     | `pdf-parse` |

---

## 4. Core features & requirements

### 4.1 Authentication
- Firebase Authentication with Google sign-in (popup, redirect fallback); Firebase Auth
  proxied first-party for reliable redirect persistence.
- All `/api/*` data routes require a valid Firebase ID token, verified server-side; user id
  is derived from the token (client-supplied `userId` ignored).
- **Demo mode** (unconfigured Firebase) works locally/preview, but **fails closed in
  production** — never grants unauthenticated access to a live deployment.

### 4.2 Discovery Feed (`/feed`)
- Active roles ranked by personalized match score, **grouped into tiers** (Strong / Good /
  More), with top-N + "Load more". Backed by `GET /api/jobs` (bounded candidate window).
- **Target state:** eligibility-aware ranking + a visible "verified" trust signal.
- Users can save a role to their tracker.

### 4.3 Application Tracker (`/tracker`)
- Kanban board: **Saved → Applied → Interview → Rejected**; drag-and-drop, notes,
  follow-up **reminders** (overdue/due-soon badges), and a free-tier active-app cap
  (Premium = unlimited). Backed by `/api/tracker`.

### 4.4 Profile (`/profile`)
- Resume (PDF) → structured `UserProfile`. Upload is hardened (5MB cap, MIME + PDF
  magic-byte checks, rate limit, `rawText` cap).
- **Target state:** capture fresher eligibility (batch year, branch, CGPA) for matching.

### 4.5 Data ingestion
- `scripts/ingest-jobs.js` reads `scripts/companies.json`, fetches from Greenhouse / Lever /
  Ashby, normalizes, scam-filters, upserts, and reconciles stale roles. Retries + connection
  hardening for reliability; nightly via GitHub Actions.
- **Target state:** fresher-eligible + messier sources with eligibility extraction.

---

## 5. Data models

**Job** — `companySlug`, `title`, `location`, `descriptionHtml`, `tags[]`, `applyUrl`,
`status` (`Active` | `Closed`), `lastSeenAt`, `closedAt`, timestamps. *Planned:* eligibility
fields (`batchYears[]`, `branches[]`, `minExperience`, `cgpaCutoff`, `roleType`).

**Application** — `userId`, `title`, `company`, `location`,
`stage`, `order`, `applyUrl?`, `notes?`, `jobId?`, `reminderAt?`, timestamps.

**UserProfile** — `userId` (unique), `name`, `title?`, `summary?`, `skills[]`,
`experience[]`, `education[]`, `rawText?`, timestamps. *Planned:* eligibility fields.

**Subscription** — `userId` (unique), `plan`, `status`, `provider*`, `currentPeriodEnd`,
`cancelAtPeriodEnd`. Read via `computeEntitlement`; powers Phase-2 premium and Phase-3 seats.

---

## 6. API surface

| Route              | Purpose |
|--------------------|---------|
| `GET  /api/health` | Health check |
| `/api/jobs`        | Ranked, tier-groupable feed (bounded candidate set) |
| `/api/tracker`     | CRUD + reorder for the user's board (enforces the free cap) |
| `/api/profile`     | Read/write profile; POST parses an uploaded resume |
| `GET  /api/entitlement` | Current user's plan/entitlement |

All data routes are token-guarded, per-user scoped, and rate-limited.

---

## 7. Security & privacy requirements
- ID tokens verified against Google public certs; no service-account key stored.
- Users can only read/mutate their own records (server-derived `userId`).
- Demo mode fails closed in production; user-supplied regex terms are escaped.
- Rate limiting on API routes; resume uploads size/type/text-bounded.
- Secrets live only in env vars. **Ops action:** rotate the `MONGODB_URI` before launch.

---

## 8. Success metrics (by phase — see BUSINESS_MODEL §6)
- **Phase 1 (free B2C):** WAU/MAU, week-4 retention, referral coefficient, % feed marked
  relevant, scams caught.
- **Phase 2 (premium):** free→paid conversion, ARPU, AI-feature → paid correlation.
- **Phase 3 (B2B2C):** institutions signed, seats, renewals, student placement outcomes.

---

## 9. Open questions
- Which **narrow beachhead** first (streams / role types / colleges)?
- Which fresher-eligible + messy **sources** to ingest, and what's ToS/legally safe?
- Which **eligibility fields** matter most to freshers (validate with real users)?
- Does **AI resume tailoring** measurably change outcomes (worth a thin prototype)?
- Which institutions are reachable for a **Phase-3 pilot**?

---

*See [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) for strategy and [FUTURE_WORK.md](./FUTURE_WORK.md)
for the backlog.*
