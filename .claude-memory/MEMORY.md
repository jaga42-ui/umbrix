# Memory Index

- [UMBRIX repo is multi-machine](umbrix-repo-multi-machine.md) — local OneDrive clone drifts behind GitHub; git pull before working
- [Umbrix ingest overhaul](umbrix-ingest-overhaul-pending.md) — DONE + verified in prod 2026-07-23 (adapter split + staggered per-tier cron; both tiers dispatch-tested)
- [Umbrix feed always free](umbrix-feed-always-free.md) — feed is unlimited for everyone; never build a daily feed cap (CLAUDE.md's "15 cards/day" is void)
- [Umbrix feed index built](umbrix-feed-index-built.md) — {status,isIndia,createdAt} index is already live on prod Atlas (built manually, verified in use)
- [Umbrix auth Google-only](umbrix-auth-google-only.md) — keep sign-in to Google only; never add email/password; phone-OTP is a post-launch experiment gated on signup-funnel data
- [Umbrix roadmap](umbrix-roadmap.md) — post-launch priority order: 1) ingest expansion (Internshala/scrapers + company career pages), 2) PWA→Android→iOS, 3) legal pages, 4) SEO
