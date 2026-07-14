# Umbrix — Project Memory (read this first, every session)

> Cross-session ground truth. `CLAUDE.md` states the **rules/aspiration**; this file
> states **what is actually built and live** right now, plus the non-obvious gotchas you
> can't learn from the code alone. When they conflict, trust the code + this file, and ask
> the owner before "fixing" reality to match an aspirational rule.

**Last updated:** 2026-07-14 · **Owner:** Guruprasad Jena (gurup2076@gmail.com)

---

## 1. What Umbrix is (and where it lives)

A discovery feed of real, scam-checked, fresher-eligible jobs for Indian freshers **across
every field**, with personalized (field-aware) match scoring, résumé-aware profiles, an
application tracker, AI résumé tailoring, a public Scam Check tool, and daily match-alert
emails.

- **Live site:** https://www.umbrix.in (canonical; apex `umbrix.in` 308-redirects to `www`).
  Also reachable at `umbrix.vercel.app`.
- **Repo:** github.com/jaga42-ui/umbrix (branch `main`; commits go straight to main).
- **Owner is a fullstack dev** — their profile `targetFields: ["it"]`, Firebase uid
  `6DN7jk8fr7ZNeaCS9Gs25i6BJVg1`.

---

## 2. ⚠️ CLAUDE.md is aspirational — here's the REAL implementation

`CLAUDE.md` was populated with a generic ruleset that describes a system we do **not** have.
Do not build to it blindly. Actual reality:

| CLAUDE.md says | Reality |
|---|---|
| Job shape has `source`, `type: scholarship`, `department`, `content` max 500 | Adapters return `{ title, companyName, location, content, applyUrl, department }`; `content` capped at **4000**; **no `source` field** (removed); `type` is `job/internship/hackathon/competition` (default job), derived by `classifyType`; `isIndia`/`minExperience`/`status`/eligibility derived downstream in `processCompany`, not by adapters. |
| `upsertJob(normalizedJob)` helper | Doesn't exist. `processCompany()` does `Opportunity.bulkWrite` (upsert on `applyUrl`) + `reconcileStaleJobs`. |
| Adapters live in `/scripts/adapters/ingest-{name}.js` | No such dir. Adapters are `fetch*Jobs(slug, company)` functions **inside `scripts/ingest-jobs.js`**, registered in the `ATS_FETCHERS` map. |
| `normalizeCategory.js`, `CATEGORY_MAP` with `government`/`scholarship` | Doesn't exist. The real taxonomy is `JOB_FIELDS` in `src/lib/matchScore.ts` (18 fields), and a job's field is **derived at read time** from `companySlug` via `jobFieldFromSlug()` — not stored. |
| Staggered cron tiers (00/02/04/06 UTC) | One nightly ingest at **00:00 UTC** (GitHub Actions). Match-digest cron at **01:00 UTC** (Vercel). |
| matchScore neutral baseline = 50 | It's **70** (`neutralResult`). Cap is 99. |
| Never modify `scamFilter.js` | It **was** modified once (a real bug fix — `stripDisclaimers` split on every period, shattering emails/URLs). Behavior is pinned by `scamFilter.test.js`. |
| Reed/Internshala/Freshersworld/Unstop as sources | **Not built.** Reed = UK jobs (fails `isIndia`). Internshala/Freshersworld/Unstop = scrape-hostile + low-quality (per COMPETITORS.md) — deliberately avoided, same reason we killed Telegram. |

