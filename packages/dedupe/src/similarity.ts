/**
 * Duplicate confidence scoring and best-version selection.
 *
 * `identityKey` groups exact duplicates cheaply. This module handles the harder
 * case: two postings that are the same job but disagree slightly — "Software
 * Engineer I" vs "Software Engineer (I)", or the same role listed by the
 * company and by an aggregator with a truncated description.
 *
 * The charter asks for semantic similarity. True embeddings need a model and a
 * vector store, which Phase 1 has neither of, so this uses lexical similarity
 * over normalized token sets. That is honest about what it is: it catches
 * wording and ordering differences, not synonyms ("SDE" vs "Software
 * Engineer"). A synonym table or embeddings can slot in behind `titleSimilarity`
 * without changing any caller.
 */

import type { NormalizedJob } from '@umbrix/core';
import { extractCity } from '@umbrix/normalizer';
import { companyKey, titleTokens, canonicalUrl } from './identity';

/** Jaccard overlap of two token sets: |A ∩ B| / |A ∪ B|. */
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let intersection = 0;
  for (const token of a) if (setB.has(token)) intersection++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

/** 0..1 similarity of two job titles. */
export function titleSimilarity(a: string, b: string): number {
  return jaccard(titleTokens(a), titleTokens(b));
}

export interface DuplicateVerdict {
  /** 0..1. At or above DUPLICATE_THRESHOLD the pair is treated as one job. */
  confidence: number;
  /** Which signals agreed — kept so a wrong merge can be explained. */
  reasons: string[];
}

/**
 * Weights sum to 1.0. Company agreement dominates: two different companies
 * hiring an "Associate Software Engineer" in Bengaluru are emphatically not the
 * same job, and no amount of title similarity should merge them.
 */
const WEIGHTS = { company: 0.4, title: 0.35, city: 0.15, timing: 0.1 } as const;

/** Postings more than this many days apart are likely a genuine repost. */
const REPOST_WINDOW_DAYS = 45;

export function scoreDuplicate(a: NormalizedJob, b: NormalizedJob): DuplicateVerdict {
  const reasons: string[] = [];

  // An identical canonical URL is conclusive on its own — no weighting needed.
  if (canonicalUrl(a.applyUrl) === canonicalUrl(b.applyUrl)) {
    return { confidence: 1, reasons: ['identical apply URL'] };
  }
  if (a.sourceJobId && b.sourceJobId && a.sourceId === b.sourceId && a.sourceJobId === b.sourceJobId) {
    return { confidence: 1, reasons: ['identical source job id'] };
  }

  const companyA = companyKey(a.companyName);
  const companyB = companyKey(b.companyName);
  // Unknown company is neutral (0.5), not disagreement — an aggregator that
  // omits the employer must not be scored as a different employer.
  let companyScore = 0.5;
  if (companyA && companyB) {
    companyScore = companyA === companyB ? 1 : 0;
    reasons.push(companyScore === 1 ? 'same company' : 'different company');
  }

  const title = titleSimilarity(a.title, b.title);
  if (title >= 0.8) reasons.push('near-identical title');

  const cityA = extractCity(a.location);
  const cityB = extractCity(b.location);
  let cityScore = 0.5;
  if (cityA && cityB) {
    cityScore = cityA === cityB ? 1 : 0;
    if (cityScore === 1) reasons.push('same city');
  }

  let timingScore = 0.5;
  if (a.postedAt && b.postedAt) {
    const days = Math.abs(a.postedAt.getTime() - b.postedAt.getTime()) / 86_400_000;
    timingScore = days <= REPOST_WINDOW_DAYS ? 1 : 0;
    if (timingScore === 0) reasons.push('posted far apart (likely repost)');
  }

  const confidence =
    companyScore * WEIGHTS.company +
    title * WEIGHTS.title +
    cityScore * WEIGHTS.city +
    timingScore * WEIGHTS.timing;

  return { confidence, reasons };
}

/** Confidence at or above which two postings are merged. */
export const DUPLICATE_THRESHOLD = 0.82;

/**
 * Pick the version to keep from a duplicate group.
 *
 * Richer descriptions win because every downstream stage reads that text —
 * eligibility extraction, scam detection and skill tagging all degrade on a
 * truncated aggregator teaser. A 120-character excerpt is precisely what left
 * `minExperience` unstated on one source and floated mid-level roles onto the
 * fresher SEO pages, so completeness here has a measured consequence.
 */
export function selectBest<T extends NormalizedJob>(candidates: T[]): T {
  if (candidates.length === 1) return candidates[0];
  return [...candidates].sort((x, y) => {
    // A posting whose source asserted eligibility outranks one that inferred it.
    const assertedX = x.eligibility.source === 'source' ? 1 : 0;
    const assertedY = y.eligibility.source === 'source' ? 1 : 0;
    if (assertedX !== assertedY) return assertedY - assertedX;

    const idX = x.sourceJobId ? 1 : 0;
    const idY = y.sourceJobId ? 1 : 0;
    if (idX !== idY) return idY - idX;

    const lenDiff = (y.description?.length ?? 0) - (x.description?.length ?? 0);
    if (lenDiff !== 0) return lenDiff;

    const companyDiff = (y.companyName ? 1 : 0) - (x.companyName ? 1 : 0);
    if (companyDiff !== 0) return companyDiff;

    // Stable final tiebreak so the same input always yields the same winner.
    return x.applyUrl.localeCompare(y.applyUrl);
  })[0];
}
