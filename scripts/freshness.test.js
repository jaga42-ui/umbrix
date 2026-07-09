// Integration test for feed-freshness reconciliation.
//
// This one touches a real MongoDB, so it is OPT-IN: it only runs when
// RUN_DB_TESTS=1 and MONGODB_URI are both set. A normal `npm test` skips it, so
// the fast, offline scam-filter suite stays the default. It confines itself to a
// synthetic company slug and cleans up after itself, so it never touches real
// ingested job data.
//
//   RUN_DB_TESTS=1 node --test scripts/freshness.test.js

const test = require('node:test');
const assert = require('node:assert');
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const { Job, reconcileStaleJobs } = require('./ingest-jobs');

const ENABLED = Boolean(process.env.MONGODB_URI) && process.env.RUN_DB_TESTS === '1';
const SLUG = '__freshness_test__';

function seedDoc(letter, now) {
  return {
    companySlug: SLUG,
    title: `Role ${letter}`,
    location: 'Remote',
    descriptionHtml: '<p>x</p>',
    applyUrl: `https://example.test/${letter}`,
    status: 'Active',
    lastSeenAt: now,
  };
}

test(
  'reconcileStaleJobs closes only the active jobs a run no longer sees',
  { skip: ENABLED ? false : 'set RUN_DB_TESTS=1 and MONGODB_URI to run' },
  async (t) => {
    await mongoose.connect(process.env.MONGODB_URI);
    t.after(async () => {
      await Job.deleteMany({ companySlug: SLUG });
      await mongoose.disconnect();
    });

    const now = new Date();
    await Job.deleteMany({ companySlug: SLUG });
    await Job.insertMany([seedDoc('a', now), seedDoc('b', now), seedDoc('c', now)]);

    // This run saw a and b; c has fallen off the board.
    const closed = await reconcileStaleJobs(Job, SLUG, [
      'https://example.test/a',
      'https://example.test/b',
    ], now);
    assert.equal(closed, 1, 'exactly one stale job closed');

    const c = await Job.findOne({ applyUrl: 'https://example.test/c' });
    assert.equal(c.status, 'Closed');
    assert.ok(c.closedAt instanceof Date, 'closedAt stamped');

    const a = await Job.findOne({ applyUrl: 'https://example.test/a' });
    assert.equal(a.status, 'Active', 'a still active');

    // A second call with the same seen set is a no-op (already closed).
    const closedAgain = await reconcileStaleJobs(Job, SLUG, [
      'https://example.test/a',
      'https://example.test/b',
    ], now);
    assert.equal(closedAgain, 0, 'idempotent — nothing to re-close');

    // An empty seen set (board now has zero open roles) closes everything left.
    const closedAll = await reconcileStaleJobs(Job, SLUG, [], now);
    assert.equal(closedAll, 2, 'remaining active jobs (a, b) closed');
  }
);
