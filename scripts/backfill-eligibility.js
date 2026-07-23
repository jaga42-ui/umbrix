/**
 * One-time (idempotent) backfill: re-derive eligibility (minExperience,
 * batchYears, cgpaCutoff) for existing jobs using the current extractor, from
 * the title + descriptionHtml already stored on each doc. Lets an improved
 * parser reach the whole collection without waiting for a full re-ingest.
 *
 * Additive/precise: only writes a field when the extractor produces a value that
 * differs from what's stored — it never clears an existing value. Future ingests
 * use the same extractor, so this just brings the back-catalogue up to date.
 *
 * Usage:  node scripts/backfill-eligibility.js --dry-run   (measure, no writes)
 *         node scripts/backfill-eligibility.js             (apply)
 */
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const { extractEligibility } = require('./ingest-jobs');

const DRY = process.argv.includes('--dry-run');
const BATCH = 1000;

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const coll = mongoose.connection.db.collection('jobs');

  const cursor = coll.find(
    {},
    { projection: { title: 1, descriptionHtml: 1, minExperience: 1, batchYears: 1, cgpaCutoff: 1 } }
  );

  let scanned = 0, changed = 0, filledMinExp = 0, unknownBefore = 0, unknownAfter = 0;
  let ops = [];
  const flush = async () => {
    if (!DRY && ops.length) await coll.bulkWrite(ops, { ordered: false });
    ops = [];
  };

  for await (const j of cursor) {
    scanned++;
    const wasUnknown = j.minExperience == null;
    if (wasUnknown) unknownBefore++;

    const e = extractEligibility(j.title || '', j.descriptionHtml || '');
    const set = {};
    if (e.minExperience !== undefined && e.minExperience !== j.minExperience) set.minExperience = e.minExperience;
    if (Array.isArray(e.batchYears) && e.batchYears.length &&
        JSON.stringify(e.batchYears) !== JSON.stringify(j.batchYears || [])) set.batchYears = e.batchYears;
    if (e.cgpaCutoff !== undefined && e.cgpaCutoff !== j.cgpaCutoff) set.cgpaCutoff = e.cgpaCutoff;

    // After this backfill, is minExperience known?
    const knownAfter = e.minExperience !== undefined || !wasUnknown;
    if (!knownAfter) unknownAfter++;

    if (Object.keys(set).length > 0) {
      changed++;
      if (wasUnknown && set.minExperience !== undefined) filledMinExp++;
      ops.push({ updateOne: { filter: { _id: j._id }, update: { $set: set } } });
      if (ops.length >= BATCH) await flush();
    }
  }
  await flush();

  const pctBefore = ((100 * unknownBefore) / Math.max(1, scanned)).toFixed(0);
  const pctAfter = ((100 * unknownAfter) / Math.max(1, scanned)).toFixed(0);
  console.log(`\n=== Eligibility backfill ${DRY ? '(DRY RUN — no writes)' : '(APPLIED)'} ===`);
  console.log(`scanned            : ${scanned} jobs`);
  console.log(`minExp unknown     : ${unknownBefore} (${pctBefore}%)  ->  ${unknownAfter} (${pctAfter}%)`);
  console.log(`newly filled minExp: ${filledMinExp}`);
  console.log(`docs changed       : ${changed}${DRY ? '  (would change)' : ''}\n`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('backfill failed:', e.message);
  process.exit(1);
});
