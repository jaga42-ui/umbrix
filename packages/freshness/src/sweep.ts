/**
 * The time-based expiry sweep.
 *
 * This closes a confirmed gap in the current pipeline. `reconcileStaleJobs`
 * (`scripts/ingest-jobs.js:348`) is the ONLY code that closes a listing, and it
 * runs only after a *successful fetch of that same company* — it closes what
 * the fetch did not return. `lastSeenAt` is written on every upsert and indexed
 * (`Opportunity.ts:90`) but is never read to close anything.
 *
 * So when a source stops running at all — key revoked, adapter broken, IP
 * allowlist lapsed, connector removed — no fetch ever happens, reconciliation
 * never runs, and every one of its listings stays Active indefinitely with no
 * alarm. Freshness silently rots while the dashboard stays green.
 *
 * The sweep is the backstop: it closes on elapsed time regardless of whether
 * any connector ran. Thresholds are deliberately generous (weeks, not days) so
 * a normally-scheduled source is never touched by it. If this sweep is closing
 * listings, something upstream is broken and the report should say so.
 */

import { FRESHNESS_THRESHOLDS } from './score';

/**
 * Storage operations the sweep needs. An interface rather than a Mongoose
 * import so the logic is unit-testable with no database.
 */
export interface FreshnessRepository {
  /** Active listings whose lastSeenAt is older than `cutoff` (or absent). */
  countUnseenSince(cutoff: Date): Promise<number>;
  /** Close them. Returns how many were modified. */
  closeUnseenSince(cutoff: Date, now: Date): Promise<number>;
  /** Per-source last-seen summary, for the health report. */
  sourceLastSeen(): Promise<{ sourceId: string; activeCount: number; lastSeenAt: Date | null }[]>;
}

export interface SweepReport {
  cutoff: Date;
  /** How many would close / did close. */
  candidates: number;
  closed: number;
  dryRun: boolean;
  /** Sources with active listings that have gone quiet — the actual alarm. */
  stalledSources: { sourceId: string; activeCount: number; daysSinceLastSeen: number | null }[];
}

export interface SweepOptions {
  now?: Date;
  /** Days without confirmation before a listing is closed. */
  expiredDays?: number;
  /** A source quiet for this many days is reported as stalled. */
  stalledSourceDays?: number;
  /** When false (the default), nothing is written. */
  write?: boolean;
}

/**
 * Run the sweep.
 *
 * Defaults to a dry run. Closing listings is destructive to the feed, and the
 * caller should have to ask for it explicitly.
 */
export async function sweepStaleListings(
  repo: FreshnessRepository,
  options: SweepOptions = {}
): Promise<SweepReport> {
  const now = options.now ?? new Date();
  const expiredDays = options.expiredDays ?? FRESHNESS_THRESHOLDS.expiredDays;
  const stalledDays = options.stalledSourceDays ?? FRESHNESS_THRESHOLDS.staleDays;
  const write = options.write ?? false;

  const cutoff = new Date(now.getTime() - expiredDays * 86_400_000);

  const candidates = await repo.countUnseenSince(cutoff);
  const closed = write && candidates > 0 ? await repo.closeUnseenSince(cutoff, now) : 0;

  // A source with live listings that has not been confirmed recently is the
  // upstream failure this sweep exists to surface. Reported even on a dry run.
  const summaries = await repo.sourceLastSeen();
  const stalledSources = summaries
    .map((s) => ({
      sourceId: s.sourceId,
      activeCount: s.activeCount,
      daysSinceLastSeen: s.lastSeenAt
        ? Math.floor((now.getTime() - s.lastSeenAt.getTime()) / 86_400_000)
        : null,
    }))
    .filter((s) => s.activeCount > 0 && (s.daysSinceLastSeen === null || s.daysSinceLastSeen >= stalledDays));

  return { cutoff, candidates, closed, dryRun: !write, stalledSources };
}

/** Human-readable summary for logs and the daily report. */
export function formatSweepReport(report: SweepReport): string {
  const lines: string[] = [];
  const verb = report.dryRun ? 'would close' : 'closed';
  lines.push(
    `freshness sweep: ${verb} ${report.dryRun ? report.candidates : report.closed} listings unseen since ${report.cutoff.toISOString().slice(0, 10)}`
  );
  for (const source of report.stalledSources) {
    const age = source.daysSinceLastSeen === null ? 'never confirmed' : `${source.daysSinceLastSeen}d ago`;
    lines.push(
      `[HEALTH ALERT] source "${source.sourceId}" has ${source.activeCount} active listings but was last confirmed ${age} — its connector is probably not running`
    );
  }
  return lines.join('\n');
}
