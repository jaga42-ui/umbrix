# UMBRIX — Business Model & Revenue Strategy

**Status:** Draft v2 (strategy pivot)
**Last updated:** 2026-07-10
**Owner:** Guruprasad Jena

> **v2 is a hard pivot from v1.** v1 positioned UMBRIX as a premium subscription for
> "high-performing" (Western, senior) job seekers. That was wrong on two counts: the
> value was thin (non-proprietary jobs + replicable tooling) and the audience the code
> actually serves is different. This version re-centers on **Indian students / freshers**.
> See [PRD.md](./PRD.md) for the product spec and [FUTURE_WORK.md](./FUTURE_WORK.md) for
> the backlog this reshapes.

---

## 0. What v1 got wrong (so we don't repeat it)

- **The jobs aren't proprietary.** Public Greenhouse/Lever/Ashby feeds are the same roles
  on LinkedIn and company sites. "We surface jobs" is not payable on its own.
- **The tooling is replicable.** A tracker is a nicer Trello; heuristic skill-ranking is
  shallow. No "I can't do this myself" moment.
- **The inventory contradicted the audience.** The company list is elite US tech (Stripe,
  Anthropic, Ramp…) — roles a fresh Indian grad can't land — while the scam filter and IST
  schedule target **Indian freshers**. Proof of the mismatch: the scam filter has blocked
  **0 jobs every run**, because clean corporate ATS feeds don't contain fresher scams.

The lesson: value has to be leverage a fresher *can't get free*, on inventory they can
*actually use*.

---

## 1. Who this is for

**Indian students and freshers (0–2 yrs) looking for their first real job / internship.**

A massive market (millions of graduates/year) with acute, specific pain — and, critically,
one where UMBRIX's existing assets (scam detection, freshness/ingestion, matching) finally
line up with the user.

Their real pains (this is where value lives):
1. **Fraud & noise** — flooded with pay-to-apply scams, fake HR on WhatsApp, "₹40k WFH" bait.
2. **Eligibility confusion** — wasting time on roles that filter them out (batch year, branch,
   CGPA, "needs 3 yrs exp"). *The #1 time-sink.*
3. **Off-campus discovery** — openings scattered across LinkedIn, Telegram, company sites.
4. **Volume & speed** — hundreds of applications; early applicants get disproportionate callbacks.
5. **Breaking in** — an ATS-passable resume, tailored applications, interview prep.

---

## 2. The wedge — one integrated promise

> **UMBRIX finds the fresher jobs you're actually _eligible_ for, guarantees they're
> _real_ (not scams), and helps you _apply fast_ with AI.**

Three layers, not three products:
- **Relevance** (eligibility-aware matching) — the discovery layer. Kills pain #2.
- **Trust** (scam filter on messy real-world sources) — the quality guarantee. Kills #1.
  *This is the most ownable, emotional promise for this audience.*
- **Speed + AI** (fresh roles + AI-tailored resume/prep, assisted apply) — the action layer.
  Kills #4/#5 and is the thing people will actually pay for.

**Build order matters (focus is our only edge vs incumbents):**
1. **Now:** Relevance + Trust. Reuses existing matching + scam filter; forces the inventory
   fix that must happen anyway. Free — build the base.
2. **Next:** Speed + AI. AI resume tailoring per role becomes the premium tier and the
   proof-of-value we later sell to institutions.

---

## 3. Business model — phased

**Free B2C now → cheap premium → B2B2C (institutions).** Chosen because student
willingness-to-pay is the binding constraint, so we hedge it.

### Phase 1 — Free B2C (build trust + a base)
Give away Relevance + Trust. Goal is usage, retention, and word-of-mouth in colleges — not
revenue. Trust compounds: "the app that only shows real, eligible jobs" spreads.

### Phase 2 — Cheap premium (monetize the willing slice)
India-appropriate pricing (see §4). Premium = Speed + AI: AI resume/cover-letter tailoring,
priority/instant alerts, unlimited applications & tracking, interview prep. Monetize a small
% of a large free base.

### Phase 3 — B2B2C (the durable revenue)
Sell to **colleges, training institutes, and placement cells** — buyers *with budget*, using
proven student usage + outcomes as the pitch. Students keep it free; the institution pays per
seat / per placement cycle. This is where real money is, and it dodges the WTP problem.

**Still rejected:** employer-paid ranking / two-sided marketplace (incentive conflict), ads,
selling user data.

---

## 4. Pricing (hypotheses, India-calibrated)

