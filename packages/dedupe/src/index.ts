/**
 * Batch deduplication across every source in a run.
 *
 * Two passes, cheap first:
 *   1. Exact grouping by `identityKey` — O(n), collapses the common case.
 *   2. Fuzzy comparison of the survivors, but only within a blocking key, so
 *      this never becomes the O(n²) comparison of every job against every other
 *      job. At 200,000 listings that difference is the whole ballgame.
 */

import type { NormalizedJob } from '@umbrix/core';
import { extractCity } from '@umbrix/normalizer';
import { identityKey, companyKey, titleTokens } from './identity';
import { scoreDuplicate, selectBest, DUPLICATE_THRESHOLD } from './similarity';

export * from './identity';
export * from './similarity';

export interface DedupeStats {
  input: number;
  output: number;
  exactDuplicates: number;
  fuzzyDuplicates: number;
}

export interface DedupeResult<T extends NormalizedJob> {
  jobs: (T & { identityKey: string })[];
  stats: DedupeStats;
}

/**
 * Blocking key — the cheap partition that decides which postings are even
 * worth comparing. Same company and same city is the only pairing that can
 * plausibly be a duplicate, so comparisons stay within small buckets.
 */
function blockingKey(job: NormalizedJob): string {
  const company = companyKey(job.companyName) || job.groupSlug;
  const city = extractCity(job.location) ?? '';
  // First significant title token keeps buckets small for large employers,
  // where one company in one city can still have hundreds of open roles.
  const lead = titleTokens(job.title)[0] ?? '';
  return `${company}|${city}|${lead}`;
}

export function dedupe<T extends NormalizedJob>(jobs: T[]): DedupeResult<T> {
  const stats: DedupeStats = { input: jobs.length, output: 0, exactDuplicates: 0, fuzzyDuplicates: 0 };

  // --- Pass 1: exact identity ----------------------------------------------
  const byIdentity = new Map<string, T[]>();
  for (const job of jobs) {
    const key = identityKey(job);
    const bucket = byIdentity.get(key);
    if (bucket) bucket.push(job);
    else byIdentity.set(key, [job]);
  }

  const survivors: { job: T; key: string }[] = [];
  for (const [key, group] of byIdentity) {
    stats.exactDuplicates += group.length - 1;
    survivors.push({ job: selectBest(group), key });
  }

  // --- Pass 2: fuzzy, within blocking buckets ------------------------------
  const blocks = new Map<string, { job: T; key: string }[]>();
  for (const entry of survivors) {
    const bk = blockingKey(entry.job);
    const bucket = blocks.get(bk);
    if (bucket) bucket.push(entry);
    else blocks.set(bk, [entry]);
  }

  const out: (T & { identityKey: string })[] = [];
  for (const bucket of blocks.values()) {
    // Groups of near-duplicates within this bucket. Kept as arrays rather than
    // merged pairwise so `selectBest` sees every candidate at once.
    const groups: { members: { job: T; key: string }[] }[] = [];
    for (const entry of bucket) {
      const match = groups.find(
        (g) => scoreDuplicate(g.members[0].job, entry.job).confidence >= DUPLICATE_THRESHOLD
      );
      if (match) {
        match.members.push(entry);
        stats.fuzzyDuplicates++;
      } else {
        groups.push({ members: [entry] });
      }
    }
    for (const group of groups) {
      const winner = selectBest(group.members.map((m) => m.job));
      // Keep the winner's own identity key so the persisted value matches the
      // document that is actually stored.
      const key = group.members.find((m) => m.job === winner)?.key ?? identityKey(winner);
      out.push(Object.assign({}, winner, { identityKey: key }));
    }
  }

  stats.output = out.length;
  return { jobs: out, stats };
}
