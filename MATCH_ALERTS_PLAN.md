# UMBRIX — Match-Alert Emails (Scope)

**Status:** Scope / design (pre-build)
**Last updated:** 2026-07-13
**Owner:** Guruprasad Jena

> Build item #2 from [FIRST_100K_PLAN.md](./FIRST_100K_PLAN.md): a daily digest —
> *"3 new roles match your profile today"* — that pulls one-time visitors back into the
> feed. This is the **retention / WAU driver**, and WAU is the exact Phase-1 metric that
> becomes the institutional pitch. Reads alongside [CURRENT_STATE.md](./CURRENT_STATE.md).

---

## 1. Goal & success metric

Turn signups into **weekly-active users** by giving them a reason to return: a short, honest,
personalized email when genuinely new, high-fit roles appear. Success = **email → feed CTR**
and **week-4 retention** lift. Explicit non-goal: volume/blast email (that kills trust and
deliverability — the opposite of the brand).

---

## 2. Architecture (all reuses existing pieces)

```
Vercel Cron (daily, 01:00 UTC / 6:30 AM IST, after the 00:00 ingest)
   └─> GET /api/cron/match-digest   (auth: CRON_SECRET bearer)
         ├─ load opted-in UserProfiles (email + skills present)
         ├─ for each user: selectDigestJobs(profile, recentJobs)   ← pure, testable
         │     candidates = Active + isIndia + createdAt > lastSentAt
         │     score via calculateMatch (existing) → keep >= THRESHOLD → top N
         ├─ skip user if 0 qualifying jobs (never send an empty digest)
         ├─ render email (branded HTML + plaintext) with unsubscribe link
         ├─ send via Resend
         └─ on success: set emailAlerts.lastSentAt = now
```

Everything in the middle already exists: `Opportunity`, `UserProfile`, `calculateMatch`,
`rankByMatch`. New surface is small: a cron route, a mail sender, a template, an unsubscribe
route, and a few `UserProfile` fields.

---

## 3. Data model changes (`UserProfile`)

Add an `emailAlerts` subdocument:

```ts
emailAlerts: {
  enabled: boolean;          // opt-in state (default true on signup, one-click off)
  unsubscribeToken: string;  // random, unguessable; used by the unsubscribe link
  cadence: "daily";          // room for "weekly" later
  lastSentAt?: Date;         // dedupe window + "new since" cursor
}
```

- **Dedupe via `createdAt > lastSentAt`.** The ingest upserts by `applyUrl`, so a new posting
  gets a fresh `createdAt` while a reappearing one keeps its old one — meaning "jobs created
  since your last digest" is exactly "genuinely new roles." No separate sent-ids table needed.
- `email` already exists on `UserProfile` (captured on profile/resume save); users without an
  email are skipped.

---

## 4. Job-selection logic (the core; pure + unit-tested)

`selectDigestJobs(profile, recentJobs, now)` → `DigestJob[]`:
1. Candidates: `status: Active`, `isIndia: true`, `createdAt > (lastSentAt ?? now-24h)`.
2. Score each with `calculateMatch(profile, job)` (existing).
3. Keep `score >= DIGEST_THRESHOLD` (start at **80** — "good/strong" tier only; tune later).
4. Sort by score desc, take **top 3–5**.
5. Return `[]` if nothing qualifies → caller **skips** the send.

Kept pure (no DB/network) so it's testable like `matchScore`/`reminders` — a `.test.ts` pins
the threshold, the recency cutoff, and the "empty → skip" behavior.

---

## 5. Email: provider, template, deliverability

- **Provider: Resend** (recommended) — clean API, React/HTML templates, 3,000/mo + 100/day
  free, and it's a Vercel Marketplace integration (same easy wiring as Upstash). Env:
  `RESEND_API_KEY`, `EMAIL_FROM`.
- **Template:** branded, on-design (IBM Plex, ink palette). Subject: *"N new roles match your
  profile today"*. Body: top 3–5 cards (title · company · location · match % · one-line "why",
  Apply → `applyUrl`) + a *"See all in your feed →"* CTA to `/feed`. Plaintext alternative
  always included.
- **Deliverability (do these or land in spam):**
  - Verify a **sending domain** in Resend (SPF + DKIM + DMARC) — a real subdomain like
    `mail.umbrix.<domain>`; don't send from a raw vercel.app.
  - `List-Unsubscribe` + `List-Unsubscribe-Post` headers (one-click) on every send.
  - Never send empty/low-value digests (the §4 skip) — engagement protects sender reputation.

