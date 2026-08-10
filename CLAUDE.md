@AGENTS.md
# CLAUDE.md — Umbrix AI Development Rules

> This file governs every Claude Code session on the Umbrix codebase.
> Read this fully before touching any file. These rules are non-negotiable.

---

## What Umbrix is

A discovery feed of real, scam-checked, fresher-eligible jobs for Indian students and
fresh graduates — across every field — with personalized match scoring, resume-aware
profiles, and an application tracker.

**Mission:** The only Indian job platform that shows freshers only jobs they actually
qualify for — filtered by branch, batch year, CGPA, and experience level.

**North star metric:** Day-7 retention. A user who opens Umbrix 7 days after signup
means the feed is good enough. Optimize every decision toward this.

---

## Engineering charter (governs how, before what)

Act as principal architect and staff engineer on this codebase, not as a feature
implementer. Umbrix is a career operating system for Indian students and freshers, and
it should answer one question: **what is the fastest and safest path for this person to
get hired?** Question anything that doesn't serve that.

**When forced to choose, always prefer the latter:**

> adding a feature · improving architecture · improving reliability ·
> improving maintainability · improving user experience

If a proposed feature moves none of the metrics below, say so and recommend a better
alternative *before* building it.

**Metrics any change should move:** activation · DAU · weekly retention · jobs applied ·
interview rate · offer rate · scam-detection accuracy · job freshness · search quality ·
user trust.

**Quality targets:** 200,000+ active listings · <1% duplicates · <0.5% expired visible ·
99% scam-free. **Freshness beats volume. Quality beats quantity.**

**Sequence:** design → architect → implement → test → measure. Optimize for the best
long-term product, never for the fastest implementation.

**Measure before you claim.** Do not describe a source, a filter, or a fix as working
without evidence from a live run. Real defects found this way that a feature-first pass
would have shipped: an aggregator publishing mid-level roles as fresher jobs because
short excerpts left `minExperience` unstated (which *passes* the fresher filter); a
hardcoded source list in `fieldSlugConds` that hid every new source from its own page and
leaked it onto `/jobs/it`; and 22 orphaned listings that no code in the pipeline could
ever have closed.

**A source returning zero results means the connector is broken, not that the source has
no jobs.** Never treat it as a quiet success.

---

## Stack (never deviate without explicit instruction)

- **Frontend:** Next.js App Router (TypeScript)
- **Database:** MongoDB via Mongoose
- **Auth:** Firebase (`verifyFirebaseToken.ts`, `serverAuth.ts`)
- **Rate limiting:** Upstash Redis (`src/lib/rateLimit.ts`)
- **Styling:** Tailwind CSS
- **Ingest pipeline:** two systems during migration — the legacy orchestrator
  `scripts/ingest-jobs.js` (CommonJS) currently serves production, and the modular
  platform in `/packages/*` + `/apps/ingest` (TypeScript via `tsx`, no build step)
- **CI/CD:** GitHub Actions → Vercel
- **Ingest adapters:** `/scripts/adapters/ingest-{sourcename}.js`

---

## The normalized job shape (sacred — never change this without migration)

Every job source, scraper, and API adapter must produce exactly this shape before upsert:

```typescript
{
  title: string;           // Job title — title case
  companyName: string;     // Company name
  location: string;        // "City, State" or "Remote" or "Pan India"
  content: string;         // Full job description text (see the storage rule)
  applyUrl: string;        // Original listing URL — primary dedup key
  department: string;      // Normalized category (see CATEGORY_MAP)
  type: "job" | "internship" | "scholarship";
  isIndia: boolean;        // true if India-based role
  minExperience: number;   // 0 = fresher, 1 = mid, 3 = senior
  source: string;          // Source identifier e.g. "internshala", "reed"
  lastSeenAt: Date;        // Date.now() — stamped every ingest run
  status: "Active" | "Closed";
  // Eligibility fields (extract where available)
  batchYears?: number[];   // e.g. [2024, 2025]
  branches?: string[];     // e.g. ["CSE", "ECE", "Mechanical"]
  cgpaCutoff?: number;     // e.g. 7.0
  stipend?: number;        // Monthly stipend in INR (internships)
  salary?: string;         // Salary range string (jobs)
}
```

