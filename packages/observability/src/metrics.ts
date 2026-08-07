/**
 * Per-connector metrics and run history.
 *
 * The current pipeline prints a summary line and forgets it, so there is no way
 * to answer "is this connector degrading?" — only "did tonight's run crash?".
 * Every counter the charter asks to track (added, updated, expired, duplicates
 * removed, scams blocked) is recorded per connector so a trend is visible.
 *
 * A zero-result connector is treated as a failure signal, not a quiet success.
 * CLAUDE.md is explicit: a source returning nothing means the connector is
 * broken, not that the source has no jobs.
 */

export interface ConnectorMetrics {
  sourceId: string;
  slug: string;
  /** Raw postings returned by fetch(). */
  fetched: number;
  /** Rejected by validate(). */
  invalid: number;
  /** Removed as duplicates. */
  duplicates: number;
  /** Blocked by scam detection. */
  blocked: number;
  /** Flagged suspicious but still published. */
  suspicious: number;
  /** Written as new documents. */
  added: number;
  /** Matched an existing document. */
  updated: number;
  /** Closed by reconciliation for this slug. */
  expired: number;
  /** Wall-clock duration of the whole slug, milliseconds. */
  durationMs: number;
  ok: boolean;
  error?: string;
}

export function emptyMetrics(sourceId: string, slug: string): ConnectorMetrics {
  return {
    sourceId, slug,
    fetched: 0, invalid: 0, duplicates: 0, blocked: 0, suspicious: 0,
    added: 0, updated: 0, expired: 0, durationMs: 0, ok: false,
  };
}

export interface RunSummary {
  runId: string;
  startedAt: Date;
  finishedAt: Date;
  tier: number | null;
  dryRun: boolean;
  connectors: ConnectorMetrics[];
  totals: Omit<ConnectorMetrics, 'sourceId' | 'slug' | 'ok' | 'error'>;
  /** Slugs that returned zero jobs — the health signal, not an empty success. */
  zeroResultSlugs: string[];
  failedSlugs: string[];
}

export function summarize(
  runId: string,
  startedAt: Date,
  finishedAt: Date,
  tier: number | null,
  dryRun: boolean,
  connectors: ConnectorMetrics[]
): RunSummary {
  const totals = connectors.reduce(
    (acc, m) => ({
      fetched: acc.fetched + m.fetched,
      invalid: acc.invalid + m.invalid,
      duplicates: acc.duplicates + m.duplicates,
      blocked: acc.blocked + m.blocked,
      suspicious: acc.suspicious + m.suspicious,
      added: acc.added + m.added,
      updated: acc.updated + m.updated,
      expired: acc.expired + m.expired,
      durationMs: acc.durationMs + m.durationMs,
    }),
    { fetched: 0, invalid: 0, duplicates: 0, blocked: 0, suspicious: 0, added: 0, updated: 0, expired: 0, durationMs: 0 }
  );

  return {
    runId, startedAt, finishedAt, tier, dryRun, connectors, totals,
    zeroResultSlugs: connectors.filter((m) => m.ok && m.fetched === 0).map((m) => m.slug),
    failedSlugs: connectors.filter((m) => !m.ok).map((m) => m.slug),
  };
}

/** Human-readable run report. */
export function formatSummary(summary: RunSummary): string {
  const t = summary.totals;
  const lines = [
    '',
    `=== Run ${summary.runId}${summary.dryRun ? ' (dry run — nothing written)' : ''} ===`,
    `  fetched ${t.fetched} · invalid ${t.invalid} · duplicates ${t.duplicates} · blocked ${t.blocked} · suspicious ${t.suspicious}`,
    `  added ${t.added} · updated ${t.updated} · expired ${t.expired}`,
    `  ${summary.connectors.length} slugs in ${Math.round((summary.finishedAt.getTime() - summary.startedAt.getTime()) / 1000)}s`,
  ];
  for (const slug of summary.zeroResultSlugs) {
    lines.push(`[HEALTH ALERT] ${slug} returned 0 jobs — treat as a broken connector, not an empty source`);
  }
  for (const slug of summary.failedSlugs) {
    const m = summary.connectors.find((c) => c.slug === slug);
    lines.push(`[FAILED] ${slug}: ${m?.error ?? 'unknown error'}`);
  }
  return lines.join('\n');
}