Eligibility fields (`batchYears`, `branches`, `cgpaCutoff`) exist on the model but are
**~0% populated** in practice (sources don't carry them parseably) → **deferred**. Only
`minExperience` (~49% populated) is used.

---

## 3. Stack & architecture (real)

- **Next.js App Router (TS)** + **MongoDB/Mongoose** + **Firebase auth** + **Upstash Redis**
  (rate limiting) + **Tailwind**. Ingest = **CommonJS** Node scripts in `/scripts/`.
- **Note in AGENTS.md:** "This is NOT the Next.js you know" — read `node_modules/next/dist/docs/`
  before writing Next code. It's Next **16** (App Router, Route Handlers, `params` is a Promise).
- **Models** (`src/models/`): `Opportunity` (collection pinned to **`jobs`**), `UserProfile`,
  `Application` (tracker), `Subscription` (billing seam), `TailoredResume`. Plus a raw `meta`
  collection for ingest bookkeeping.
- **Auth is first-party proxied:** `next.config.ts` rewrites `/__/auth/*` + `/__/firebase/*`
  to `<projectId>.firebaseapp.com`, and `authDomain` is set to the **visited domain**. This is
  why the custom-domain move needed env + Firebase + Google-OAuth changes (see §7).

---

## 4. Features built & live

| Feature | Status | Notes |
|---|---|---|
| Discovery feed (`/feed`) | ✅ | India-default, field-scoped candidates, match score, "Fresher-friendly"/"via Adzuna" labels. |
| Scam Check (`/scam-check`, `/api/scam-check`) | ✅ live, public | Reuses `scamFilter.js` + tiered verdict. Growth wedge. |
| Fresher-eligible filter | ✅ | `?fresher=1` → `minExperience {$ne:null,$lte:1}`. |
| AI résumé tailoring | ✅ live | Per-job, truthful, ATS-safe **.docx**. Button on feed **and** tracker. `/api/resume/tailor` (+ `/[id]/download`). Trial quota 3/mo (free), unlimited (premium). |
| LLM résumé parsing | ✅ live | `src/lib/resumeParseLLM.ts` at upload; heuristic `resumeParser.ts` is the fallback. Replaced the keyword parser that invented "AI" skills. |
| Field-aware matching | ✅ live | `JOB_FIELDS` + `jobFieldFromSlug`; `UserProfile.targetFields`; feed **scopes candidates to the user's field(s)** (see §6). |
| Match-alert emails | ✅ live | Daily digest via Resend from `alerts@umbrix.in`, cron 01:00 UTC / 6:30 AM IST. `selectDigestJobs` + `renderDigestEmail` + one-click unsubscribe. |
| Application tracker (`/tracker`) | ✅ | Kanban (Saved→Applied→Interview→Rejected), free cap 10 active. |
| Billing checkout/webhooks | ❌ | Entitlement seam exists (`computeEntitlement`, `Subscription`); no Razorpay yet. Everyone is effectively free/trial. |

Build order from `FIRST_100K_PLAN.md` (all done): 1 Scam Check · 2 Match emails · 3 Fresher
filter · 4 Résumé tailoring.

---

## 5. Inventory & ingest (real)

- **176 sources** in `scripts/companies.json`: greenhouse (129), lever (10), ashby (13),
  smartrecruiters (6), **adzuna (18 category shards)**. Every ATS slug is **verified live**
  before adding (must resolve + return India jobs).
- **~18,953 active jobs, ~6,419 India** (~1,550 of those are field "it").
- **ATS jobs = direct apply links + structured.** **Adzuna jobs = tracked redirect**
  (`adzuna.in/land/...`), can't be bypassed (bot-protected + affiliate ToS) → labeled
  "via Adzuna" on cards.
- **Adzuna** shards are `{ slug: "adzuna-in-<field>", ats: "adzuna", category: "<x>-jobs" }`;
  fetched via a field-agnostic fresher query. `ADZUNA_MAX_PAGES` default 8 (→ ~144 calls/run,
  under the free ~250/day cap). Category labeling is imperfect (some off-field jobs land in a
  shard).
- **Daily guard:** `ingestJobs()` refuses to run if `meta.lastRunAt` < 20h ago, unless
  `--force` / `FORCE_INGEST=1`. Ingest = `npm run ingest` / GitHub Actions nightly.
- **Big Indian employers (TCS/Infosys/Flipkart/Amazon India) use own portals, not these ATSes**
  — so ATS expansion is quality-over-volume; Adzuna provides breadth.

---

## 6. Match scoring (real — `src/lib/matchScore.ts`)

- `calculateMatch(profile, job)` → `{ score 0–99, matchingSkills, missingSkills, matchSummary,
  matchExplanation }`. No-résumé baseline = 70.
- Signals: **field alignment (dominant)** (+12 in-field / −16 off-field), skill overlap,
  domain alignment, seniority, description hits, fresher eligibility.
- **Field = the primary cross-field relevance signal.** `jobFieldFromSlug(slug)`:
  `adzuna-in-X → X`; anything else → `"it"` (ATS boards are software/product).
- **The feed API scopes candidates to the user's `targetFields`** (via `companySlug` `$or`)
  when they have any and aren't searching — critical: without it, the newest-`CANDIDATE_LIMIT`
  window gets starved of in-field jobs by recently-ingested Adzuna, and IT users saw HR/finance
  trainee roles. Search bypasses the scope (spans all fields).
- `UserProfile.targetFields` is set by the LLM parser (validated to `JOB_FIELDS`).

---

## 7. Infra, keys & the painful gotchas

**Vercel project:** slug **`umbrix`** (`.vercel/project.json` `projectName` says "hikari" —
stale label; the `projectId` `prj_sHjrCZf9wFticI5K8bTxmQUtmq0R` / team
`team_HazeqRsmjKnF1bugiW8f6jm1` are correct). CLI is authed as `jaga42-ui`.

**Firebase project:** `hikari-d7c84`.

**Vercel env (production)** — all set: `MONGODB_URI`, `NEXT_PUBLIC_FIREBASE_*`,
`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=www.umbrix.in`, `NEXT_PUBLIC_SITE_URL=https://www.umbrix.in`,
`GROQ_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM="UMBRIX <alerts@umbrix.in>"`, `CRON_SECRET`,
Upstash (`UPSTASH_REDIS_REST_*` / `KV_REST_API_*`), `GOOGLE_GENERATIVE_AI_API_KEY` (**dead**),
`VERCEL_OIDC_TOKEN`.

**GitHub Actions secrets** (for the nightly ingest only): `MONGODB_URI`, `ADZUNA_APP_ID`,
`ADZUNA_APP_KEY`. (Adzuna runs in CI, not the Vercel app.)

**GOTCHAS that will waste your time if you don't know them:**
1. **`vercel env pull` returns empty `""` for ALL encrypted vars here** (even `MONGODB_URI`,
   which obviously works). You **cannot** verify a value via pull. Verify build-time
   (`NEXT_PUBLIC_*`) vars by grepping the deployed HTML/JS; verify runtime vars by behavior.
2. **Git Bash cannot pipe stdin into `vercel.cmd`** on Windows (`printf ... | vercel env add`
   silently stores empty). **Always use `vercel env add NAME env --value "..."`.** (This once
   left `GROQ_API_KEY` empty in prod.) The CLI is at
   `C:\Users\gurup\AppData\Roaming\npm\vercel.cmd`.
3. `NEXT_PUBLIC_*` changes need a **redeploy** to take effect (baked in at build).
4. **Google auth on the custom domain** needed three things (all done): authDomain env =
   `www.umbrix.in`; add `www.umbrix.in`+`umbrix.in` to **Firebase → Auth → Authorized domains**;
   add `https://www.umbrix.in/__/auth/handler` (+ apex) + JS origins to the **Google Cloud OAuth
   web client** in project `hikari-d7c84`. Missing the last one = `Error 400 redirect_uri_mismatch`.
5. **Vercel API is flaky** (intermittent ECONNRESET / slow) — set env vars one at a time.

**Crons:** ingest = GitHub Actions `ingest-jobs.yml` `0 0 * * *`. Match-digest = `vercel.json`
`0 1 * * *` (auth via `CRON_SECRET`, which Vercel Cron sends automatically).

---

## 8. LLM setup (real)

- **Provider: Groq**, model **`openai/gpt-oss-120b`** (supports strict `json_schema`;
  `llama-3.3-70b` does **not**). Via `@ai-sdk/groq` + Vercel AI SDK (`ai` v7, `generateObject`).
- Shared resolver: **`src/lib/llmProvider.ts`** — Groq preferred, Gemini fallback. Used by
  both `resumeTailor.ts` and `resumeParseLLM.ts`.
- **Gemini's free tier returned `limit: 0` for this account** (unusable) → Groq is the active
  LLM. `GOOGLE_GENERATIVE_AI_API_KEY` remains set but dead.
- **Strict json_schema requires every property `required`** → schemas use `.nullable()` (not
  `.optional()`) for optional fields.

---

## 9. Known issues / next levers

- Adzuna category shards are imperfectly labeled (some off-field jobs in a shard). A deeper fix
  would re-categorize per-job (LLM), but that's ~19k calls → quota-prohibitive.
- Inventory depth for India is capped by ATS availability (big employers use own portals). Next
  real levers: government/PSU portals (need India-specific adapters) or accept Adzuna breadth.
- Billing checkout (Razorpay) unbuilt → no revenue mechanism live. Per `FIRST_100K_PLAN`, the
  first ₹1L is meant to come from a **B2B2C institutional pilot**, not B2C premium.
- First résumé/email sends: fresh domain, so early emails may land in spam until reputation builds.

---

## 10. Doc index

- `AGENTS.md` — "this is a modified Next.js, read the docs first."
- `CLAUDE.md` — rules/aspiration (see §2 caveats).
- `CURRENT_STATE.md` — the running state snapshot (this file supersedes/consolidates it).
- `BUSINESS_MODEL.md`, `PRD.md`, `COMPETITORS.md` — strategy.
- `FIRST_100K_PLAN.md` — go-to-market to first ₹1 lakh (free launch → proof → institutional pilot).
- `FUTURE_WORK.md` — backlog (incl. why Telegram was dropped).
- `MATCH_ALERTS_PLAN.md`, `RESUME_TAILORING_PLAN.md` — feature designs.

---

## 11. Working norms with the owner

- Commits go straight to `main`; owner says "push it" / "deploy it" per change. End commits with
  the `Co-Authored-By: Claude Opus 4.8` trailer.
- Owner is hands-on and blunt about quality — **verify features against real data before
  claiming done** (they've caught genuine bugs: "you have AI", HR jobs for a dev). Prefer
  scoring/parsing against their real profile (`rawText` in DB) over synthetic checks.
- Owner adds keys to `.env.local` (sometimes forgets to **save** the file — re-check). Don't
  paste secret values back in chat.
- Windows machine; use `--value` for Vercel env, and remember the OneDrive path can drift across
  machines (git pull first).
