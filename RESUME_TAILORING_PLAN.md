# UMBRIX — AI Résumé Tailoring (Scope)

**Status:** Scope / design (pre-build)
**Last updated:** 2026-07-13
**Owner:** Guruprasad Jena

> Build item #4 from [FIRST_100K_PLAN.md](./FIRST_100K_PLAN.md): the **premium anchor**. For
> any job, generate a résumé tailored to *that* role — keyword-optimized, truthful, and
> **perfectly ATS-friendly** — and let the user **download** it. Per job, separately.

---

## 1. The core principle: LLM writes data, WE render the document

The LLM never emits a PDF/Word file directly (unreliable, breaks ATS). Instead:

```
profile résumé (UserProfile: skills, title, experience, education, rawText, summary)
   +  job (title, company, description, tags, minExperience)
        └─> LLM (structured output, Zod schema) → tailored résumé JSON
              └─> deterministic ATS-safe renderer → .docx download
```

We control the layout, so **every** output is ATS-safe by construction — the model only decides
*content* (what to emphasize, keyword phrasing, ordering), never *formatting*.

---

## 2. What "perfectly ATS-friendly" means (the renderer enforces all of this)

- **Single column.** No tables, text boxes, columns, images, icons, headers/footers, or
  page backgrounds — the top causes of ATS parse failure.
- **Standard sections in standard order:** Contact → Professional Summary → Skills →
  Work Experience → Education (+ Projects/Certifications if present).
- **Standard headings** ("Work Experience", not "Where I've Made Impact").
- **Real text**, standard font (Calibri/Arial 10–11pt), real bullet characters, consistent
  reverse-chronological dates (e.g. "Jan 2024 – Present").
- **Keywords woven naturally** from the job description into Summary/Skills/bullets — no
  keyword stuffing.
- **Truthful.** The model may re-emphasize, reorder, and rephrase what's already in the user's
  résumé; it must **never invent** roles, dates, employers, degrees, or skills the user lacks.
  This is a hard prompt constraint (ethical + practical — fabrications get caught in interviews).

---

## 3. LLM layer

- **Vercel AI SDK (`ai`) + `@ai-sdk/google`**, model `gemini-2.0-flash` (free tier — no paid
  keys). `generateObject` + a **Zod schema** guarantees consistent, parseable structure. Env:
  `GOOGLE_GENERATIVE_AI_API_KEY` (free from aistudio.google.com). Provider-agnostic call site,
  so swapping to Groq/another model later is one line.
- **Output schema:** `{ contact{name,email,phone?,location?,links[]}, summary, skills[],
  experience[{role,company,location?,start,end,bullets[]}], education[{degree,institution,year?}],
  projects?[], certifications?[] }`.
- **Prompt:** rewrite the user's real résumé to target this specific JD — reorder skills by
  relevance, rewrite the summary to the role, sharpen experience bullets with the JD's language
  and (where the user's data supports it) quantified impact. Explicit: do not fabricate; only
  use facts present in the source résumé.

---

## 4. Document generation

- **Primary: `.docx`** via the `docx` library — the ATS gold standard (parses most reliably).
  Deterministic template implementing every §2 rule. Filename: `{Name}_{Company}_{Role}.docx`.
- **Optional later: text-based PDF** (same single-column layout). Deferred — `.docx` covers the
  "perfectly ATS-friendly" requirement best; PDF is a nice-to-have.

---

## 5. Data model & storage

New `TailoredResume` collection: `{ userId, jobId, jobTitle, company, resume (structured JSON),
model, createdAt }`. Benefits: re-download is free (no re-generation), a "My tailored résumés"
history later, and it bounds LLM spend. A user must have a parsed résumé first (skills +
experience on `UserProfile`) — otherwise the UI prompts an upload.

---

## 6. Gating (premium anchor) — reuses the entitlements seam

Add `limits.resumeTailorsPerMonth` to `Entitlement` (`computeEntitlement`): **free = small trial
quota** (e.g. 3/month), **premium = null (unlimited)**. Usage = count of `TailoredResume` this
calendar month. Since billing checkout isn't built yet, *everyone* is effectively on the free
trial quota for now — enough to prove value and drive usage; the paywall flips on later with no
code change to this feature. Also rate-limit the LLM route (Upstash, already live).

---

## 7. API & UI

- **`POST /api/resume/tailor`** `{ jobId }` → auth → ensure résumé exists → quota + rate-limit →
  LLM → store `TailoredResume` → return structured résumé + id.
- **`GET /api/resume/tailor/[id]/download`** → renders the `.docx` on the fly from stored JSON,
  streamed as an attachment (auth-scoped to the owner).
- **UI:** a "Tailor résumé" action on the job (feed card + tracker) → modal: *generating…* →
  section preview → **Download .docx** + "tailored for {Company}". Empty-résumé → upload prompt.
  Quota shown; hitting it shows the premium upsell.

---

## 8. Cost, safety, phasing

- **Cost control:** per-user monthly quota + Upstash rate limit + stored results (no re-gen on
  re-download). Sonnet keeps per-tailor cost low.
- **Safety:** no-fabrication prompt constraint + a visible "review before you send" note.
- **Deps to add:** `ai`, `zod`, `docx` (+ AI Gateway key).
- **MVP:** .docx, trial quota for all, feed trigger, storage. **Later:** PDF, cover letters,
  history page, premium checkout, before/after diff.

---

## 9. Decisions (resolved 2026-07-13)

1. **Model — Google Gemini `gemini-2.0-flash` (free tier).** No paid API keys; Gemini's free
   tier (~1,500 req/day) has the best structured-output reliability among free options. Wired
   via the Vercel AI SDK `@ai-sdk/google` provider, so switching providers later is one line.
   Env: `GOOGLE_GENERATIVE_AI_API_KEY` (free from aistudio.google.com). ✅
2. **Format — `.docx` only.** The ATS gold standard. ✅
3. **Gating — trial quota for all.** Free `resumeTailorsPerMonth` (e.g. 3); premium = unlimited.
   Since checkout isn't built, everyone's on the trial for now; the paywall flips on later with
   no change to this feature. ✅
4. **Trigger — feed cards first** (tracker as a fast follow-up). ✅

### Build order
1. Deps: `ai`, `@ai-sdk/google`, `zod`, `docx`.
2. `Entitlement.limits.resumeTailorsPerMonth` in `computeEntitlement` (+ test).
3. `TailoredResume` model.
4. `src/lib/resumeTailor.ts` — Zod schema + Gemini `generateObject` + no-fabrication prompt.
5. `src/lib/resumeDocx.ts` — deterministic ATS-safe `.docx` renderer (+ pure-ish test).
6. `POST /api/resume/tailor` — auth, résumé check, quota, rate-limit, generate, store.
7. `GET /api/resume/tailor/[id]/download` — stream `.docx` from stored JSON.
8. Feed "Tailor résumé" button + modal (generating → preview → download).

---

*Living scope. Decisions resolved (§9); build proceeds. If a piece doesn't serve "truthful,
ATS-perfect, per-job," it's off-plan.*