---

## Category normalization (CATEGORY_MAP)

Every adapter must map its raw categories to one of these normalized values.
Never invent new categories without updating this map everywhere:

```javascript
const VALID_CATEGORIES = [
  "it", "engineering", "finance", "marketing", "sales",
  "hr", "customer-service", "logistics", "healthcare",
  "teaching", "hospitality", "admin", "consultancy",
  "creative", "manufacturing", "retail", "graduate",
  "government", "internship", "scholarship", "general"
];
```

If a raw category has no clear mapping → use `"general"`.
Never leave `department` undefined or null.

**Implementation:** `normalizeCategory()` in `packages/normalizer/src/category.ts`, with
the list itself as `JOB_CATEGORIES` in `packages/core/src/job.ts`. This rule sat here
unimplemented for a long time — the mapper it referenced did not exist, so every source's
raw department string ("Engineering - Backend", "Sales & BD", "R&D") reached the database
verbatim and category was unusable as a filter. Use the shared mapper; do not hand-roll
one per connector.

Rule ordering in that file is load-bearing: narrow categories are matched before broad
ones, so "Sales Engineer" resolves to `sales` rather than `engineering`. Add new rules in
the correct position and cover them with a test.

---

## Ingestion platform (`/packages/*`, `/apps/ingest`)

New sources go here, not in `scripts/adapters/`. The legacy orchestrator still serves
production and is untouched until parity is proven per tier; both read the same
`scripts/companies.json` so they cannot drift.

Pipeline: **Source → Fetch → Normalize → Validate → Deduplicate → Scam → Eligibility →
Freshness → Store.** Every stage after `fetch` is pure, which is what makes a connector
testable without the network.

Each connector implements `fetch()` / `normalize()` / `validate()` / `healthCheck()`.
`normalize()` **must stay pure** — no network, no clock, no randomness — so fixtures pin
it exactly. Adding a source is a new file plus one line in the connector registry.

Rules that are easy to get wrong:

- **`--write` is required to touch the database; dry run is the default.** Never remove
  this. A local verification run once wrote 697 documents straight to production because
  the legacy script writes the moment `MONGODB_URI` is present.
- **Dedup is not `applyUrl` alone.** Aggregators re-list one role under many URLs (34%
  measured on one source), which defeats the upsert key entirely. Use `@umbrix/dedupe`.
- **The freshness sweep is the only thing that closes listings from a source that stopped
  running.** Per-slug reconciliation runs only after a *successful* fetch, so a removed or
  broken source reconciles nothing and its listings stay Active forever. Keep the sweep
  scheduled.
- **Eligibility precedence is `source` > `llm` > `regex`.** A weaker pass must never
  overwrite a stronger one. A connector reading a structured field is asserting; a regex
  is guessing.
- **Run `node scripts/validate-aggregator.js --source=<id>` before enabling any source.**
  It reports the share of postings that would publish as "fresher" without evidence —
  the check that kept a bad source out of production.
- The LLM eligibility pass stays in `/api/cron/extract-eligibility`: it imports
  `server-only` and cannot run under the ingest runner.

---

## Ingest pipeline rules (legacy orchestrator)

### Scraper ethics (follow every time, no exceptions)
- Only scrape public pages — no login, no auth bypass, no cookie injection
- **Store the full job description.** Matching needs it: a 500-character summary
  almost never contains a requirements list, so requirement extraction and
  résumé alignment had nothing to read. Cap at 20,000 characters, which holds a
  long posting without letting one pathological document bloat the collection.
  Only store descriptions from sources whose terms permit it.
- Always set User-Agent: `"UmbrixBot/1.0 (+https://umbrix.vercel.app/bot)"`
- Rate limit: minimum 2 seconds between requests to the same domain
- Respect robots.txt — check before writing any new scraper
- Upsert on `applyUrl` — idempotent, never duplicate

### Every adapter must
1. Loop through all target categories
2. Paginate until 1,000 jobs per category or no more results
3. Pass every job through `scripts/scamFilter.js` before upsert
4. Log progress: `[SOURCE] category / expLevel — N jobs ingested`
5. Log health alert if any category returns 0 results:
   `console.error('[HEALTH ALERT] sourceName returned 0 jobs for category')`
