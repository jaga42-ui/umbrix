/**
 * The ingestion pipeline.
 *
 * Source → Fetch → Normalize → Validate → Deduplicate → Scam → Eligibility →
 * Freshness → Store.
 *
 * Every stage after `fetch` is pure, so the whole pipeline can be exercised on
 * recorded fixtures with no network and no database. That is the property that
 * makes a connector independently testable, and the reason the stages are
 * separated at all rather than being one loop as they are today.
 */

import type { Connector, EnrichedJob, FetchContext, NormalizedJob } from '@umbrix/core';
import { dedupe, type DedupeStats } from '@umbrix/dedupe';
import { assessScam, isPublishable } from '@umbrix/scam';
import { scoreFreshness } from '@umbrix/freshness';
import { emptyMetrics, type ConnectorMetrics, type StructuredLogger } from '@umbrix/observability';

export interface StageResult {
  jobs: EnrichedJob[];
  metrics: ConnectorMetrics;
  /** Postings rejected by validate(), kept for the health report. */
  rejected: { title: string; issues: string[] }[];
  /** Postings blocked as scams. Never returned in `jobs`. */
  blocked: { title: string; score: number; reasons: string[] }[];
}

export interface PipelineOptions {
  now?: Date;
  log: StructuredLogger;
  signal?: AbortSignal;
}

/**
 * Run one registry entry (a board slug or aggregator shard) through the
 * pipeline. Never throws for data reasons — a failure is recorded in metrics so
 * one bad slug cannot abort a run of several hundred.
 */
export async function runSlug<TRaw>(
  connector: Connector<TRaw>,
  slug: string,
  config: Record<string, unknown>,
  options: PipelineOptions
): Promise<StageResult> {
  const now = options.now ?? new Date();
  const log = options.log.child({ source: connector.id, slug });
  const metrics = emptyMetrics(connector.id, slug);
  const started = Date.now();

  const result: StageResult = { jobs: [], metrics, rejected: [], blocked: [] };
  const ctx: FetchContext = { slug, config, signal: options.signal, log };

  let raw: TRaw[];
  try {
    raw = await connector.fetch(ctx);
  } catch (error) {
    metrics.durationMs = Date.now() - started;
    metrics.ok = false;
    metrics.error = error instanceof Error ? error.message : String(error);
    log.error('fetch failed', { error: metrics.error });
    return result;
  }

  metrics.fetched = raw.length;

  // --- Normalize + validate ------------------------------------------------
  const normalized: NormalizedJob[] = [];
  for (const item of raw) {
    let job: NormalizedJob;
    try {
      job = connector.normalize(item, ctx);
    } catch (error) {
      // A normalize() that throws is a connector bug, not bad data — but it
      // still must not take down the run.
      metrics.invalid++;
      result.rejected.push({ title: '<unnormalizable>', issues: [String(error)] });
      continue;
    }

    const verdict = connector.validate(job);
    if (!verdict.ok) {
      metrics.invalid++;
      result.rejected.push({ title: job.title, issues: verdict.issues.map((i) => `${i.field}: ${i.message}`) });
      continue;
    }
    normalized.push(job);
  }

  // --- Deduplicate ---------------------------------------------------------
  const { jobs: deduped, stats } = dedupe(normalized);
  metrics.duplicates = stats.exactDuplicates + stats.fuzzyDuplicates;

  // --- Scam + freshness ----------------------------------------------------
  for (const job of deduped) {
    const scam = assessScam(job);
    if (!isPublishable(scam)) {
      metrics.blocked++;
      result.blocked.push({ title: job.title, score: scam.score, reasons: scam.reasons });
      log.warn('blocked as scam', { title: job.title, score: scam.score, reasons: scam.reasons });
      continue;
    }
    if (scam.verdict === 'suspicious') metrics.suspicious++;

    const freshness = scoreFreshness(
      { lastSeenAt: now, postedAt: job.postedAt, sourceUpdatedAt: job.sourceUpdatedAt },
      now
    );

    result.jobs.push({ ...job, scam, freshness });
  }

  metrics.durationMs = Date.now() - started;
  metrics.ok = true;

  // A source returning nothing means the connector is broken, not that the
  // source has no jobs — CLAUDE.md is explicit, so it is logged loudly.
  if (metrics.fetched === 0) {
    log.error('[HEALTH ALERT] connector returned 0 jobs', { slug });
  }

  log.info('slug complete', {
    fetched: metrics.fetched,
    published: result.jobs.length,
    invalid: metrics.invalid,
    duplicates: metrics.duplicates,
    blocked: metrics.blocked,
    ms: metrics.durationMs,
  });

  return result;
}

export type { DedupeStats };
