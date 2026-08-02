# Umbrix — What's Built

**As of 2026-07-25** · Live at **[www.umbrix.in](https://www.umbrix.in)**

> A discovery feed of real, scam-checked, fresher-eligible jobs and internships for Indian
> students and fresh graduates — across every field — with personalized match scoring,
> résumé-aware profiles, and an application tracker.

---

## 1. Core product (what users do)

| Surface | What it does |
|---|---|
| **Discovery feed** (`/feed`) | India-default feed, candidates scoped to the user's field(s), **match score front-and-center**, "why this matches", tiered sections (Strong / Good / Explore), filters (search, location, category, India-only, fresher-eligible, quick tags), skeleton loading, load-more. |
| **Job cards** | Company monogram, experience + job-type + "posted X ago", **Fresher-friendly** badge, **Verified — No Scams** stamp, matched-skills summary, **"one skill to add"** gap nudge, Apply / Save / Tailor résumé. |
| **Activation flow** | No-résumé feed shows an activation card → upload → **"we found N skills → see your matches"** loop-closer back to the feed. |
| **Profile** (`/profile`) | Google-auth profile; **résumé PDF upload → LLM parsing** into skills / experience / education / target fields; editable skills; plain, student-facing copy. |
| **Application tracker** (`/tracker`) | Kanban stages (Saved / Applied / Interview / Rejected); free-tier active-application cap. |
| **Scam Check** (`/scam-check`) | Public tool that runs any posting through the scam filter — a growth wedge. |
| **Guest / demo mode** | The feed is browsable without mandatory signup. |

## 2. Match scoring (the core differentiator)

Transparent, explainable **0–99** score. Signals:
- **Skill overlap** — with alias canonicalization (JS↔JavaScript, Node↔Node.js, K8s↔Kubernetes…).
- **Discipline / domain alignment** — every field, incl. engineering sub-disciplines (mechanical, electrical, civil…) and trades; reads the résumé's skills, not just the title.
- **Seniority fit** — fresher/student-aware (entry roles read as a fit, not "below your level").
- **Fresher eligibility** — scaled experience penalty (a 10-yr role ranks far below a 3-yr one).
- **Field alignment** — an in-field role ranks well above off-field.
- Per-card "why" + a full match-report modal.

## 3. AI features

- **Résumé tailoring** — per-job, truthful, ATS-safe **.docx** (3/mo free, unlimited premium).
- **Résumé parsing** — LLM reads the uploaded PDF (Groq `gpt-oss-120b`, Gemini fallback).
- **LLM eligibility extraction** — a cron reads job descriptions to fill `minExperience` / batch / branch / CGPA where regex can't (precision-tuned; wired daily).

## 4. Job inventory & ingest pipeline

- **Sources (APIs only — no scraping):** ATS boards — **Greenhouse, Lever, Ashby, SmartRecruiters** (~160 companies incl. India: Groww, PhonePe, CRED, Meesho, Paytm, Freshworks, InMobi, fampay, Swiggy…); **Adzuna** aggregator (18 all-field India shards). **Jooble** adapter built + wired, **dormant** (drop in `JOOBLE_API_KEY` to enable).
- **~20k active opportunities, ~6,700 India.**
- **Architecture:** per-source `scripts/adapters/ingest-{source}.js`, registry-driven; **tiered staggered cron** (Tier 1 aggregators 00:00 UTC, Tier 3 ATS 04:00 UTC) with an independent per-tier rate guard.
- **Every posting** passes the scam filter; stale listings auto-reconciled to Closed; normalized job shape; category/field normalization.
- **Tooling:** inventory audit, company verifier, eligibility/precision scripts, backfills.

## 5. Analytics (first-party, in our own DB)

Events — **session_start** (DAU + D1/D7 retention), **feed_view**, **apply_click**, **save_job**, **resume_upload**, **signup**. Guest-friendly (anonymous id stitched to the account on sign-in). `node scripts/metrics.js` prints DAU, retention cohorts, and the activation funnel.

## 6. SEO

- **Programmatic pages:** `/jobs` hub, **`/jobs/<field>`** (16 fields), **`/jobs/<field>/<city>`** (16 × 15 cities). Each server-renders real fresher jobs + a **dynamic FAQ** (filled with real counts and company names) + breadcrumb structured data + internal links + a sign-in funnel. Thin city pages auto-**noindex** to avoid index bloat.
- **Technical:** `sitemap.xml`, `robots.txt`, site-wide **Organization + WebSite** JSON-LD.

## 7. PWA (installable app)

Web manifest, generated icons (192 / 512 / maskable / apple-touch / favicon), a **service worker** (offline shell; never caches `/api/` so jobs/matches stay fresh), theme-color, and Apple web-app metadata. The base for the future Android → iOS wrappers.

## 8. Auth

Firebase **Google sign-in** (popup + redirect fallback), first-party proxied auth on `www.umbrix.in`, verified-token API boundary. **Google-only by design** (phone-OTP is a post-launch experiment gated on funnel data).

## 9. Legal

`/privacy` and `/terms` — written to accurately reflect the real product (Google auth, résumé parsing via third-party LLMs, analytics, emails) and India DPDP-aware; "by continuing you agree…" consent line at sign-in.

## 10. Billing seam (scaffolded — no checkout yet)

Provider-agnostic `Subscription` model + `computeEntitlement` + entitlement API/hook. **Feed is always free.** Free tier caps tracker slots + résumé tailors; premium tier defined (eligibility filtering, alerts, AI tailoring/cover letters). **No payment provider wired — deliberately holding monetization until the analytics show engaged users hitting free limits.**

## 11. Stack & infrastructure

Next.js 16 (App Router, TypeScript) · MongoDB Atlas (Mongoose) · Firebase auth · Upstash Redis (rate limiting) · Tailwind CSS · Groq / Google Gemini (AI) · Resend (email) · Vercel (hosting + cron) · GitHub Actions (nightly ingest) · domain **www.umbrix.in**.

---

## Pending — owner actions (not code)

- **Submit the sitemap in Google Search Console** — triggers SEO indexing (highest leverage).
- **Add `JOOBLE_API_KEY`** — turns on the Jooble source and fills the city pages.
- **Set up `privacy@umbrix.in` / `support@umbrix.in` inboxes** — required grievance contact for the legal pages.
- **Verify `CRON_SECRET`** is set in Vercel (the eligibility + digest crons need it).
- **Add privacy/terms URLs to the Google OAuth consent screen** — moves toward a verified app (removes the "unverified app" sign-in warning).
- **Real-device mobile pass** — click through feed → apply → profile on an actual phone.
- **Have the legal pages reviewed by a lawyer** before relying on them (DPDP compliance).
