# UMBRIX — Path to the First ₹1,00,000

**Status:** Draft v1
**Last updated:** 2026-07-12
**Owner:** Guruprasad Jena

> How I'd run UMBRIX to earn its **first ₹1,00,000 (₹1 lakh)** in real revenue, grounded in
> what the code does today — not generic startup advice. Reads alongside
> [BUSINESS_MODEL.md](./BUSINESS_MODEL.md), [COMPETITORS.md](./COMPETITORS.md),
> [PRD.md](./PRD.md), and [FUTURE_WORK.md](./FUTURE_WORK.md).

**Goal framing:** "first 100000" = the first **₹1 lakh** in revenue (the natural first-money
milestone for an India product). If the target is instead **$100K ARR**, the engine below is
identical — you just run the last phase (B2B2C) longer. The assumption changes the tactics,
not the strategy.

---

## 1. The uncomfortable truth to start from

The strategy docs already diagnose this; stating it plainly because it drives everything:
**today UMBRIX does not yet deliver its stated promise to its stated audience.**

- Feed is **13,056 jobs, only ~1,170 India** — and per `BUSINESS_MODEL.md §0`, mostly
  elite-US/senior roles "a fresh Indian grad can't land." Fresher-*eligible* India roles are
  only ~41 even with full eligibility detection.
- The **scam filter blocks 0 jobs every run** — clean corporate ATS feeds contain no fresher
  scams. The most emotional, ownable promise (**trust**) is **idle**.
- Eligibility fields (`batchYears`, `branches`, `minExperience`, `cgpaCutoff`) exist on the
  model but are **empty/unused** — so "eligibility-first" (the least-contested wedge in
  `COMPETITORS.md §3`) isn't live either.
- We **just removed Telegram** — correct for quality, but it was the only fresher-inventory +
  scam-proving source. So the two things worth paying for (real fresher inventory, an active
  trust layer) are both currently missing.

**Implication:** the plan is *not* "add a paywall." It's — make the free product genuinely
great for one narrow group, then capture money where budget actually exists. Monetizing a
product that doesn't keep its promise just buys churn and kills word-of-mouth.

---

## 2. Where the first ₹1L actually comes from

Three revenue paths from the model, scored on "fastest credible route to ₹1L":

| Path | ₹1L math | Speed to first ₹ | Eng needed | Verdict |
|---|---|---|---|---|
| **B2C subscription** ₹149/mo | ~670 paid-months; at 4% conv. needs ~4–5k engaged free users | Slow — fights "students won't pay" | Razorpay checkout + webhooks (the "final boss") | Upside, not the plan |
| **B2C micro-offer** ₹99 one-time | ~1,000 sales | Medium; good for *validation* | Checkout still needed | Proof + funnel, small ₹ |
| **B2B2C institutional pilot** | **1–2 deals at ₹50k–1L** = done | Fastest in absolute ₹ — one relationship | **None** — manual invoice | **This is the first ₹1L** |

The institutional pilot wins on **both** axes at once: fewest sales **and** zero billing
engineering. One placement cell / training institute in the founder's own college network,
paying for a batch license or placement-cycle pilot, *is* the ₹1 lakh. The docs already say
B2B2C is "where the real money is" and "dodges the WTP problem" — for the *first* ₹1L it's
also the quickest.

**Hard prerequisite:** a credible **proof artifact** — "N students at [college] used it, here
are the scams caught and the eligible roles surfaced." You can't cold-pitch a placement cell
with an empty story. So the free B2C launch isn't a separate strategy — **it's how you
manufacture the asset that closes the institutional deal.**

**The spine:**
> Free B2C launch → generates usage/outcomes proof → converts one warm institutional
> relationship → ₹1L. B2C micro-offers run alongside to validate willingness-to-pay for later.

---

## 3. The 90-day plan

### Phase 0 — Make the free product deliver (Weeks 1–2)
Nothing else matters until the beachhead's first session is genuinely useful.

1. **Fix inventory for the beachhead.** No Telegram needed. Add **Indian-fresher-eligible ATS
   sources** you can get cleanly: TCS/Infosys/Wipro/Cognizant fresher drives, Indian startups
   on Greenhouse/Lever/Ashby that hire 0-exp, government/PSU where feasible. Move active India
   *fresher-eligible* roles from ~41 into the hundreds. (`BUSINESS_MODEL.md §8` 🔴 top priority.)
2. **Turn on eligibility.** Populate `batchYears/branches/minExperience/cgpaCutoff` at ingest
   (you already parse `minExperience`; extend it) and rank on eligibility fit in
   `matchScore.ts` (it already has `FRESHER_BONUS`/`EXPERIENCED_PENALTY` scaffolding). Makes
   "only roles you're actually eligible for" real — **no incumbent does this.**
3. **Ship the trust layer as a *feature*, not a badge** — see Phase 1.

### Phase 1 — The Scam Check wedge + community launch (Weeks 2–5)
**Highest-leverage move in the plan, and cheap because `scamFilter.js` already exists.**