6. Export as `async function ingest{SourceName}()`
7. Return total count ingested this run

### Ingest file structure
```
scripts/
  ingest-jobs.js          ← main orchestrator
  scamFilter.js           ← scam detection (never modify without explicit instruction)
  validate-aggregator.js  ← pre-flight gate; run before enabling any new source
  adapters/
    ingest-adzuna.js
    ingest-reed.js
    ingest-internshala.js
    ingest-{sourcename}.js  ← new adapters go here
```

### Rate limit guard
The daily ingest guard (`meta.lastRunAt`, 20h minimum between runs) must never be
removed. Override only with `--force` flag or `FORCE_INGEST=1` env var.

### GitHub Actions cron schedule (stagger, never overlap)
```
00:00 UTC → Tier 1 APIs (Adzuna, Reed, Remotive, The Muse)
02:00 UTC → Tier 2 scrapers (Internshala, Freshersworld, Unstop)
04:00 UTC → Tier 3 ATS (Indian company career pages)
06:00 UTC → Tier 4 Government (NCS, PSU portals)
```

---

## Frontend rules

### User experience principles
- **New user lands on feed → must understand value in 5 seconds**
- Every job card must show: match score, eligibility badge, scam-verified stamp, apply URL
- Match score must be the first visual element on each card — not buried
- Empty states are never blank — always show "Upload your resume to see your match score"
- Loading states must exist for every async operation
- Mobile-first — majority of Indian fresher users are on mobile

### Component rules
- Never use HTML `<form>` tags — use onClick/onChange handlers
- All API calls go through `/api/` routes — never call MongoDB directly from components
- Auth state always from Firebase context — never from localStorage
- Guest/demo mode must always work — never block the feed behind mandatory signup

### Pages and their single jobs
| Page | Single job |
|---|---|
| `/` (landing) | Convert visitor to signup |
| `/feed` | Show the most relevant jobs for this user right now |
| `/profile` | Let user upload resume and set preferences |
| `/tracker` | Let user track application stages |

Never add features to a page that belong on a different page.

### UI copy rules (every label, button, toast)
- Active voice: "Save changes" not "Submit"
- Name things by what users control: "Your matches" not "Personalized results"
- Error messages say what went wrong AND how to fix it
- Empty screens invite action — never just say "No results found"
- Consistent vocabulary: a button that says "Apply" produces a toast that says "Applied"
- Sentence case everywhere except proper nouns

---

## Match scoring rules (`src/lib/matchScore.ts`)

The match score is Umbrix's core differentiator. Handle with care.

- Score range: 0–99 (never 100 — nothing is a perfect match)
- Always return an explanation string alongside the score
- Neutral baseline (score: 50) when no resume uploaded — nudge toward upload
- Fresher-eligibility (`minExperience: 0`) must boost score, not just filter
- Never show a score without a "why": "Matches your React skills and CSE branch"
- Score components: skill overlap, domain alignment, seniority fit, eligibility match

---

## Scam filter rules (`scripts/scamFilter.js`)

Never modify scamFilter.js without explicit instruction from the owner.
The scam filter is a trust signal — breaking it breaks the product's core promise.

If adding a new heuristic:
1. Add it as a weighted score, never a hard block (unless pay-to-apply)
2. Test against 20 real job descriptions before committing
3. Log every catch: `[SCAM CAUGHT] title — company — reason`
4. Never flag a legitimate "we never charge a fee" disclaimer as a scam signal

---

## Auth rules

- Firebase handles all auth — never roll custom auth
- Every API route must call `verifyFirebaseToken` before touching DB
- Guest mode: allow feed browsing without auth, block profile/tracker/apply
- Never store sensitive user data in cookies or localStorage

---

## Billing rules

The billing seam is scaffolded but checkout is not built yet.
`computeEntitlement` and `BillingProvider` exist — use them, don't bypass them.

**The feed is always free and unlimited for everyone — never cap it.** No
per-day job card limit, for guests or free accounts. The feed is the core value
and the Day-7 retention driver; capping it would fight the guest-mode and
"never block the feed behind mandatory signup" rules. Monetization comes from
other surfaces, never from feed volume.

