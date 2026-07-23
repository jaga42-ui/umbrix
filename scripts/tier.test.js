// Offline tests for the staggered-cron tier logic (parseTierArg, metaIdForTier,
// TIER_BY_ATS). No network or DB. Runs under `npm test`.

const test = require('node:test');
const assert = require('node:assert');
const { parseTierArg, metaIdForTier, TIER_BY_ATS } = require('./ingest-jobs');

test('parseTierArg: no flag and no env var -> null (run every source)', () => {
  assert.equal(parseTierArg([], {}), null);
});

test('parseTierArg: --tier=N wins and parses to a number', () => {
  assert.equal(parseTierArg(['node', 'ingest-jobs.js', '--tier=3'], {}), 3);
});

test('parseTierArg: INGEST_TIER env is honored when no flag is present', () => {
  assert.equal(parseTierArg([], { INGEST_TIER: '1' }), 1);
});

test('parseTierArg: the --tier flag takes precedence over the env var', () => {
  assert.equal(parseTierArg(['--tier=3'], { INGEST_TIER: '1' }), 3);
});

test('parseTierArg: empty value is treated as absent (null)', () => {
  assert.equal(parseTierArg(['--tier='], {}), null);
  assert.equal(parseTierArg([], { INGEST_TIER: '' }), null);
});

test('parseTierArg: a malformed value fails loud instead of ingesting everything', () => {
  assert.throws(() => parseTierArg(['--tier=abc'], {}), /Invalid --tier/);
  assert.throws(() => parseTierArg(['--tier=0'], {}), /Invalid --tier/);
  assert.throws(() => parseTierArg(['--tier=-2'], {}), /Invalid --tier/);
  assert.throws(() => parseTierArg(['--tier=1.5'], {}), /Invalid --tier/);
});

test('metaIdForTier: an un-tiered run keeps the original guard key', () => {
  // Backward compatibility: the existing single nightly workflow must keep
  // stamping 'ingest' so its 20h guard is unchanged.
  assert.equal(metaIdForTier(null), 'ingest');
});

test('metaIdForTier: each tier gets its own guard key so runs do not clobber', () => {
  assert.equal(metaIdForTier(1), 'ingest:tier1');
  assert.equal(metaIdForTier(3), 'ingest:tier3');
  assert.notEqual(metaIdForTier(1), metaIdForTier(3));
});

test('TIER_BY_ATS: aggregator APIs are Tier 1, company ATS boards are Tier 3', () => {
  assert.equal(TIER_BY_ATS.adzuna, 1);
  for (const ats of ['greenhouse', 'lever', 'ashby', 'smartrecruiters']) {
    assert.equal(TIER_BY_ATS[ats], 3, `${ats} should be Tier 3`);
  }
});

test('TIER_BY_ATS: an unmapped source (no adapter yet) yields undefined -> filtered out', () => {
  assert.equal(TIER_BY_ATS.internshala, undefined);
});
