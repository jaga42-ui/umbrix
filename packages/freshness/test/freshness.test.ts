import test from 'node:test';
import assert from 'node:assert';
import { scoreFreshness, isFeedEligible, sweepStaleListings, formatSweepReport, type FreshnessRepository } from '../src/index.js';

const NOW = new Date('2026-08-07T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

test('scoreFreshness grades by how recently the listing was confirmed', () => {
  assert.equal(scoreFreshness({ lastSeenAt: daysAgo(0) }, NOW).state, 'fresh');
  assert.equal(scoreFreshness({ lastSeenAt: daysAgo(5) }, NOW).state, 'recently-updated');
  assert.equal(scoreFreshness({ lastSeenAt: daysAgo(14) }, NOW).state, 'possibly-stale');
  assert.equal(scoreFreshness({ lastSeenAt: daysAgo(30) }, NOW).state, 'likely-expired');
  assert.equal(scoreFreshness({ lastSeenAt: daysAgo(90) }, NOW).state, 'closed');
});

test('conclusive negative signals outvote a recent sighting', () => {
  assert.equal(scoreFreshness({ lastSeenAt: NOW, applyUrlDead: true }, NOW).state, 'closed');
  assert.equal(scoreFreshness({ lastSeenAt: NOW, removedFromSource: true }, NOW).state, 'closed');
});

test('a never-confirmed listing cannot be called fresh', () => {
  assert.equal(scoreFreshness({}, NOW).state, 'possibly-stale');
});

test('age demotes but never promotes', () => {
  // The "company never removes its postings" case: seen today, posted 2 years ago.
  const result = scoreFreshness({ lastSeenAt: NOW, postedAt: daysAgo(400) }, NOW);
  assert.equal(result.state, 'possibly-stale');
  assert.ok(result.reasons.some((r) => r.includes('400 days ago')));
});

test('feed eligibility excludes expired and closed', () => {
  assert.equal(isFeedEligible('fresh'), true);
  assert.equal(isFeedEligible('possibly-stale'), true);
  assert.equal(isFeedEligible('likely-expired'), false);
  assert.equal(isFeedEligible('closed'), false);
});

/** In-memory repository so the sweep is testable with no database. */
function repo(over: Partial<FreshnessRepository> = {}): FreshnessRepository {
  return {
    countUnseenSince: async () => 0,
    closeUnseenSince: async () => 0,
    sourceLastSeen: async () => [],
    ...over,
  };
}

test('sweep is a dry run unless writing is requested', async () => {
  let closed = 0;
  const report = await sweepStaleListings(
    repo({ countUnseenSince: async () => 12, closeUnseenSince: async () => (closed = 12) }),
    { now: NOW }
  );
  assert.equal(report.dryRun, true);
  assert.equal(report.candidates, 12);
  assert.equal(report.closed, 0);
  assert.equal(closed, 0, 'nothing may be written on a dry run');
});

test('sweep closes stale listings when writing', async () => {
  const report = await sweepStaleListings(
    repo({ countUnseenSince: async () => 5, closeUnseenSince: async () => 5 }),
    { now: NOW, write: true }
  );
  assert.equal(report.closed, 5);
});

test('sweep flags a source that stopped running — the gap it exists to close', async () => {
  // A source with live listings that no run has confirmed for a month. The old
  // pipeline could never notice this: reconciliation only runs after a
  // successful fetch, so a dead connector reconciles nothing and stays silent.
  const report = await sweepStaleListings(
    repo({
      sourceLastSeen: async () => [
        { sourceId: 'careerjet', activeCount: 697, lastSeenAt: daysAgo(30) },
        { sourceId: 'greenhouse', activeCount: 12_000, lastSeenAt: daysAgo(1) },
      ],
    }),
    { now: NOW }
  );

  assert.equal(report.stalledSources.length, 1);
  assert.equal(report.stalledSources[0].sourceId, 'careerjet');
  assert.equal(report.stalledSources[0].activeCount, 697);
  assert.ok(formatSweepReport(report).includes('[HEALTH ALERT]'));
});

test('a source that never reported is flagged, not skipped', async () => {
  const report = await sweepStaleListings(
    repo({ sourceLastSeen: async () => [{ sourceId: 'ghost', activeCount: 3, lastSeenAt: null }] }),
    { now: NOW }
  );
  assert.equal(report.stalledSources[0].daysSinceLastSeen, null);
});

test('healthy sources are not flagged', async () => {
  const report = await sweepStaleListings(
    repo({ sourceLastSeen: async () => [{ sourceId: 'adzuna', activeCount: 500, lastSeenAt: daysAgo(1) }] }),
    { now: NOW }
  );
  assert.equal(report.stalledSources.length, 0);
});
