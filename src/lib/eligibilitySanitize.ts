/**
 * Pure validation for LLM-extracted job eligibility. No server-only / SDK
 * imports, so it's unit-testable. Precision-first: a wrong `minExperience` HIDES
 * a fresher-eligible role, so every field is clamped to a safe range and unknown
 * values are omitted (never invented).
 */

/** One job's raw eligibility fields as returned by the LLM (pre-validation). */
export interface RawEligibility {
  id: string;
  minExperience: number | null;
  batchYears: number[];
  branches: string[];
  cgpaCutoff: number | null;
}

/** Validated eligibility for one job — unknown fields omitted. */
export interface ExtractedEligibility {
  minExperience?: number;
  batchYears: number[];
  branches: string[];
  cgpaCutoff?: number;
}

/** Clamp/validate one raw result into safe, storable values. */
export function sanitizeEligibility(raw: Partial<RawEligibility>): ExtractedEligibility {
  const out: ExtractedEligibility = { batchYears: [], branches: [] };

  if (typeof raw.minExperience === "number" && Number.isFinite(raw.minExperience)) {
    const n = Math.round(raw.minExperience);
    if (n >= 0 && n <= 30) out.minExperience = n;
  }
  out.batchYears = Array.from(
    new Set((raw.batchYears ?? []).filter((y) => Number.isInteger(y) && y >= 2020 && y <= 2030))
  ).sort((a, b) => a - b);
  out.branches = (raw.branches ?? [])
    .map((b) => String(b).trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 12);
  if (
    typeof raw.cgpaCutoff === "number" &&
    Number.isFinite(raw.cgpaCutoff) &&
    raw.cgpaCutoff > 0 &&
    raw.cgpaCutoff <= 10
  ) {
    out.cgpaCutoff = raw.cgpaCutoff;
  }
  return out;
}

/**
 * Map a batch's raw LLM results back to the requested ids, dropping any id the
 * model didn't return or invented (hallucination guard) and de-duping.
 */
export function assembleResults(
  requestedIds: string[],
  rawJobs: Partial<RawEligibility>[]
): Map<string, ExtractedEligibility> {
  const allowed = new Set(requestedIds);
  const result = new Map<string, ExtractedEligibility>();
  for (const j of rawJobs ?? []) {
    if (!j || typeof j.id !== "string" || !allowed.has(j.id) || result.has(j.id)) continue;
    result.set(j.id, sanitizeEligibility(j));
  }
  return result;
}
