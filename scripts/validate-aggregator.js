#!/usr/bin/env node
//
// Aggregator pre-flight gate — run this BEFORE enabling a new source in CI.
//
// Why this exists: Jooble looked like free inventory and was wired end-to-end,
// but a live sample showed 68% senior-titled roles, 34% duplicate listings, 90%
// un-decoded HTML entities, and — the real damage — 22 of 23 survivors landing
// with minExperience unstated. Unstated PASSES the `$not: { $gte: 2 }` fresher
// filter on the /jobs/<field> SEO pages, so those mid-level roles would have
// been published as "fresher jobs". Volume is not the metric; honest volume is.
//
// This script hits the live API, runs the adapter's real normalization, and
// reports the numbers that decide go/no-go. It never touches MongoDB.
//
// Usage:
//   node scripts/validate-aggregator.js --source=careerjet
//   node scripts/validate-aggregator.js --source=jooble --pages=3 --shards=6

require('dotenv').config({ path: '.env.local' });

const companies = require('./companies.json');
const { extractEligibility, ATS_FETCHERS, isFresherTitle } = require('./ingest-jobs');

const SENIOR_TITLE_RE =
  /\b(senior|sr\.?|staff|lead|principal|manager|director|head|vp|chief|architect)\b/i;
const ENTITY_RE = /&(?:nbsp|amp|lt|gt|quot|apos|#\d+);/;

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retries transient network blips so a flaky sample doesn't read as a bad source. */
async function fetchShard(fetcher, shard, pages, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      return await fetcher(shard.slug, { ...shard, pages });
    } catch (error) {
      if (i === tries) {
        console.log(`   !! ${shard.slug} failed: ${error.message}`);
        return [];
      }
      await sleep(1500);
    }
  }
  return [];
}

async function main() {
  const source = arg('source');
  const pages = Number(arg('pages', 2));
  const shardLimit = Number(arg('shards', 4));

  if (!source) {
    console.error('Usage: node scripts/validate-aggregator.js --source=<ats> [--pages=N] [--shards=N]');
    process.exitCode = 1;
    return;
  }
  const fetcher = ATS_FETCHERS[source];
  if (!fetcher) {
    console.error(`Unknown source "${source}". Known: ${Object.keys(ATS_FETCHERS).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const shards = companies.filter((c) => c.ats === source).slice(0, shardLimit);
  if (shards.length === 0) {
    console.error(`No companies.json entries with "ats": "${source}".`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nValidating "${source}" — ${shards.length} shards x ${pages} pages\n`);

  const all = [];
  let requests = 0;
  for (const shard of shards) {
    const jobs = await fetchShard(fetcher, shard, pages);
    all.push(...jobs);
    requests += pages;
    console.log(`  ${shard.slug.padEnd(34)} ${String(jobs.length).padStart(4)} kept`);
    await sleep(600);
  }

  if (all.length === 0) {
    console.log('\n[HEALTH ALERT] every shard returned 0 jobs — the source or the key is broken.');
    console.log('A source returning nothing means the adapter is broken, not that no jobs exist.\n');
    process.exitCode = 1;
    return;
  }

  // Quality signals, measured on what the adapter would actually hand the pipeline.
  const entities = all.filter((j) => ENTITY_RE.test(`${j.title} ${j.content}`)).length;
  const senior = all.filter((j) => SENIOR_TITLE_RE.test(j.title)).length;
  const identities = new Set(all.map((j) => `${j.title}|${j.companyName || ''}`.toLowerCase()));
  const dupes = all.length - identities.size;

  // The decisive one: what eligibility does the pipeline end up storing?
  let fresher = 0;
  let unstated = 0;
  let midLevel = 0;
  for (const job of all) {
    const elig = { ...extractEligibility(job.title, job.content), ...(job.eligibility || {}) };
    if (elig.minExperience === undefined) unstated++;
    else if (elig.minExperience <= 1) fresher++;
    else midLevel++;
  }
  // Unstated and 0-1 both survive the SEO page filter; only unstated is a guess.
  const onSeoPages = unstated + fresher;
  const pct = (n) => `${Math.round((n / all.length) * 100)}%`;

  console.log(`\n=== ${source}: ${all.length} jobs, ${identities.size} unique ===`);
  console.log(`  HTML entities left in text : ${entities} (${pct(entities)})  -> want 0%`);
  console.log(`  duplicate title+company    : ${dupes} (${pct(dupes)})  -> want 0%`);
  console.log(`  senior-titled              : ${senior} (${pct(senior)})  -> want 0%`);
  console.log(`  positive fresher title     : ${all.filter((j) => isFresherTitle(j.title)).length}`);
  console.log('');
  console.log(`  minExperience 0-1 (stated) : ${fresher} (${pct(fresher)})`);
  console.log(`  minExperience UNSTATED     : ${unstated} (${pct(unstated)})  <- guessed, not known`);
  console.log(`  minExperience >=2          : ${midLevel} (${pct(midLevel)})  (excluded from SEO pages)`);
  console.log('');
  console.log(`  would publish as "fresher" on /jobs/<field>: ${onSeoPages} of ${all.length}`);

  // Go/no-go. The unstated share is the pollution risk: those are postings the
  // pipeline could not verify but will still present as fresher-eligible.
  const unstatedShare = unstated / all.length;
  const verdict = [];
  if (entities > 0) verdict.push('un-decoded HTML entities reach the job card');
  if (dupes > 0) verdict.push('duplicate listings survive the applyUrl dedup key');
  if (senior > 0) verdict.push('senior roles are getting through');
  if (unstatedShare > 0.5) {
    verdict.push(
      `${pct(unstated)} of postings would be published as fresher without evidence`
    );
  }

  // Quality and yield are separate questions. A source can be perfectly clean
  // and still not be worth a cron slot — Jooble passes every check above and
  // still returns a handful of jobs per dozen requests, because its keyword API
  // has no fresher filter to narrow on. Report yield so PASS is never read as
  // "worth enabling" on its own.
  const perRequest = (identities.size / Math.max(requests, 1)).toFixed(2);
  console.log('');
  console.log(`  yield: ${identities.size} unique jobs from ~${requests} requests (${perRequest}/request)`);
  if (Number(perRequest) < 1) {
    console.log('  NOTE: under 1 job per request — check this earns its quota before enabling.');
  }

  console.log('');
  if (verdict.length === 0) {
    console.log(`PASS (quality) — "${source}" is clean. Judge volume from the yield line above.`);
  } else {
    console.log(`FAIL — do not enable "${source}" as configured:`);
    verdict.forEach((v) => console.log(`  - ${v}`));
    process.exitCode = 1;
  }
  console.log('');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
