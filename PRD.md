# UMBRIX — Product Requirements Document

**Status:** MVP (in development)
**Last updated:** 2026-07-08
**Owner:** Guruprasad Jena

---

## 1. Overview

UMBRIX is a minimalist, premium career discovery platform built for high performers.
It reduces the noise of traditional job boards into two focused surfaces: a curated
**Daily Discovery Feed** of vetted roles, and a **Kanban-style Application Tracker**
for managing an active job search end to end. A resume-aware profile ties the two
together so discovery can eventually be personalized to the user's real experience.

### 1.1 Problem

Job seekers — especially strong candidates — are drowning in low-signal listings,
duplicate postings, and outright scams. Existing boards optimize for volume and ad
revenue, not for the quality of the match or the calm of the experience. Tracking
applications then spills into spreadsheets that no one maintains.

### 1.2 Solution

A small, opinionated product that:
- Ingests roles directly from company ATS feeds (Greenhouse and Lever today),
  filtering out scams and noise before they ever reach the user.
- Presents a limited, high-quality daily feed instead of an infinite scroll.
- Lets users save roles into a drag-and-drop tracker with clear pipeline stages.
- Builds a structured profile from an uploaded resume to power future personalization.

### 1.3 Target user

High-intent professionals actively managing a job search who value signal, speed,
and a clean interface over exhaustive listings.

---

## 2. Goals & non-goals

### Goals (MVP)
- Deliver a curated feed of active, legitimate roles sourced from real ATS data.
- Provide a persistent, per-user application tracker with pipeline stages.
- Authenticate users securely and scope all data strictly to the owning user.
- Extract a structured profile from an uploaded resume (PDF).
- Ship a production-ready, secure, performant Next.js application.

### Non-goals (MVP)
- Recommendation/ranking ML — the feed is curated, not personalized yet.
- Further ATS ingestion sources beyond Greenhouse and Lever.
- Recruiter/employer side of the marketplace.
- Messaging, applications submitted through UMBRIX, or in-app apply.
- Mobile native apps.

---

## 3. Tech stack

| Layer      | Technology |
|------------|------------|
| Frontend   | Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion |
| Backend    | Next.js API Routes / Server Components (Node.js) |
| Database   | MongoDB via Mongoose |
| Auth       | Firebase Authentication (ID-token verification, no service-account key) |
| Rate limit | Upstash Redis + `@upstash/ratelimit` |
| Ingestion  | Standalone Node.js script against public ATS APIs (Greenhouse, Lever) |
| Drag & drop| `@hello-pangea/dnd` |
| Resume     | `pdf-parse` |

---

## 4. Core features & requirements

### 4.1 Authentication
- Firebase Authentication with Google sign-in (popup, with redirect fallback when the
  popup is blocked); Firebase Auth served first-party via a proxy for reliable redirect
  persistence.
- All `/api/*` data routes require a valid Firebase ID token
  (`Authorization: Bearer <token>`), verified server-side against Google's public
  signing certificates. The user id is derived from the token — client-supplied
  `userId` values are ignored.
- **Demo mode:** if Firebase is left unconfigured (placeholder values), the app falls
  back to mocked auth and dummy data, and token enforcement is skipped. Useful for
  local UI work.

### 4.2 Daily Discovery Feed (`/feed`)
- Displays a curated set of active roles, each rendered as a `JobCard`
  (title, company, location, tags, apply link).
- Backed by the `Job` collection (`GET /api/jobs`).
- Users can save a role directly into their tracker.

### 4.3 Application Tracker (`/tracker`)
- Kanban board with four stages: **Saved → Applied → Interview → Rejected**.
- Drag-and-drop between columns and reordering within a column, persisted per user.
- Backed by the `Application` collection (`/api/tracker`).
- Each card supports notes, an apply URL, and an optional link back to the source job.

### 4.4 Profile (`/profile`)
- Users upload a resume (PDF); the server parses it into a structured
  `UserProfile` (name, title, summary, skills, experience, education, raw text).
- Backed by `/api/profile`.
- Intended as the personalization substrate for future feed ranking.

### 4.5 Data ingestion
- Standalone script (`scripts/ingest-jobs.js`) reads `scripts/companies.json`, fetches
  postings from public ATS APIs (Greenhouse, Lever), normalizes them into the `Job`
  schema, and applies a heuristic scam filter.
- Runs in **dry-run mode** (fetch + filter, no DB writes) when `MONGODB_URI` is absent.

---

## 5. Data models

**Job** — `companySlug`, `title`, `location`, `descriptionHtml`, `tags[]`, `applyUrl`,
`status` (`Active` | `Closed`), timestamps.

**Application** — `userId`, `title`, `company`, `location`,
`stage` (`Saved` | `Applied` | `Interview` | `Rejected`), `order`, `applyUrl?`,
`notes?`, `jobId?`, timestamps. Compound index on `{ userId, stage, order }`.

**UserProfile** — `userId` (unique), `name`, `email?`, `title?`, `summary?`,
`skills[]`, `experience[]` (role/company/duration/description), `education[]`,
`rawText?`, timestamps.

---

## 6. API surface

| Route              | Purpose |
|--------------------|---------|
| `GET  /api/health` | Health check |
| `/api/jobs`        | Read curated jobs for the feed |
| `/api/tracker`     | CRUD + reorder for the user's application board |
| `/api/profile`     | Read/write the user's parsed resume profile |

All data routes are token-guarded and per-user scoped. Requests are rate-limited via
Upstash.

---

## 7. Security & privacy requirements
- ID tokens verified against Google public certs; no service-account key stored.
- Users can only ever read or mutate their own records (server-derived `userId`).
- Rate limiting on API routes to mitigate abuse.
- Secrets (`MONGODB_URI`, Firebase config) live only in environment variables and
  must never be committed. **Action item:** the current `MONGODB_URI` in `.env.local`
  contains live credentials — rotate it and confirm `.env.local` is git-ignored.

---

## 8. Success metrics (proposed)
- Activation: % of signed-up users who save ≥1 role to the tracker.
- Engagement: weekly returning users viewing the feed.
- Pipeline depth: median applications advancing past **Applied**.
- Feed quality: scam/duplicate rate reaching the feed (target ≈ 0).
- Profile adoption: % of users who upload a resume.

---

## 9. Open questions
- How large should the "daily" feed be, and how is freshness/rotation defined?
- What is the exact heuristic for the scam filter, and how is it tuned/evaluated?
- When Firebase is unconfigured, should demo mode ship to production or be dev-only?
- What is the personalization roadmap once profiles exist (see FUTURE_WORK.md)?

---

*See [FUTURE_WORK.md](./FUTURE_WORK.md) for the backlog and planned enhancements.*