---

## 6. Unsubscribe & compliance

- **One-click unsubscribe:** `GET /api/alerts/unsubscribe?token=<unsubscribeToken>` flips
  `emailAlerts.enabled = false`, no login required; also wired into the `List-Unsubscribe`
  header. A matching toggle in `/profile` for re-subscribe / preferences.
- **Consent:** opt-in default **on** at signup with a visible notice ("we'll email you daily
  matches; unsubscribe anytime"). Only ever send to `enabled === true` with a stored email.
- **Legal footer:** sender identity + a physical mailing address (CAN-SPAM), honor unsubscribes
  promptly (GDPR/DPDP-friendly). No selling/sharing — consistent with the "respect the seeker"
  wedge in COMPETITORS.md §3.

---

## 7. Scheduling

- **Vercel Cron** (native, simplest): add to `vercel.json`/`vercel.ts`:
  `crons: [{ path: "/api/cron/match-digest", schedule: "0 1 * * *" }]`. Vercel calls it with
  the `CRON_SECRET` bearer; the route rejects anything else.
- Runs **1h after the ingest** (00:00 UTC) so "new" reflects the fresh pull, and lands at
  **6:30 AM IST** so users wake to it.
- **Scale note:** a single invocation looping all users is fine at launch (dozens–hundreds).
  When the base grows toward the 300s function timeout or Resend's daily cap, move to
  **batching / Vercel Queues** (chunk users, enqueue sends). Explicitly out of MVP scope.

---

## 8. Failure handling & idempotency

- Per-user `try/catch` — one bad send never aborts the batch; failures logged.
- `lastSentAt` updated **only on successful send**, so a crash mid-run re-attempts next run
  without double-emailing those already sent.
- A `?dryRun=1` mode (auth'd) that selects + renders but doesn't send — for safe verification,
  and a `?testTo=<uid>` to send a single real email to yourself.

---

## 9. New env vars

`RESEND_API_KEY`, `EMAIL_FROM` (e.g. `UMBRIX <jobs@mail.umbrix.app>`), `CRON_SECRET`,
`NEXT_PUBLIC_SITE_URL` (for absolute links in the email). All set in Vercel; `CRON_SECRET`
also protects the route locally.

---

## 10. Build checklist (in order)

1. `UserProfile.emailAlerts` fields + backfill `unsubscribeToken` for existing users; default
   `enabled: true`.
2. `src/lib/digest.ts` — pure `selectDigestJobs()` + `DIGEST_THRESHOLD` + `digest.test.ts`.
3. `src/lib/email/` — Resend client + digest template (HTML + plaintext) + `List-Unsubscribe`.
4. `GET /api/cron/match-digest` — auth, load users, select, send, stamp; `dryRun`/`testTo`.
5. `GET /api/alerts/unsubscribe` + `/profile` toggle + signup consent copy.
6. `vercel.json`/`vercel.ts` cron entry; set env vars; verify sending domain in Resend.
7. Verify: `dryRun` locally → `testTo` a real inbox → enable cron. Update CURRENT_STATE.md.

---

## 11. Decisions (resolved 2026-07-13)

1. **Mail provider — Resend.** ✅
2. **Sending domain — deferred.** No custom domain yet; one will be bought later. Until then we
   build and test against Resend's test sender (`onboarding@resend.dev`), which can only deliver
   to the account owner's own verified email. **Broad sends stay gated** until a domain is bought
   and verified (SPF/DKIM/DMARC) — that's the single remaining step before public launch.
3. **Opt-in — on by default**, with a visible notice + one-click unsubscribe. ✅
4. **Cadence — daily.** ✅
5. **Selection — top 5 at score ≥ 80** to start; tunable. ✅

### Build phasing given the deferred domain
- **Buildable now (no domain needed):** `UserProfile.emailAlerts` fields, pure
  `selectDigestJobs()` + tests, the digest template (HTML + plaintext), the cron route (behind
  `CRON_SECRET`, with `dryRun`/`testTo`), the unsubscribe route + profile toggle. Verify via
  `dryRun` (renders, no send) and `testTo` a personal inbox through Resend's test sender.
- **Gated until the domain is bought + verified:** enabling the daily cron for the whole opted-in
  base, and `EMAIL_FROM` on the real domain. Flipping this on is a config change, not code.

---

*Living scope. Decisions resolved (§11); build may proceed on the domain-independent parts. If a
piece doesn't serve retention-with-trust, it's off-plan.*
