---
name: umbrix-recruiter-marketplace
description: "Reverse-marketplace (sell recruiters candidate access) is built but dormant — blocked on candidate supply, not code"
metadata: 
  node_type: memory
  type: project
  originSessionId: df910e69-e8bd-45ad-8cd5-78b907c7d204
  modified: 2026-07-25T15:09:31.437Z
---

Founder's revenue priority (as of 2026-07-25): ₹1-2L/month via a **reverse-marketplace — sell employers access to candidates, not visibility for jobs.** The structured resume/match data is the product. Consumer subscriptions are DEPRIORITIZED (Subscription/computeEntitlement scaffold left untouched, payment NOT wired). See [[umbrix-feed-always-free]] and [[umbrix-roadmap]].

**Shipped 2026-07-25 (commits 28a3912, defcbbc) — all built, mostly dormant:**
- BUILD 1 recruiter side: `RecruiterAccount` model (payg credits or monthly seat, `canUnlock()`), `CandidateUnlock` append-only audit log (basis for manual invoicing pre-Razorpay), `/api/recruiter/search` (anonymized cards — skills/field/education level/fresher/match%, zero PII), `/api/recruiter/unlock` (reveals PII, deducts credit or checks seat, idempotent per recruiter+candidate with refund on race), `/recruiter/search` page (un-onboarded users shown their Firebase uid to hand the owner). No self-serve signup — onboard via `scripts/admin/create-recruiter-account.js`.
- Candidate opt-in: `UserProfile.visibleToRecruiters`, **default OFF (DPDP consent)**, toggle on profile page. Recruiter access is keyed by Firebase uid = RecruiterAccount existence.
- BUILD 2 affiliate (live): `src/lib/skillCourses.ts` skill→course map (placeholder Coursera search URLs — **owner must swap for real affiliate links**), gap nudge on job cards + missing-skill chips in match modal now clickable, `gap_nudge_click`/`gap_course_view` events.

**THE BLOCKER — supply, not code:** DB has 1 profile, 0 opted-in. The recruiter marketplace is an empty room; a recruiter won't pay to search ~1 candidate. **Do not build more recruiter features** until the opted-in+skilled pool per field reaches ~100. The gating input is candidate acquisition/opt-in conversion.

**Watch the number:** `node scripts/admin/recruiter-supply.js` prints total/opted-in/SEARCHABLE(sellable) counts + by-field breakdown + verdict. Mirrors the search query exactly. Switch-on signal = a field crossing ~100 SEARCHABLE.
