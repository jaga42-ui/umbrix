require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { evaluate: evaluateScam } = require('./scamFilter');

// Opportunity schema, mirrored here since the script runs outside the Next.js
// compile context. Collection is pinned to "jobs" (same data as the app model).
const OpportunitySchema = new mongoose.Schema(
  {
    companySlug: { type: String, required: true, index: true },
    title: { type: String, required: true },
    location: { type: String, required: true },
    descriptionHtml: { type: String, required: true },
    tags: { type: [String], default: [] },
    applyUrl: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Closed'], default: 'Active' },
    type: {
      type: String,
      enum: ['job', 'internship', 'hackathon', 'competition'],
      default: 'job',
    },
    batchYears: { type: [Number], default: [] },
    branches: { type: [String], default: [] },
    minExperience: { type: Number },
    cgpaCutoff: { type: Number },
    roleType: { type: String },
    isIndia: { type: Boolean },
    lastSeenAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

const Opportunity =
  mongoose.models.Opportunity ||
  mongoose.model('Opportunity', OpportunitySchema, 'jobs');

/**
 * Classify an opportunity from its title. Coarse but zero-cost — a proper
 * type/eligibility extraction pass lands with the freshers-pivot work.
 */
function classifyType(title) {
  return /\b(intern|internship|trainee|apprentice)\b/i.test(title || '') ? 'internship' : 'job';
}

// India + major Indian metros. Word boundaries keep "India" from matching
// "Indiana"/"Indianapolis". Powers the `isIndia` flag and the feed's India filter.
const INDIA_LOCATION_REGEX =
  /\b(india|bharat|bengaluru|bangalore|mumbai|new delhi|delhi|gurgaon|gurugram|hyderabad|chennai|pune|noida|kolkata|ahmedabad|jaipur|kochi|cochin|chandigarh|indore|coimbatore|thiruvananthapuram|trivandrum|mysore|mysuru|nagpur|visakhapatnam|vadodara|surat|gandhinagar|gift city)\b/i;

/** Whether a location string denotes India (or a major Indian city). */
function isIndiaLocation(location) {
  return INDIA_LOCATION_REGEX.test(String(location || ''));
}

// How many companies to fetch concurrently. Kept moderate to stay a
// courteous, well-behaved client of two free public APIs rather than
// hammering them -- not a hard rate limit either has published.
const FETCH_CONCURRENCY = 8;

const SKILL_KEYWORDS = [
  "React", "TypeScript", "Next.js", "Node.js", "Python", "Rust",
  "Go", "Figma", "UI/UX", "Product Design", "GraphQL", "PostgreSQL",
  "Docker", "Kubernetes", "AWS", "Machine Learning", "AI", "C++",
  "Java", "Ruby", "Swift", "Kotlin", "Frontend", "Backend", "Fullstack"
];

/**
 * Fetches raw postings from a Greenhouse board and normalizes each into a
 * common shape: { title, location, content, applyUrl, department }.
 */
async function fetchGreenhouseJobs(slug) {
  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  if (!response.ok) {
    throw new Error(`Greenhouse ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const jobs = data.jobs || [];
  return jobs.map((job) => ({
    title: job.title,
    location: job.location?.name || 'Remote',
    content: job.content || '',
    applyUrl: job.absolute_url,
    department: job.departments?.[0]?.name && job.departments[0].name !== 'No Department'
      ? job.departments[0].name
      : null,
  }));
}

/**
 * Fetches raw postings from a Lever board and normalizes each into the same
 * common shape as Greenhouse, so the rest of the pipeline (scam filter, tag
 * extraction, upsert) doesn't need to know which ATS a job came from.
 */
async function fetchLeverJobs(slug) {
  const response = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!response.ok) {
    throw new Error(`Lever ${response.status} ${response.statusText}`);
  }
  const jobs = await response.json();
  if (!Array.isArray(jobs)) return [];
  return jobs.map((job) => ({
    title: job.text,
    location: job.categories?.location || 'Remote',
    content: job.description || job.descriptionPlain || '',
    applyUrl: job.hostedUrl,
    department: job.categories?.team || null,
  }));
}

/**
 * Fetches raw postings from an Ashby job board and normalizes each into the
 * same common shape. Ashby's board names are case-sensitive, so the slug in
 * companies.json must match exactly (e.g. "ElevenLabs", not "elevenlabs").
 * Unlisted postings (isListed === false) are internal/hidden and dropped.
 */
async function fetchAshbyJobs(slug) {
  const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  if (!response.ok) {
    throw new Error(`Ashby ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  return jobs
    .filter((job) => job.isListed !== false)
    .map((job) => ({
      title: job.title,
      location: job.location || (job.isRemote ? 'Remote' : 'Remote'),
      content: job.descriptionHtml || job.descriptionPlain || '',
      applyUrl: job.applyUrl || job.jobUrl,
      department: job.department || job.team || null,
    }));
}

const ATS_FETCHERS = {
  greenhouse: fetchGreenhouseJobs,
  lever: fetchLeverJobs,
  ashby: fetchAshbyJobs,
};

function extractTags(job) {
  const tags = [];
  if (job.department) tags.push(job.department);

  const lowerTitle = job.title.toLowerCase();
  const lowerContent = job.content.toLowerCase();
  for (const keyword of SKILL_KEYWORDS) {
    const lowerKeyword = keyword.toLowerCase();
    if (lowerTitle.includes(lowerKeyword) || lowerContent.includes(lowerKeyword)) {
      if (!tags.includes(keyword)) tags.push(keyword);
    }
  }
  return tags;
}

/**
 * Round-robins companies across ATS types instead of processing them in
 * file order. companies.json groups all Lever entries together at the end
 * for readability, but with FETCH_CONCURRENCY workers pulling the next item
 * as soon as they're free, that grouping means every Lever request (the
 * slower, more failure-prone host) tends to land in the pool at the same
 * time near the end of the run. Interleaving spreads same-host requests out
 * across the whole run instead.
 */
function interleaveByAts(companies) {
  const groups = new Map();
  for (const company of companies) {
    if (!groups.has(company.ats)) groups.set(company.ats, []);
    groups.get(company.ats).push(company);
  }
  const queues = [...groups.values()];
  const interleaved = [];
  let remaining = companies.length;
  let i = 0;
  while (remaining > 0) {
    const queue = queues[i % queues.length];
    if (queue.length > 0) {
      interleaved.push(queue.shift());
      remaining--;
    }
    i++;
  }
  return interleaved;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries `fn` a couple of times with a short backoff before giving up.
 * Lever in particular is much higher-latency than Greenhouse (2-10s per
 * request vs sub-second) and occasionally drops a connection when several
 * requests land on it inside the same concurrency window. This also retries
 * on a genuine HTTP error (e.g. 404), which is a wasted round-trip in that
 * case -- acceptable here since every slug in companies.json was verified
 * live before being added, so a real 404 shouldn't occur in practice.
 */
async function withRetry(fn, retries = 2, delayMs = 1500) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(delayMs * (attempt + 1));
    }
  }
}

/** Runs `worker` over `items` with at most `size` in flight at once. */
async function pool(items, worker, size) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return results;
}

/**
 * Runs the worker over all items concurrently, then retries any that failed
 * once more — sequentially, so the retry doesn't recreate the same network/DB
 * pressure (concurrency saturation) that most transient failures come from.
 * A worker result is a "failure" when its `ok` field is falsy.
 *
 * Returns the final results plus how many were retried and how many of those
 * recovered, for reporting.
 */
async function runIngestPass(items, worker, concurrency) {
  const results = await pool(items, worker, concurrency);
  const failedIndexes = [];
  results.forEach((r, i) => {
    if (!r || !r.ok) failedIndexes.push(i);
  });

  let recovered = 0;
  for (const i of failedIndexes) {
    const retry = await worker(items[i], i);
    results[i] = retry;
    if (retry && retry.ok) recovered++;
  }

  return { results, retried: failedIndexes.length, recovered };
}

/**
 * Feed-freshness reconciliation. After a company's board has been fetched
 * successfully, any of its still-Active jobs whose applyUrl was NOT seen in
 * this run has fallen off the ATS — mark it Closed so it drops out of the feed.
 *
 * This is scoped per-company and only ever called after a *successful* fetch,
 * so a network failure can never wrongly close a whole company's postings. An
 * empty `seenUrls` (a board that legitimately has zero open roles now) closes
 * all of that company's active jobs, which is the correct outcome.
 *
 * Returns the number of jobs closed.
 */
async function reconcileStaleJobs(JobModel, slug, seenUrls, now = new Date()) {
  const result = await JobModel.updateMany(
    { companySlug: slug, status: 'Active', applyUrl: { $nin: seenUrls } },
    { $set: { status: 'Closed', closedAt: now } }
  );
  return result.modifiedCount || 0;
}

async function processCompany({ slug, ats }) {
  const fetchJobs = ATS_FETCHERS[ats];
  if (!fetchJobs) {
    return { slug, ok: false, phase: 'config', message: `Unknown ATS "${ats}"` };
  }

  // Track which phase failed so the summary can separate flaky ATS endpoints
  // from database problems — they need different fixes.
  let phase = 'fetch';
  try {
    const rawJobs = await withRetry(() => fetchJobs(slug));
    const now = new Date();
    const jobDocs = [];
    const blocked = [];

    for (const job of rawJobs) {
      const verdict = evaluateScam({ title: job.title, content: job.content, applyUrl: job.applyUrl });
      if (verdict.isScam) {
        blocked.push(`"${job.title}" (score ${verdict.score}): ${verdict.reasons.join('; ')}`);
        continue;
      }
      jobDocs.push({
        companySlug: slug,
        title: job.title,
        location: job.location,
        descriptionHtml: job.content,
        tags: extractTags(job),
        applyUrl: job.applyUrl,
        status: 'Active',
        type: classifyType(job.title),
        isIndia: isIndiaLocation(job.location),
        lastSeenAt: now,
      });
    }

    let closed = 0;
    if (process.env.MONGODB_URI) {
      phase = 'db';
      // Both operations are idempotent (upsert by applyUrl; reconcile is a
      // filtered updateMany), so retrying a transient connection blip — the
      // ECONNRESET / timeout / DNS errors seen late in large runs — is safe.
      closed = await withRetry(async () => {
        if (jobDocs.length > 0) {
          // One round-trip per company instead of one per job. Reviving a job
          // that reappears after being closed is automatic: status flips back
          // to Active via $set and closedAt is cleared.
          await Opportunity.bulkWrite(
            jobDocs.map((jobDoc) => ({
              updateOne: {
                filter: { applyUrl: jobDoc.applyUrl },
                update: { $set: jobDoc, $unset: { closedAt: '' } },
                upsert: true,
              },
            }))
          );
        }
        // Close anything for this company we no longer see on the board.
        const seenUrls = jobDocs.map((d) => d.applyUrl);
        return reconcileStaleJobs(Opportunity, slug, seenUrls, now);
      });
    }

    return { slug, ats, ok: true, found: rawJobs.length, processed: jobDocs.length, blocked, closed };
  } catch (error) {
    return { slug, ats, ok: false, phase, message: error.message };
  }
}

async function ingestJobs() {
  if (!process.env.MONGODB_URI) {
    if (process.env.GITHUB_ACTIONS === "true") {
      // In CI, a missing secret is a misconfiguration, not an intentional
      // dry-run — fail loud instead of silently no-oping with a green check.
      throw new Error(
        "MONGODB_URI is not set. Add it as a repository secret (Settings > Secrets and variables > Actions) — refusing to run a silent dry-run in CI."
      );
    }
    console.warn("⚠️ MONGODB_URI is not defined. Running in dry-run mode.");
  } else {
    // Bound the pool and give server selection / sockets generous timeouts so a
    // brief network blip mid-run doesn't kill in-flight writes. retryWrites is
    // on by default for Atlas URIs; set it explicitly for safety.
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 60000,
      retryWrites: true,
    });
    console.log("✅ Connected to MongoDB");
  }

  const companiesPath = path.join(__dirname, 'companies.json');
  const companies = interleaveByAts(JSON.parse(fs.readFileSync(companiesPath, 'utf8')));

  console.log(`\nFetching ${companies.length} companies (${FETCH_CONCURRENCY} at a time)...\n`);

  const { results, retried, recovered } = await runIngestPass(
    companies,
    processCompany,
    FETCH_CONCURRENCY
  );
  if (retried > 0) {
    console.log(`\n↻ Retried ${retried} failed companies; ${recovered} recovered.\n`);
  }

  let totalProcessed = 0;
  let totalBlocked = 0;
  let totalClosed = 0;
  let totalFailed = 0;
  const failedByPhase = { fetch: 0, db: 0, config: 0 };

  for (const r of results) {
    if (!r.ok) {
      totalFailed++;
      failedByPhase[r.phase] = (failedByPhase[r.phase] || 0) + 1;
      console.error(`❌ ${r.slug} (${r.ats || '?'}) [${r.phase}]: ${r.message}`);
      continue;
    }
    totalProcessed += r.processed;
    totalBlocked += r.blocked.length;
    totalClosed += r.closed || 0;
    const closedNote = r.closed ? `, ${r.closed} closed (stale)` : '';
    console.log(`✅ ${r.slug} (${r.ats}): ${r.found} found, ${r.processed} processed, ${r.blocked.length} blocked${closedNote}`);
    for (const reason of r.blocked) {
      console.log(`   🚫 ${reason}`);
    }
  }

  const failBreakdown = totalFailed
    ? ` (fetch: ${failedByPhase.fetch}, db: ${failedByPhase.db}, config: ${failedByPhase.config})`
    : '';
  console.log(
    `\n=== Summary: ${totalProcessed} jobs processed, ${totalBlocked} blocked, ${totalClosed} closed as stale, ${totalFailed}/${companies.length} companies failed${failBreakdown} ===`
  );

  if (process.env.MONGODB_URI) {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  } else {
    console.log("✅ Dry run completed.");
  }
}

// Only auto-run when invoked directly (`node scripts/ingest-jobs.js`), so the
// helpers above can be imported by tests without kicking off a live ingest.
if (require.main === module) {
  ingestJobs().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  Opportunity,
  OpportunitySchema,
  classifyType,
  isIndiaLocation,
  INDIA_LOCATION_REGEX,
  reconcileStaleJobs,
  extractTags,
  interleaveByAts,
  ATS_FETCHERS,
  withRetry,
  runIngestPass,
};
