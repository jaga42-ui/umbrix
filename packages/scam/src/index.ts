/**
 * Scam detection for the ingestion pipeline.
 *
 * The heuristics themselves are NOT reimplemented here. `scripts/scamFilter.js`
 * is the single source of truth, is pinned by `scripts/scamFilter.test.js`, and
 * CLAUDE.md forbids modifying it without explicit instruction — it is the trust
 * signal the whole product rests on. This module wraps it, exactly as
 * `src/lib/scamFilter.ts` already does for the app.
 *
 * What this module adds is the graded verdict the charter asks for. The
 * underlying filter answers one binary question (is the score at or above the
 * threshold). A binary answer throws away the distinction between "clean" and
 * "one weak signal fired", which is precisely the band worth reviewing rather
 * than silently dropping. Blocked postings never reach users; suspicious ones
 * are stored, flagged, and countable.
 */

import { createRequire } from 'node:module';
import type { NormalizedJob } from '@umbrix/core';

// The filter is CommonJS because the ingest runs outside the Next build.
// createRequire is the explicit, version-proof way to load it from an ES module.
const require = createRequire(import.meta.url);
const scamFilter = require('../../../scripts/scamFilter.js') as {
  evaluate: (input: { title?: string; content?: string; applyUrl?: string }) => RawVerdict;
  THRESHOLD: number;
};

interface RawVerdict {
  isScam: boolean;
  score: number;
  reasons: string[];
}

export type ScamVerdict = 'safe' | 'suspicious' | 'blocked';

export interface ScamAssessment {
  verdict: ScamVerdict;
  score: number;
  reasons: string[];
}

/** Score at or above which a posting is blocked. Owned by scamFilter.js. */
export const BLOCK_THRESHOLD: number = scamFilter.THRESHOLD;

/**
 * Any signal at all puts a posting in the suspicious band. Deliberately
 * sensitive: suspicious costs nothing (the job still ships, just flagged),
 * while a missed scam costs a user money and costs Umbrix its core promise.
 */
export const SUSPICIOUS_THRESHOLD = 1;

/** Assess a posting. Pure — no network, no clock. */
export function assessScam(job: Pick<NormalizedJob, 'title' | 'description' | 'applyUrl'>): ScamAssessment {
  const raw = scamFilter.evaluate({
    title: job.title,
    content: job.description,
    applyUrl: job.applyUrl,
  });

  let verdict: ScamVerdict = 'safe';
  if (raw.score >= BLOCK_THRESHOLD) verdict = 'blocked';
  else if (raw.score >= SUSPICIOUS_THRESHOLD) verdict = 'suspicious';

  return { verdict, score: raw.score, reasons: raw.reasons };
}

/** Whether a posting may be shown to users. */
export function isPublishable(assessment: ScamAssessment): boolean {
  return assessment.verdict !== 'blocked';
}
