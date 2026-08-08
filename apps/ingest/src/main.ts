#!/usr/bin/env node
/**
 * Ingestion runner.
 *
 * Usage:
 *   tsx apps/ingest/src/main.ts --source=greenhouse --limit=5
 *   tsx apps/ingest/src/main.ts --tier=3 --write
 *   tsx apps/ingest/src/main.ts --health
 *   tsx apps/ingest/src/main.ts --sweep [--write]
 *
 * Dry run is the default; `--write` is required to touch the database.
 */

import { CONNECTORS, getConnector } from '@umbrix/connectors';
import { sweepStaleListings, formatSweepReport } from '@umbrix/freshness';
import { createLogger, summarize, formatSummary, type ConnectorMetrics } from '@umbrix/observability';
import { runSlug } from './pipeline.js';
import { interleaveBySource, runWithRetryPass } from './pool.js';
import { loadRegistry, filterRegistry } from './registry.js';
import { connect, disconnect, upsertJobs, reconcileSlug, freshnessRepository, type StoreOptions } from './store.js';

/** Moderate on purpose — a courteous client of free public APIs. */
const DEFAULT_CONCURRENCY = 8;

interface Args {
  source?: string;
  tier?: number;
  slug?: string;
  limit?: number;
  concurrency: number;
  write: boolean;
  health: boolean;
  sweep: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const num = (name: string): number | undefined => {
    const raw = get(name);
    if (raw === undefined) return undefined;
    const n = Number(raw);
    // Fail loudly: a typo in a cron definition must not silently run everything.
    if (!Number.isInteger(n) || n < 0) throw new Error(`--${name} must be a non-negative integer, got "${raw}"`);
    return n;
  };

  return {
    source: get('source'),
    tier: num('tier'),
    slug: get('slug'),
    limit: num('limit'),
    concurrency: num('concurrency') ?? DEFAULT_CONCURRENCY,
    write: argv.includes('--write'),
    health: argv.includes('--health'),
    sweep: argv.includes('--sweep'),
  };
}

async function runHealthChecks(log: ReturnType<typeof createLogger>): Promise<number> {
  let unhealthy = 0;
  for (const connector of Object.values(CONNECTORS)) {
    const report = await connector.healthCheck();
    if (report.healthy) {
      log.info('connector healthy', { source: connector.id, latencyMs: report.latencyMs });
    } else {
      unhealthy++;
      log.error('connector unhealthy', { source: connector.id, detail: report.detail });
    }
  }
  return unhealthy;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const log = createLogger();
  const now = new Date();
  const runId = `${now.toISOString().replace(/[:.]/g, '-')}`;

  if (args.health) {
    const unhealthy = await runHealthChecks(log);
    process.exitCode = unhealthy > 0 ? 1 : 0;
    return;
  }

  const connected = await connect(log);
  const store: StoreOptions = { write: args.write && connected, log };

  if (args.write && !connected) {
    log.error('--write given but no MONGODB_URI is configured — refusing to pretend');
    process.exitCode = 1;
    return;
  }

  try {
    if (args.sweep) {
      if (!connected) throw new Error('--sweep needs a database connection');
      const report = await sweepStaleListings(freshnessRepository(store), { now, write: store.write });
      log.info('sweep complete', { candidates: report.candidates, closed: report.closed });
      process.stdout.write(formatSweepReport(report) + '\n');
      return;
    }

    const tierOf = (source: string) => getConnector(source)?.tier;
    const entries = interleaveBySource(
      filterRegistry(loadRegistry(), { source: args.source, tier: args.tier, slug: args.slug, limit: args.limit }, tierOf)
    );

    if (entries.length === 0) {
      log.error('no registry entries matched — check --source/--tier/--slug');
      process.exitCode = 1;
      return;
    }

    log.info('run starting', {
      runId, entries: entries.length, write: store.write, concurrency: args.concurrency,
    });

    const metrics: ConnectorMetrics[] = [];
    const { retried, recovered } = await runWithRetryPass(
      entries,
      async (entry) => {
        const connector = getConnector(entry.source);
        if (!connector) return { ok: false } as const;

        const result = await runSlug(connector, entry.slug, entry.config, { now, log });

        if (result.metrics.ok) {
          const { added, updated } = await upsertJobs(result.jobs, now, store);
          result.metrics.added = added;
          result.metrics.updated = updated;
          // Reconcile only after a successful fetch — never on failure, or a
          // network blip would close every posting for this slug.
          result.metrics.expired = await reconcileSlug(
            entry.slug,
            result.jobs.map((j) => j.applyUrl),
            now,
            store
          );
        }

        metrics.push(result.metrics);
        return { ok: result.metrics.ok } as const;
      },
      args.concurrency,
      (r) => !r.ok
    );

    if (retried > 0) log.info('retry pass complete', { retried, recovered });

    const summary = summarize(runId, now, new Date(), args.tier ?? null, !store.write, metrics);
    process.stdout.write(formatSummary(summary) + '\n');
    if (summary.failedSlugs.length > 0) process.exitCode = 1;
  } finally {
    await disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
