/**
 * Match-digest job selection. Pure and dependency-free (like matchScore /
 * reminders) so it can be unit-tested without a DB or network. The caller does
 * the DB query (Active + India + recency) and passes candidates in; this scores
 * them against the user's profile and returns only the strong, fresh matches.
 *
 * Returning an empty array is meaningful: the caller MUST then skip the send.
 * We never email a low-value or empty digest — that protects both user trust and
 * sender reputation (see MATCH_ALERTS_PLAN.md §4).
 */

import { calculateMatch, type MatchProfile, type JobLike } from "./matchScore";

/** Only "good/strong" matches make the cut. Tunable. */
export const DIGEST_THRESHOLD = 80;
/** Cap the digest so it stays short and scannable. */
export const DIGEST_MAX_JOBS = 5;

/** A candidate job to score — the scoring fields plus what the email renders. */
export interface DigestCandidate extends JobLike {
  id: string;
  companyName?: string;
  companySlug: string;
  location: string;
  applyUrl: string;
}

/** A selected job, ready for the email template. */
export interface DigestJob {
  id: string;
  title: string;
  company: string;
  location: string;
  applyUrl: string;
  score: number;
  reason: string;
}

/**
 * Score `candidates` for `profile`, keep those at/above the threshold, and
 * return the top N by score. Empty result → caller skips the send.
 */
export function selectDigestJobs(
  profile: MatchProfile,
  candidates: DigestCandidate[],
  opts: { threshold?: number; max?: number } = {}
): DigestJob[] {
  const threshold = opts.threshold ?? DIGEST_THRESHOLD;
  const max = opts.max ?? DIGEST_MAX_JOBS;

  return candidates
    .map((job) => ({ job, match: calculateMatch(profile, job) }))
    .filter(({ match }) => match.score >= threshold)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, max)
    .map(({ job, match }) => ({
      id: job.id,
      title: job.title,
      company: job.companyName || job.companySlug,
      location: job.location,
      applyUrl: job.applyUrl,
      score: match.score,
      reason: match.matchSummary,
    }));
}
