# UMBRIX — Business Model & Revenue Strategy

**Status:** Draft v1 (pre-feature strategy)
**Last updated:** 2026-07-09
**Owner:** Guruprasad Jena

> This document sets the revenue and business model **before** further features are
> built. Every item in [FUTURE_WORK.md](./FUTURE_WORK.md) should be justified against
> the model here. See [PRD.md](./PRD.md) for the product spec.

---

## 1. The core decision

**UMBRIX monetizes the job seeker, not the employer, via a premium subscription.**

This is the single most important strategic choice and it flows directly from the
product's positioning. UMBRIX already rejects the ad-and-volume model of traditional
boards ("existing boards optimize for volume and ad revenue, not the quality of the
match"). You cannot sell users a *calm, high-signal, scam-free* experience while also
selling employers access to those users' attention — those incentives conflict.

So the customer is the **high-performing job seeker**, and the thing they pay for is
**leverage in their own job search**: better roles, surfaced faster, with less noise
and less busywork.

---

## 2. Value proposition (what someone pays for)

| Buyer | Pain today | What UMBRIX sells |
|-------|-----------|-------------------|
| High-intent professional | Drowning in low-signal listings, duplicates, and scams; tracking their search in a dying spreadsheet | A curated, vetted daily feed + an effortless pipeline tracker + resume-aware personalization |

The felt value is **time and signal**: fewer, better roles and zero admin overhead
during one of the most stressful, high-stakes periods of a person's career. People pay
for that leverage precisely when the stakes are highest — an active job search.

---

## 3. Business model type

**B2C premium SaaS / subscription (freemium funnel).**

- Not a two-sided marketplace (yet). No employer side in the MVP — avoids the
  cold-start problem and the incentive conflict above.
- Not ad-supported. Ads would poison the premium positioning.
- Not placement-fee/recruiting. That would re-introduce the employer as the real
  customer and bias the feed toward who pays.

Free tier exists to prove value and feed the funnel; the premium tier is where the
value (personalization, unlimited pipeline, resume tooling) lives.

---

## 4. Revenue streams

### 4.1 Primary — UMBRIX Premium (subscription)
The engine. A recurring subscription unlocking the features that turn UMBRIX from a
"nicer job board" into a genuine search advantage.

### 4.2 Secondary (post-PMF, non-conflicting)
Only add these once the subscription is proven, and only where they don't compromise
feed neutrality:
- **Career-services affiliate / partnerships** — resume review, interview coaching,
  salary-negotiation services. Revenue share on referrals the user *chooses*, never
  injected into the core feed.
- **Annual / lifetime plans** — cash-flow smoothing and commitment pricing.

### 4.3 Explicitly deferred / rejected
- ❌ Display ads (conflicts with positioning).
- ❌ Selling user data (conflicts with trust; illegal in many jurisdictions).
- ⏸️ Employer-paid job posts / featured listings — only reconsider if UMBRIX ever
  deliberately pivots to a two-sided marketplace, and even then walled off from the
  curated feed's ranking.

---

## 5. Pricing (proposed)

A simple two-tier structure. Numbers are a starting hypothesis to test, not final.

| | **Free** | **Premium** |
|---|---|---|
| Price | $0 | **~$12–15/mo**, or **~$99/yr** (~40% off) |
| Daily Discovery Feed | ✅ Curated, scam-filtered | ✅ + **personalized ranking** (uses resume/profile) |
| Application Tracker | ✅ Limited (e.g. up to 10 active roles) | ✅ **Unlimited** + reminders/follow-ups |
| Resume profile | ✅ 1 resume, basic parse | ✅ Multiple resumes, editable structured profile |
| Feed filters/search | Basic | Advanced (remote, seniority, tags) |
| Email digest of matches | — | ✅ |

**Pricing rationale:** the target user earns well and is spending during a
high-stakes, time-boxed event (a job search). A ~$15/mo tool that lands them a better
role weeks sooner has enormous ROI — this supports a premium price point far above a
consumer-utility app. The annual discount pulls forward cash and rewards the users who
get the most value (a multi-month search).

**A note on churn by design:** a job-search tool has naturally high churn — people
succeed and leave. Lean into it: (a) annual plans capture the full search up front,
(b) an inexpensive "dormant" tier or easy pause keeps UMBRIX installed for the *next*
search, (c) the tracker's historical value gives a reason to stay subscribed at a low
tier between searches.

---

## 6. Unit economics — the levers to watch

Track these from day one; don't over-model them before there's data.

- **Conversion (Free → Premium):** the make-or-break metric. Personalization and the
  tracker limit are the primary conversion drivers — build them well.
- **ARPU / LTV:** driven by price × expected paying months. Given natural churn,
  **annual plan mix** is a huge LTV lever.
- **CAC:** must stay well below LTV. Favor low-cost, high-trust channels (content,
  community, referral) over paid ads for a premium/trust product — see §7.
- **Cost to serve:** ingestion, MongoDB, Firebase, Upstash, resume parsing, hosting.
  Low and mostly fixed at MVP scale; watch resume-parsing and ingestion as they grow.

Rule of thumb to protect: **LTV ≥ 3× CAC**, and payback within the typical search
window.

---

## 7. Go-to-market

The positioning ("for high performers") *is* the acquisition strategy — it earns
word-of-mouth in exactly the communities that matter.

1. **Content & SEO** — the repo already has a deep SEO toolchain. Rank for
   high-intent, high-quality-role queries and career-search pain points.
2. **Community-led** — niche professional communities, alumni networks, Slack/Discord
   groups where high performers congregate.
3. **Referral loop** — job seekers know other job seekers; give a reason to invite.
4. **The product as the funnel** — a genuinely useful free tier that users
   recommend unprompted. Free tier = top of funnel, not charity.

Avoid broad paid acquisition early — it burns cash and attracts low-intent users that
dilute the premium feel.

---

## 8. Key risks & assumptions

| Risk / assumption | Mitigation |
|---|---|
| **Will people pay for a job-search tool?** (biggest unknown) | Validate with a small paid pilot before deep feature investment. Willingness-to-pay is highest during active search — capture it there. |
| High natural churn (users succeed and leave) | Annual plans, pause/dormant tier, durable tracker history (§5). |
| Free tier too generous → no conversion | Gate the highest-leverage features (personalization, unlimited pipeline) behind Premium from the start. |
| Ingestion breadth (Greenhouse-only) limits feed value | Multi-source ingestion is a top FUTURE_WORK item — it directly gates perceived value and thus conversion. |
| Trust/quality erosion (scams, stale roles slip through) | Scam filter + feed freshness are not "nice to have" — they are the product's moat. Protect them. |

---

## 9. How this model reshapes the roadmap

Re-prioritize [FUTURE_WORK.md](./FUTURE_WORK.md) around **what converts free users to
paying ones** and **what protects the premium moat**:

- 🔴 **Personalized feed ranking** — the flagship Premium feature and #1 conversion
  lever. Highest ROI item on the list.
- 🔴 **Multi-source ingestion** — feed breadth gates perceived value → conversion.
- 🔴 **Scam filter + feed freshness** — the trust moat; both a retention and a
  positioning asset.
- 🟡 **Tracker limits + reminders** — the second conversion lever (free cap → paid
  unlimited).
- 🟡 **Billing infrastructure** — subscriptions, plans, entitlement gating (new;
  add to FUTURE_WORK once this model is accepted).
- 🟢 Employer-side features — do **not** build; off-strategy for now.

---

## 10. Open questions to resolve next
- What's the exact free-tier tracker cap that maximizes conversion without gutting
  the free experience?
- Monthly vs annual emphasis at launch — which do we push first?
- Which billing provider (Stripe is the default) and when does it get built?
- What's the minimum feed quality/breadth bar before charging anyone?
- Do we run a paid pilot to validate willingness-to-pay before building §5 in full?

---

*This is a living strategy doc. Revisit it whenever a major feature is proposed — if a
feature doesn't serve the model above, it's probably off-strategy.*