Free tier (enforce via entitlement check):
- Unlimited feed access
- Basic search and location filters only
- No instant alerts

Paid tier (₹149–199/month — don't change pricing without instruction):
- Full eligibility filtering (batch/branch/CGPA)
- Instant match alerts
- AI resume tailoring
- AI cover letter generation

Never hardcode tier logic in components — always go through `computeEntitlement`.

---

## What Claude must never do

### Never touch without explicit instruction
- `scripts/scamFilter.js` — core trust signal
- `src/lib/matchScore.ts` — core differentiator
- `verifyFirebaseToken.ts` / `serverAuth.ts` — auth boundary
- MongoDB schema of `Opportunity` model — requires migration plan
- Billing entitlement logic — `computeEntitlement`, `entitlements.ts`
- GitHub Actions secrets or workflow trigger schedules

### Never do in any situation
- Bypass the daily ingest rate limit guard
- Scrape behind login walls or bypass auth
- Store a description from a source whose terms forbid it (check before adding a source)
- Add `console.log` in production API routes (use structured logging)
- Hardcode API keys, MongoDB URIs, or secrets anywhere in code
- Install a new npm package without checking if an existing utility covers it
- Change the normalized job shape without a migration plan
- Remove guest/demo mode
- Block the feed behind mandatory signup

### Never assume
- That a scraper returning 0 results means the source has no jobs — it means the scraper is broken
- That a new source's categories map cleanly to Umbrix categories — always normalize explicitly
- That a feature works on mobile just because it works on desktop — test at 375px width

---

## What Claude must always do

### Every code change
- Run TypeScript typecheck mentally before suggesting — no `any` types without comment
- Check if the change affects the normalized job shape — if yes, flag it
- Check if the change affects the scam filter — if yes, flag it
- Check if the change affects auth — if yes, flag it
- Add JSDoc comment to any new exported function

### Every new adapter
- Follow the adapter template exactly (see Ingest pipeline rules above)
- Test with `--source={sourcename} --dry-run` before full ingest
- Add to the health check summary log in `ingest-jobs.js`
- Add the corresponding GitHub Actions workflow file

### Every new UI component
- Mobile-first styling
- Loading state
- Empty state
- Error state
- Guest mode behavior (what happens if user is not logged in)

### Every new API route
- Auth check via `verifyFirebaseToken`
- Rate limit check via Upstash Redis
- Input validation before any DB query
- Consistent error response shape: `{ error: string, code: string }`

---

## File naming conventions

```
packages/connectors/src/{sourcename}.ts   ← NEW sources go here, lowercase
packages/{package}/src/{module}.ts        ← camelCase module
packages/{package}/test/{name}.test.ts    ← colocated with its package
scripts/adapters/ingest-{sourcename}.js   ← legacy orchestrator only
src/components/{Feature}/{Component}.tsx  ← PascalCase component
src/lib/{utility}.ts                      ← camelCase utility
src/app/api/{route}/route.ts              ← Next.js App Router convention
```

---

## Environment variables

```bash
# Required — never hardcode these
MONGODB_URI=
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
REED_API_KEY=
GROQ_API_KEY=           # AI resume tailoring
GEMINI_API_KEY=         # AI fallback
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# Optional
FORCE_INGEST=1          # bypass daily guard (dev only)
```

Always check `process.env.VAR_NAME` exists before using it in any script.
Log a clear error and exit if a required env var is missing.

---

## When you are unsure

1. Re-read this file
2. Check the existing pattern in the codebase before inventing a new one
3. Ask: "does this change move Umbrix closer to 1,000 jobs per category per experience level and Day-7 retention?" If no — don't build it
4. When in doubt between two approaches — pick the one with less surface area

---

## The disruption goal

Umbrix exists to disrupt the Indian fresher job market by being the only platform that:
1. Shows only jobs a user actually qualifies for (branch + batch + CGPA + experience)
2. Verifies every listing is scam-free before it reaches the feed
3. Explains exactly why each job matches the user's profile
4. Covers every field — not just IT — including government, scholarships, and internships

Every feature, every line of code, every adapter, every UI decision must serve one of these four. If it doesn't — don't build it.