Absolute ₹ price sensitivity is extreme — v1's $12–15/mo was a non-starter here.

| | **Free** | **Premium (Phase 2)** | **Institutional (Phase 3)** |
|---|---|---|---|
| Price | ₹0 | **~₹99–299 / mo** (test), annual discounted | Per-seat / per-cycle contract |
| Verified, eligible feed | ✅ | ✅ | ✅ (whole batch) |
| Scam filtering | ✅ | ✅ | ✅ |
| Application tracker | ✅ (capped) | ✅ unlimited + reminders | ✅ + placement-cell dashboard |
| AI resume/cover-letter tailoring | trial | ✅ | ✅ |
| Priority / instant new-role alerts | — | ✅ | ✅ |
| Interview / aptitude prep | teaser | ✅ | ✅ |

Ancillary (non-conflicting): revenue-share partnerships for prep courses / resume review the
user *chooses*.

---

## 5. Honest competitive reality

You are entering an occupied, well-funded space: **Internshala, Unstop, Naukri, apna,
LinkedIn.** "Another fresher job board" loses. UMBRIX wins only by being **sharper**: a
cleaner, *safer*, *actually-eligible* feed for a specific slice — not a broad board.

Pick a narrow beachhead first (candidate: **off-campus software/tech roles for CS/IT
freshers**, or **a specific set of colleges**). Own that, then expand streams. Trying to
serve every fresher on day one is how you lose to incumbents with more inventory.

---

## 6. Metrics that matter (by phase)

- **Phase 1:** WAU/MAU, week-4 retention, referral coefficient, % feed marked "relevant",
  scams caught (the trust proof — needs messier sources than today).
- **Phase 2:** free→paid conversion, ARPU, AI-feature usage → paid correlation.
- **Phase 3:** institutions signed, seats, renewal rate, student placement outcomes.

Protect: **LTV ≥ 3× CAC**. For this audience, favor organic/community/campus-ambassador CAC
over paid ads (low ARPU can't fund paid acquisition).

---

## 7. Key risks & assumptions

| Risk | Mitigation |
|---|---|
| **Students won't pay** (the core risk) | Don't depend on B2C revenue; B2B2C institutions are the real engine. B2C premium is upside, not the plan. |
| **Incumbents out-inventory / out-fund us** | Win on trust + eligibility relevance in a narrow niche, not breadth. |
| **Inventory pivot is real work** | The elite-US-company list must be replaced with fresher-eligible Indian/off-campus roles + eligibility data. This is the first product task, not a doc edit. |
| **Trust promise needs messy sources** | To prove "we filter scams," ingest where scams actually are — then the (currently idle) scam filter earns its keep. Raises moderation load; budget for it. |
| **B2B2C sales are slow/relationship-heavy** | Start Phase-1 free to generate the usage/outcomes that make institutional sales credible. |

---

## 8. How this reshapes the roadmap

The billing/entitlement work already built (Subscription model, `computeEntitlement`,
`BillingProvider` seam) is **not wasted** — it powers Phase-2 premium and Phase-3 seat
management. But the immediate priorities change:

- 🔴 **Inventory pivot** — replace the company list with fresher-eligible sources; add
  **eligibility metadata** (batch year, branch, min-experience, CGPA) to the `Job` model and
  matching. Without this the product doesn't serve the audience. *(New top priority.)*
- 🔴 **Trust in practice** — ingest messier sources so the scam filter actually fires; surface
  a visible "verified / scam-checked" signal on cards.
- 🟡 **AI resume/cover-letter tailoring** — the Phase-2 premium anchor (Vercel AI SDK / a model).
- 🟡 **Eligibility-aware ranking** — extend `matchScore` beyond skills to eligibility fit.
- ⏸️ **Billing checkout/webhooks** — still the "final boss," but now Phase-2, and priced in ₹.

---

## 9. Open questions to resolve next
- Which **narrow beachhead** first (which streams / colleges / role types)?
- Where do we ingest **fresher-eligible + messy** inventory (Internshala-style boards,
  Telegram channels, company fresher pages, government/PSU drives)? What's legal/ToS-safe?
- What eligibility fields do freshers filter on most (validate with real users)?
- Which institutions are reachable for a Phase-3 pilot (the founder's own network / college)?
- Does the AI-tailoring feature meaningfully change outcomes (worth a thin prototype to test)?

---

*Living doc. v2 pivot: Indian freshers, integrated trust/relevance/speed wedge, phased
B2C → premium → B2B2C. If a feature doesn't serve this, it's probably off-strategy.*
