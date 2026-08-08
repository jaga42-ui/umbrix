/**
 * Rule-based eligibility extraction.
 *
 * Ported from `scripts/ingest-jobs.js`. The regexes are reproduced faithfully
 * because they are precision-tuned against real Indian job descriptions, and
 * the tuning encodes a deliberate asymmetry recorded in the original: a false
 * "requires N years" HIDES a fresher-eligible role, which is the worst outcome
 * this product can produce. So every requirement pattern demands explicit
 * context and none of them fire on a bare "N+ years", which company
 * self-description ("25+ years of excellence") would otherwise trip.
 *
 * The LLM pass is intentionally NOT here: `src/lib/eligibilityExtractLLM.ts`
 * imports `server-only`, which throws outside a Next server context, so it
 * cannot run under the ingest runner. It stays in
 * `/api/cron/extract-eligibility` and upgrades these values afterwards.
 */

import type { Eligibility } from '@umbrix/core';
import { stripHtml } from '@umbrix/normalizer';

/**
 * Titles that are fresher-eligible on their own. "associate" is deliberately
 * excluded — it is ambiguous (Associate Director/Principal are senior).
 */
export const FRESHER_TITLE_RE =
  /\b(intern|internship|trainee|apprentice|junior|jr\.?|graduate|new\s?grad|entry[ -]level|campus)\b/i;
export const SENIOR_TITLE_RE =
  /\b(senior|sr\.?|staff|lead|principal|manager|director|head|vp|chief|architect)\b/i;

/** A title that, on its own, signals an early-career role. */
export function isFresherTitle(title?: string | null): boolean {
  const t = String(title ?? '');
  return FRESHER_TITLE_RE.test(t) && !SENIOR_TITLE_RE.test(t);
}

/**
 * Minimum years of experience a posting requires — the highest-value fresher
 * signal ("can a fresher even apply?"). Returns 0 for fresher/entry roles, the
 * stated number for experienced roles, or undefined when unknown.
 */
export function parseMinExperience(text?: string | null): number | undefined {
  const t = String(text ?? '').toLowerCase();
  const m =
    // N (+/range) years/yrs ... within 24 chars of experience/exp
    t.match(/(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*(?:years?|yrs?)[^.]{0,24}?\b(?:experience|exp)\b/) ||
    // experience/exp ... : N (+) years/yrs
    t.match(/\b(?:experience|exp)\b[^.]{0,14}?:?\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)/) ||
    // minimum / min / at least N (+) years/yrs
    t.match(/\b(?:minimum|min\.?|at\s*least)\s+(?:of\s+)?(\d{1,2})\s*\+?\s*(?:years?|yrs?)/) ||
    // explicit N–M years range, guarded against "N years ago/old" (company age)
    t.match(/(\d{1,2})\s*(?:-|–|to)\s*\d{1,2}\s*(?:years?|yrs?)\b(?!\s+(?:ago|old))/);

  const num = m ? parseInt(m[1], 10) : undefined;
  const validNum = num !== undefined && num >= 0 && num <= 30 ? num : undefined;
  const fresher =
    /\b(freshers?|entry[\s-]level|new\s?grads?|recent\s+graduates?|no\s+(?:prior\s+|relevant\s+|work\s+)?experience|experience\s+not\s+required|0\s*(?:-|–|to)\s*[12]\s*(?:years?|yrs?))\b/.test(t);

  if (validNum !== undefined && validNum >= 2) return validNum; // explicit requirement wins
  if (fresher) return 0;
  return validNum;
}

/** Graduating batch years a posting names (Indian-campus convention). */
export function parseBatchYears(text?: string | null): number[] {
  const t = String(text ?? '');
  const out = new Set<number>();
  const add = (s: string) =>
    (s.match(/20\d{2}/g) ?? []).forEach((y) => {
      const n = parseInt(y, 10);
      if (n >= 2020 && n <= 2030) out.add(n);
    });

  let m: RegExpExecArray | null;
  const re1 = /\b(?:batch|graduat\w*|class of|passing?\s*out)\b[^.]{0,40}?((?:20\d{2}[,/\s&]*(?:and\s*)?)+)/gi;
  while ((m = re1.exec(t))) add(m[1]);
  const re2 = /((?:20\d{2}[,/\s&]*(?:and\s*)?)+)(?:batch|graduates?|pass\s*outs?)\b/gi;
  while ((m = re2.exec(t))) add(m[1]);

  return [...out].sort((a, b) => a - b);
}

