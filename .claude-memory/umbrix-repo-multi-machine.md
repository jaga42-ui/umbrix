---
name: umbrix-repo-multi-machine
description: UMBRIX local OneDrive clone drifts behind the GitHub remote; git pull before working
metadata: 
  node_type: memory
  type: project
  originSessionId: 2645e24e-01d0-4c0d-bc40-c3e61b776d0d
---

The UMBRIX project (this repo, local path `C:\Users\gurup\OneDrive\Documents\HIKARI`,
GitHub remote `jaga42-ui/umbrix`) is developed from more than one place. On 2026-07-09
the local clone was found 20 commits behind `origin/main`, so work had been built on a
stale base (a rebrand done locally was already done on the remote).

**Why:** the user commits to `origin/main` from other machines / workflows, so the local
OneDrive copy goes stale between sessions.

**How to apply:** at the start of a session in this repo, run `git fetch` / `git pull`
(or compare `git rev-list --left-right --count origin/main...main`) and reconcile before
making changes. Don't force-push. Note the app was renamed HIKARI → UMBRIX; the folder
path is still `HIKARI` and `hikari-d7c84` (Firebase project id) is real infra, not
branding. Strategy docs live in-repo: `PRD.md`, `BUSINESS_MODEL.md`, `FUTURE_WORK.md`.
