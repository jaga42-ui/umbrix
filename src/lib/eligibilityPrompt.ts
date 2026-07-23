import { z } from "zod";

/**
 * Schema + prompt for LLM eligibility extraction. Pure (no server-only / SDK), so
 * the precision-gate script exercises the exact schema and prompt that ship.
 *
 * Tuned after the first precision run, which surfaced three failure modes:
 *  1. Missed explicitly-named degree branches ("B.Tech in Mechanical/Automobile").
 *  2. Left named trainee/GET programs as unknown instead of 0 (they're fresher
 *     roles by definition).
 *  3. Read a number out of vague wording ("strong experience" → 2), a false
 *     positive that would wrongly hide a role from freshers.
 */

export const jobEligibilitySchema = z.object({
  id: z.string().describe("The job id, copied EXACTLY from the input block."),
  minExperience: z
    .number()
    .nullable()
    .describe("Minimum years of experience required. A specific number ONLY if the posting states years; 0 for freshers/named trainee programs; null if experience is unstated or only described vaguely."),
  batchYears: z
    .array(z.number())
    .describe("Graduating batch years named as eligible (e.g. 2025, 2026). Empty if none stated."),
  branches: z
    .array(z.string())
    .describe("Degree branches / streams / disciplines the posting names as eligible (e.g. CSE, ECE, Mechanical, Automobile, B.Com, MBA). Empty ONLY if no degree/discipline is named."),
  cgpaCutoff: z
    .number()
    .nullable()
    .describe("Minimum CGPA/GPA on a 10-point scale if stated; null otherwise. Never convert a percentage into a CGPA."),
});

export const batchEligibilitySchema = z.object({ jobs: z.array(jobEligibilitySchema) });

/** One job's raw fields (schema-inferred), before validation/clamping. */
export type RawEligibilityLLM = z.infer<typeof jobEligibilitySchema>;

export const ELIGIBILITY_SYSTEM = [
  "You extract hiring eligibility from Indian job postings for a platform that shows freshers only roles they qualify for.",
  "Report ONLY what the posting states — never infer a number from vague wording. Rules:",
  "",
  "minExperience (minimum YEARS of professional experience required):",
  "- A specific number ONLY when the posting states years, e.g. '2 years', '3+ yrs', '2-4 years exp'. Take the LOWER bound of a range.",
  "- 0 when the posting is explicitly for freshers/entry-level, OR the role is a named trainee program — Graduate Engineer Trainee (GET), Management Trainee, Graduate Trainee, Apprentice, Campus/Fresher hire — since those are by definition for people with no professional experience.",
  "- null when experience is not addressed, OR is described only vaguely ('strong experience', 'experienced', 'hands-on') with NO number. Do NOT turn vague wording into a number.",
  "",
  "batchYears: any graduating / passing-out / batch years the posting names — catch phrasings like '2025 batch', '2025 and 2026 batch', '2026 pass-outs', 'class of 2025'. Empty only if no year is named.",
  "branches: if the posting names a required/eligible degree, stream, or discipline (CSE, ECE, Mechanical, Automobile, B.Com, B.E, MBA, ...), LIST it. Empty only when no degree/discipline is named.",
  "cgpaCutoff: minimum CGPA/GPA on a 10-point scale if stated; null otherwise. Do NOT convert a percentage (e.g. '60%') into a CGPA.",
].join("\n");

/** Max JD chars sent per job — eligibility is usually stated early; bounds token cost. */
export const PER_JOB_CHARS = 3000;

export function stripHtml(s: string): string {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Build the user prompt for a batch of jobs. */
export function buildEligibilityPrompt(items: { id: string; title: string; content: string }[]): string {
  const blocks = items
    .map((it) => `--- JOB id=${it.id} ---\nTitle: ${it.title}\n${stripHtml(it.content).slice(0, PER_JOB_CHARS)}`)
    .join("\n\n");
  return (
    "Extract eligibility for EACH job below. Copy each id EXACTLY as given. " +
    "Report only what the posting states; use null / empty arrays when unstated — never guess.\n\n" +
    blocks
  );
}
