---
name: umbrix-auth-google-only
description: Umbrix auth is intentionally Google-only; never add email/password; phone-OTP is a post-launch experiment gated on signup-funnel data
metadata: 
  node_type: memory
  type: feedback
  originSessionId: df910e69-e8bd-45ad-8cd5-78b907c7d204
  modified: 2026-07-24T14:56:25.289Z
---

**Keep sign-in to ONE option: Google.** Owner decision (2026-07-24, launch eve).

**Why:** every target user (Indian students/freshers) already has a Google
account (Android + Gmail), so one-click, no-form, no-password is the
highest-converting flow — more options = paradox of choice = lower conversion.
Google also yields a verified email for free, which the match-digest emails
depend on, and avoids password-reset flows / credential-storage liability.

**How to apply:**
- Do NOT add email/password auth — ever. It's the worst option: more friction
  AND more liability for no gain.
- Do NOT add a second option "just in case." One good option beats two mediocre.
- Phone number + OTP is the ONLY addition worth considering, and only
  POST-LAUNCH, gated on data: it's the India consumer default (apna, Naukri,
  Internshala, Unstop, Paytm are phone-OTP-first), so it's a real lever for
  tier-2/3 freshers — but Firebase Phone Auth costs per SMS, needs reCAPTCHA,
  and India SMS deliverability is flaky ("OTP not received" is a top drop-off
  cause). Only build it if the analytics show the bottleneck: lots of
  `feed_view` but few `signup` = auth is the wall → then experiment with
  phone-OTP. If signup converts fine on Google alone, skip the flaky integration.

Auth stack: Firebase Google `signInWithPopup` (redirect fallback), authDomain =
`www.umbrix.in`, first-party proxied via next.config.ts. See the signup-funnel
instrumentation in [[umbrix-feed-index-built]] context (analytics events:
session_start / feed_view / apply_click / resume_upload / signup).