/** A stated CGPA cutoff (0–10 scale), when present. */
export function parseCgpa(text?: string | null): number | undefined {
  const t = String(text ?? '');
  const m =
    t.match(/(\d(?:\.\d)?)\s*(?:\+|and above|or above)?\s*(?:cgpa|gpa)\b/i) ||
    t.match(/\b(?:cgpa|gpa)\b\s*(?:of|:|>=|above|minimum|min\.?)?\s*(\d(?:\.\d)?)/i);
  if (m) {
    const n = parseFloat(m[1]);
    if (n > 0 && n <= 10) return n;
  }
  return undefined;
}

/**
 * Engineering branches / streams a posting names.
 *
 * New: the `branches` field exists on the schema and gates a paid filter, but
 * nothing ever populated it from rules — only the LLM pass could. Canonical
 * codes are used so "Computer Science", "CSE" and "B.Tech CS" agree.
 */
const BRANCH_PATTERNS: { code: string; re: RegExp }[] = [
  { code: 'CSE', re: /\b(cse|computer science|comp\.? sci|c\.?s\.?e)\b/i },
  { code: 'IT', re: /\b(information technology|i\.?t\.? branch)\b/i },
  { code: 'ECE', re: /\b(ece|electronics and communication|electronics & communication)\b/i },
  { code: 'EEE', re: /\b(eee|electrical and electronics|electrical & electronics)\b/i },
  { code: 'Electrical', re: /\belectrical engineering\b/i },
  { code: 'Mechanical', re: /\b(mechanical|mech\b)\s*(engineering)?\b/i },
  { code: 'Civil', re: /\bcivil\s*(engineering)?\b/i },
  { code: 'Chemical', re: /\bchemical\s*(engineering)?\b/i },
  { code: 'Biotech', re: /\b(biotech\w*|biomedical)\b/i },
  { code: 'Aerospace', re: /\b(aerospace|aeronautical)\b/i },
  { code: 'Instrumentation', re: /\binstrumentation\b/i },
  { code: 'MBA', re: /\b(mba|pgdm)\b/i },
  { code: 'BCom', re: /\b(b\.?com|bachelor of commerce)\b/i },
  { code: 'BSc', re: /\b(b\.?sc|bachelor of science)\b/i },
];

export function parseBranches(text?: string | null): string[] {
  const t = String(text ?? '');
  const out: string[] = [];
  for (const { code, re } of BRANCH_PATTERNS) {
    if (re.test(t) && !out.includes(code)) out.push(code);
  }
  return out;
}

/**
 * Extract every eligibility field a posting states.
 *
 * A clearly early-career title is authoritative for fresher-eligibility even
 * when the body never spells out "0 years" — this is what stops a source with
 * short excerpts leaving `minExperience` unstated, which then passes the
 * `$not: { $gte: 2 }` fresher filter on the SEO pages and publishes a
 * mid-level role as a fresher job.
 */
export function extractEligibility(title?: string | null, description?: string | null): Eligibility {
  // Cap the scanned text: these regexes are linear but run over every posting,
  // and no real job states its eligibility 20k characters in.
  const text = `${String(title ?? '')} ${stripHtml(String(description ?? ''))}`.slice(0, 20_000);

  const eligibility: Eligibility = { source: 'regex' };

  const batchYears = parseBatchYears(text);
  if (batchYears.length) eligibility.batchYears = batchYears;

  const branches = parseBranches(text);
  if (branches.length) eligibility.branches = branches;

  const minExperience = isFresherTitle(title) ? 0 : parseMinExperience(text);
  if (minExperience !== undefined) eligibility.minExperience = minExperience;

  const cgpa = parseCgpa(text);
  if (cgpa !== undefined) eligibility.cgpaCutoff = cgpa;

  return eligibility;
}

/**
 * Merge eligibility from several passes, strongest wins per field.
 *
 * Precedence is source > llm > regex: a connector reading a structured field is
 * asserting, an LLM reading prose is inferring well, and a regex is inferring
 * cheaply. A weaker pass must never overwrite a stronger one's value.
 */
const PRECEDENCE: Record<NonNullable<Eligibility['source']>, number> = { source: 3, llm: 2, regex: 1 };

export function mergeEligibility(base: Eligibility, incoming: Eligibility): Eligibility {
  const baseRank = PRECEDENCE[base.source ?? 'regex'];
  const incomingRank = PRECEDENCE[incoming.source ?? 'regex'];
  const strongerWins = incomingRank >= baseRank;

  const pick = <K extends keyof Eligibility>(key: K): Eligibility[K] => {
    const a = base[key];
    const b = incoming[key];
    if (b === undefined) return a;
    if (a === undefined) return b;
    return strongerWins ? b : a;
  };

  return {
    batchYears: pick('batchYears'),
    branches: pick('branches'),
    minExperience: pick('minExperience'),
    cgpaCutoff: pick('cgpaCutoff'),
    source: incomingRank >= baseRank ? incoming.source : base.source,
  };
}
