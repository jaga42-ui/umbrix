/**
 * Founder metrics report — reads the analytics_events collection and prints the
 * north-star numbers: DAU, D1/D7 retention cohorts, and the activation funnel.
 *
 * Usage:  node scripts/metrics.js            (last 30 days)
 *         node scripts/metrics.js --days=60
 *
 * Read-only. Day boundaries are UTC (good enough for trend-watching; revisit
 * with IST if cohort edges start mattering).
 */
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const DAYS = Number((process.argv.find((a) => a.startsWith('--days=')) || '').split('=')[1]) || 30;
const MS_DAY = 86400000;

/** "YYYY-MM-DD" (UTC) → integer day index, for cheap day arithmetic. */
function dayIndex(dayStr) {
  return Math.floor(Date.UTC(+dayStr.slice(0, 4), +dayStr.slice(5, 7) - 1, +dayStr.slice(8, 10)) / MS_DAY);
}
function pct(n, d) {
  return d > 0 ? `${((100 * n) / d).toFixed(1)}%` : '—';
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const events = mongoose.connection.db.collection('analytics_events');

  const since = new Date(Date.now() - DAYS * MS_DAY);
  const total = await events.countDocuments({});
  const inWindow = await events.countDocuments({ createdAt: { $gte: since } });
  console.log(`\n=== UMBRIX metrics — last ${DAYS} days (of ${total} events all-time) ===\n`);
  if (inWindow === 0) {
    console.log('No events in window yet. Instrumentation is live; check back once traffic flows.\n');
    await mongoose.disconnect();
    return;
  }

  // Distinct (anonId, day) pairs — the basis for DAU + retention.
  const pairs = await events
    .aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $project: { anonId: 1, day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } } },
      { $group: { _id: { anonId: '$anonId', day: '$day' } } },
    ])
    .toArray();

  // Per-anon set of active day-indices, and per-day unique-visitor counts.
  const daysByAnon = new Map();
  const anonsByDay = new Map();
  for (const p of pairs) {
    const di = dayIndex(p._id.day);
    if (!daysByAnon.has(p._id.anonId)) daysByAnon.set(p._id.anonId, new Set());
    daysByAnon.get(p._id.anonId).add(di);
    anonsByDay.set(p._id.day, (anonsByDay.get(p._id.day) || 0) + 1);
  }

  // --- DAU (last 14 days) ---
  console.log('DAU (unique visitors/day):');
  const today = Math.floor(Date.now() / MS_DAY);
  for (let d = today - 13; d <= today; d++) {
    const dayStr = new Date(d * MS_DAY).toISOString().slice(0, 10);
    const count = anonsByDay.get(dayStr) || 0;
    console.log(`  ${dayStr}  ${'█'.repeat(Math.min(count, 40))} ${count}`);
  }

  // --- Retention by first-seen cohort ---
  const cohort = new Map(); // firstDay -> anonIds[]
  for (const [anon, dset] of daysByAnon) {
    const first = Math.min(...dset);
    if (!cohort.has(first)) cohort.set(first, []);
    cohort.get(first).push(anon);
  }
  let d1n = 0, d1d = 0, d7n = 0, d7d = 0;
  for (const [first, anons] of cohort) {
    const age = today - first;
    for (const a of anons) {
      const dset = daysByAnon.get(a);
      if (age >= 1) { d1d++; if (dset.has(first + 1)) d1n++; }
      if (age >= 7) {
        d7d++;
        for (let k = 1; k <= 7; k++) if (dset.has(first + k)) { d7n++; break; }
      }
    }
  }
  console.log('\nRetention (by first-seen cohort, only cohorts old enough to measure):');
  console.log(`  D1 (returned next day)      : ${pct(d1n, d1d)}  (${d1n}/${d1d})`);
  console.log(`  D7 (returned within 7 days) : ${pct(d7n, d7d)}  (${d7n}/${d7d})  ← north star`);

  // --- Activation funnel (distinct visitors reaching each step) ---
  const byEvent = await events
    .aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$event', anons: { $addToSet: '$anonId' }, count: { $sum: 1 } } },
    ])
    .toArray();
  const stat = {};
  for (const e of byEvent) stat[e._id] = { visitors: e.anons.length, count: e.count };
  const visitors = daysByAnon.size;
  const g = (k) => stat[k] || { visitors: 0, count: 0 };

  console.log('\nActivation funnel (unique visitors):');
  console.log(`  Visitors (any event)  : ${visitors}`);
  console.log(`  Viewed feed           : ${g('feed_view').visitors}  (${pct(g('feed_view').visitors, visitors)} of visitors)`);
  console.log(`  Uploaded resume       : ${g('resume_upload').visitors}  (${pct(g('resume_upload').visitors, visitors)} activated)`);
  console.log(`  Clicked apply         : ${g('apply_click').visitors}  (${pct(g('apply_click').visitors, g('feed_view').visitors)} of feed-viewers)`);
  console.log(`  Saved a job           : ${g('save_job').visitors}`);
  console.log(`\n  apply_click events    : ${g('apply_click').count}  (${(g('apply_click').count / Math.max(1, g('feed_view').count)).toFixed(2)} per feed view)`);
  console.log('');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('metrics failed:', e.message);
  process.exit(1);
});
