/**
 * Freshness scoring.
 *
 * Many employers never take a posting down, so "still on the board" is weak
 * evidence that a role is still open. Rather than a binary Active/Closed, every
 * listing carries a graded state, and the feed can demote before it deletes —
 * important because wrongly hiding a live job costs a user an application,
 * which is strictly worse than showing one slightly stale listing.
 */

export const FRESHNESS_STATES = [
  'fresh',
  'recently-updated',
  'possibly-stale',
  'likely-expired',
  'closed',
] as const;
export type FreshnessState = (typeof FRESHNESS_STATES)[number];

export interface FreshnessSignals {
  /** Last time an ingest run confirmed the posting is still on its source. */
  lastSeenAt?: Date;
  /** When the source says it was posted. */
  postedAt?: Date;
  /** When the source last reported a change. */
  sourceUpdatedAt?: Date;
  /** Set when a probe found the apply URL gone (404/410). Conclusive. */
  applyUrlDead?: boolean;
  /** Set when reconciliation saw the posting drop off its source feed. */
  removedFromSource?: boolean;
}

export interface FreshnessResult {
  state: FreshnessState;
  /** 0..1, where 1 is certainly live. Used for ranking, not for hiding. */
  score: number;
  reasons: string[];
}

/** Day thresholds. Named, not inlined — these are policy, not magic numbers. */
export const FRESHNESS_THRESHOLDS = {
  /** Seen within this many days of now: unambiguously fresh. */
  freshDays: 2,
  /** Seen within this window: still trusted, but no longer brand new. */
  recentDays: 7,
  /** Beyond this, the posting is demoted in ranking. */
  staleDays: 21,
  /** Beyond this, treated as expired and kept out of the main feed. */
  expiredDays: 45,
  /** A posting older than this is suspect however often it is re-seen. */
  maxAgeDays: 180,
} as const;

const DAY_MS = 86_400_000;

function daysBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / DAY_MS;
}

/**
 * Grade a listing's freshness.
 *
 * Conclusive negative signals short-circuit: a dead apply URL or removal from
 * the source feed is direct evidence, and no amount of recent re-seeing should
 * outvote it.
 */
export function scoreFreshness(signals: FreshnessSignals, now: Date = new Date()): FreshnessResult {
  const reasons: string[] = [];

  if (signals.applyUrlDead) {
    return { state: 'closed', score: 0, reasons: ['apply URL returned not-found'] };
  }
  if (signals.removedFromSource) {
    return { state: 'closed', score: 0, reasons: ['no longer listed on its source'] };
  }

  const { lastSeenAt, postedAt, sourceUpdatedAt } = signals;

  // Never confirmed by any run — cannot be asserted fresh.
  if (!lastSeenAt) {
    return { state: 'possibly-stale', score: 0.4, reasons: ['never confirmed by an ingest run'] };
  }

  const unseenDays = daysBetween(now, lastSeenAt);
  const t = FRESHNESS_THRESHOLDS;

  let state: FreshnessState;
  let score: number;
  if (unseenDays <= t.freshDays) {
    state = 'fresh';
    score = 1;
    reasons.push('confirmed on its source within the last 48 hours');
  } else if (unseenDays <= t.recentDays) {
    state = 'recently-updated';
    score = 0.85;
    reasons.push(`last confirmed ${Math.round(unseenDays)} days ago`);
  } else if (unseenDays <= t.staleDays) {
    state = 'possibly-stale';
    score = 0.5;
    reasons.push(`not confirmed for ${Math.round(unseenDays)} days`);
  } else if (unseenDays <= t.expiredDays) {
    state = 'likely-expired';
    score = 0.2;
    reasons.push(`not confirmed for ${Math.round(unseenDays)} days`);
  } else {
    state = 'closed';
    score = 0;
    reasons.push(`not confirmed for over ${t.expiredDays} days`);
  }

  // Age is a weaker signal than confirmation, so it can demote one step but
  // never promote — a very old posting that is still on the board is exactly
  // the "company never removes jobs" case this whole module exists for.
  const age = postedAt ? daysBetween(now, postedAt) : undefined;
  if (age !== undefined && age > t.maxAgeDays && state !== 'closed') {
    reasons.push(`posted ${Math.round(age)} days ago`);
    if (state === 'fresh' || state === 'recently-updated') {
      state = 'possibly-stale';
      score = Math.min(score, 0.5);
    } else if (state === 'possibly-stale') {
      state = 'likely-expired';
      score = Math.min(score, 0.2);
    }
  }

  if (sourceUpdatedAt && daysBetween(now, sourceUpdatedAt) <= t.freshDays) {
    reasons.push('source reported an update recently');
    score = Math.min(1, score + 0.1);
  }

  return { state, score, reasons };
}

/** Whether a state should still appear in the main feed. */
export function isFeedEligible(state: FreshnessState): boolean {
  return state === 'fresh' || state === 'recently-updated' || state === 'possibly-stale';
}