Build **"UMBRIX Scam Check": paste a job post / WhatsApp message / offer letter → instant
verdict** (real / suspicious / scam) with reasons, powered by `scamFilter` + a cheap LLM pass.
Why it's the maximum-value move:
- Attacks the **₹5,100 crore/year** scam pain (`COMPETITORS.md §0.2`) directly and emotionally.
- **Inherently viral/shareable** — "is this offer legit? check it on UMBRIX" spreads in the
  exact WhatsApp/Telegram groups the users live in → organic CAC, the only kind this
  low-ARPU audience can afford (`§6: LTV ≥ 3× CAC`).
- **Finally makes the scam filter earn its keep** — the user brings the messy input; we don't
  have to host messy inventory.
- Standalone reason to visit before the feed is perfect; every check is a signup prompt.

**Launch motion:** r/developersIndia, college CS WhatsApp/Discord groups, dev Twitter (the
beachhead channels in `§1`). Lead with Scam Check, **not** "another job board" (`§5` says that
loses). Instrument WAU, week-4 retention, referral coefficient, scams caught, % feed marked
relevant (`§6` Phase-1 metrics). **These numbers ARE the institutional pitch deck.**

### Phase 2 — Validate B2C willingness-to-pay (Weeks 4–8, parallel)
One low-friction, outcome-shaped paid micro-offer to learn whether students pay *at all*:
- **₹99 "Placement-season pack"**: AI resume tailoring per role + priority instant alerts +
  unlimited tracking (the Phase-2 premium anchor, `§4`). Only build Razorpay checkout once
  ~50 people ask. Data > revenue here — de-risks the "students won't pay" core risk *before*
  betting on it.

### Phase 3 — Close the institutional pilot = ₹1L (Weeks 6–12)
With proof in hand, take it to the **warmest** buyer with budget: the founder's own college
placement cell, a nearby tier-2/3 college (hungrier, underserved), or a training institute.
- **Pitch:** "Your students are getting scammed and wasting weeks on roles that filter them
  out. UMBRIX gives the whole batch a verified, eligibility-filtered feed + scam protection +
  a placement-cell dashboard. Here's [college X]'s usage: N students, M scams caught, K
  eligible roles surfaced."
- **Offer:** per-cycle pilot, **₹50k–1L** for a batch/placement season. **One or two = the
  entire goal**, invoiced manually — **zero billing infrastructure required.**
- The `Subscription` / `computeEntitlement` / `BillingProvider` seam already built powers seat
  management later; it's not needed to *invoice* the first pilot.

---

## 4. What NOT to do (focus is the only edge)

- **No broad "for every fresher" launch** — lose to Naukri/Internshala on breadth (`§5`).
  Own CS/tech grads first.
- **No employer-paid ranking, ads, or data resale** (`§3` rejects these) — they'd destroy the
  trust wedge that is the entire differentiation.
- **No premium features before the free product delivers** — paywall on a weak feed = churn.
- **No resurrecting Telegram scraping.** If that inventory is ever wanted, use the
  *follow-through* path (resolve apply link → ingest only if it lands on a real ATS), per
  `FUTURE_WORK.md`.
- **No hackathons/competitions yet** — Unstop's turf (`COMPETITORS.md §1`); later as a
  feature, not the identity.

---

## 5. Biggest risks → how this plan de-risks them

- **"Students won't pay"** (core risk) → the ₹1L comes from an institution, not students. The
  B2C micro-offer only *tests* WTP; it doesn't fund the goal.
- **"Trust is now contested"** (apna's AI Safety, `§1`) → execute it *deeply* as a standalone
  viral tool (Scam Check), not a badge, and pair with **eligibility relevance + respect** —
  the two least-contested wedges (`COMPETITORS.md §3`).
- **"Inventory pivot is real work"** → it's Phase 0, front-loaded, before any monetization.
- **"B2B2C sales are slow"** → the free launch runs first and manufactures the outcomes that
  shorten the sales conversation.

---

## 6. The one thing, if nothing else

**Ship Scam Check to r/developersIndia within two weeks.** Built on an asset already owned,
it turns the idle differentiator into the growth engine, costs almost nothing, and produces
the exact usage/outcome data that closes the first ₹1 lakh institutional deal. Everything else
sequences off that single move.

---

## 7. Immediate next code tasks (when ready to build)

- **(a) Scam Check feature** — a route + `scamFilter` reuse + a thin LLM layer over
  user-pasted text; shareable result page; signup prompt on each check.
- **(b) Inventory pivot** — audit `companies.json` for genuinely fresher-eligible Indian
  employers; wire up eligibility extraction (`batchYears/branches/minExperience/cgpaCutoff`)
  so `matchScore` can rank on eligibility fit.

---

*Living doc. If a feature or spend doesn't move UMBRIX toward the first ₹1L via the
free-launch → proof → institutional-pilot spine, it's probably off-plan.*
