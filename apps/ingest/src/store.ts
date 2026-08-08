/**
 * Persistence.
 *
 * Two behaviours are deliberate:
 *
 * 1. **Dry run is the default.** The current ingest reads `MONGODB_URI` from
 *    `.env.local` and writes the moment it is present, with no opt-in — a local
 *    verification run wrote 697 documents straight to production. Writing to
 *    the live feed should require saying so.
 *
 * 2. **Reconciliation is scoped and guarded.** A slug's stale listings are
 *    closed only after a *successful* fetch for that slug, so a network failure
 *    can never close a whole company's postings. This mirrors the existing
 *    `reconcileStaleJobs` contract exactly — the time-based backstop for
 *    sources that stop running entirely lives in `@umbrix/freshness`.
 */

import mongoose from 'mongoose';
import { toOpportunityDoc, type EnrichedJob } from '@umbrix/core';
import type { FreshnessRepository } from '@umbrix/freshness';
import type { StructuredLogger } from '@umbrix/observability';

export interface StoreOptions {
  write: boolean;
  log: StructuredLogger;
}

export interface UpsertResult {
  added: number;
  updated: number;
}

/** Connect if a URI is configured. Returns false when running without a DB. */
export async function connect(log: StructuredLogger): Promise<boolean> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    log.warn('MONGODB_URI not set — running without persistence');
    return false;
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20_000 });
  return true;
}

export async function disconnect(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

/** The live collection. Model is resolved lazily so importing this is side-effect free. */
function collection() {
  const conn = mongoose.connection;
  if (conn.readyState === 0) throw new Error('not connected');
  return conn.collection('jobs');
}

/**
 * Upsert a slug's postings, keyed on `applyUrl` — the collection's existing
 * identity. `identityKey` is stored alongside so a future migration can move
 * identity onto it without a second pass over 72k documents.
 */
export async function upsertJobs(jobs: EnrichedJob[], now: Date, options: StoreOptions): Promise<UpsertResult> {
  if (jobs.length === 0) return { added: 0, updated: 0 };
  if (!options.write) {
    options.log.info('dry run — skipping upsert', { jobs: jobs.length });
    return { added: 0, updated: 0 };
  }

  const result = await collection().bulkWrite(
    jobs.map((job) => ({
      updateOne: {
        filter: { applyUrl: job.applyUrl },
        // `$unset closedAt` revives a posting that reappears after being closed.
        update: { $set: toOpportunityDoc(job, now), $unset: { closedAt: '' } },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  return { added: result.upsertedCount ?? 0, updated: result.modifiedCount ?? 0 };
}

/**
 * Close a slug's Active postings that this run did not see.
 *
 * Only ever called after a successful fetch. An empty `seenUrls` legitimately
 * closes every posting for that slug — a board with zero open roles — which is
 * the correct outcome, and is why the caller must not invoke this on failure.
 */
export async function reconcileSlug(
  slug: string,
  seenUrls: string[],
  now: Date,
  options: StoreOptions
): Promise<number> {
  if (!options.write) return 0;
  const result = await collection().updateMany(
    { companySlug: slug, status: 'Active', applyUrl: { $nin: seenUrls } },
    { $set: { status: 'Closed', closedAt: now } }
  );
  return result.modifiedCount ?? 0;
}

/**
 * Mongo-backed implementation of the freshness sweep's storage interface.
 * The sweep itself has no database dependency, so it stays unit-testable.
 */
export function freshnessRepository(options: StoreOptions): FreshnessRepository {
  return {
    async countUnseenSince(cutoff) {
      return collection().countDocuments({
        status: 'Active',
        $or: [{ lastSeenAt: { $lt: cutoff } }, { lastSeenAt: { $exists: false } }],
      });
    },

    async closeUnseenSince(cutoff, now) {
      if (!options.write) return 0;
      const result = await collection().updateMany(
        {
          status: 'Active',
          $or: [{ lastSeenAt: { $lt: cutoff } }, { lastSeenAt: { $exists: false } }],
        },
        { $set: { status: 'Closed', closedAt: now, closedReason: 'freshness-sweep' } }
      );
      return result.modifiedCount ?? 0;
    },

    async sourceLastSeen() {
      const rows = await collection()
        .aggregate<{ _id: string | null; activeCount: number; lastSeenAt: Date | null }>([
          { $match: { status: 'Active' } },
          {
            $group: {
              // Documents written before this platform have no sourceId; group
              // them under their companySlug prefix so they still get reported
              // rather than silently vanishing from the health view.
              _id: { $ifNull: ['$sourceId', '$companySlug'] },
              activeCount: { $sum: 1 },
              lastSeenAt: { $max: '$lastSeenAt' },
            },
          },
        ])
        .toArray();

      return rows.map((r) => ({
        sourceId: r._id ?? 'unknown',
        activeCount: r.activeCount,
        lastSeenAt: r.lastSeenAt ?? null,
      }));
    },
  };
}
