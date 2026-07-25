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
    companyName: { type: String },
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

function stripTagsSimple(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Minimum years of experience a posting requires. This is the highest-value
 * fresher signal — "can a fresher even apply?". Returns 0 for fresher/entry
 * roles, the stated number for experienced roles, or undefined when unknown.
 * An explicit "N+ years experience" (N>=2) wins over a stray fresher word.
 */
function parseMinExperience(text) {
  const t = String(text || '').toLowerCase();
  // Deliberately biased toward precision: a false "needs N years" HIDES a
  // fresher-eligible role, so the requirement patterns all demand explicit
  // context (the word experience/exp, minimum/at least, or a numeric range) —
  // never a bare "N+ years", which company self-description ("25+ years of
  // excellence") would trip. `(?:years?|yrs?)` catches the very common Indian-JD
  // "yrs" shorthand the old parser missed; "exp" catches the abbreviation.
  const m =
    // N (+/range) years/yrs ... within 24 chars of experience/exp
    t.match(/(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*(?:years?|yrs?)[^.]{0,24}?\b(?:experience|exp)\b/) ||
    // experience/exp ... : N (+) years/yrs
    t.match(/\b(?:experience|exp)\b[^.]{0,14}?:?\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)/) ||
    // minimum / min / at least N (+) years/yrs
    t.match(/\b(?:minimum|min\.?|at\s*least)\s+(?:of\s+)?(\d{1,2})\s*\+?\s*(?:years?|yrs?)/) ||
    // explicit N–M years/yrs range (precise even without the word "experience");
    // guarded against "N years old/ago" (company age, not a requirement).
    t.match(/(\d{1,2})\s*(?:-|–|to)\s*\d{1,2}\s*(?:years?|yrs?)\b(?!\s+(?:ago|old))/);
  const num = m ? parseInt(m[1], 10) : undefined;
  const validNum = num !== undefined && num >= 0 && num <= 30 ? num : undefined;
  const fresher =
    /\b(freshers?|entry[\s-]level|new\s?grads?|recent\s+graduates?|no\s+(?:prior\s+|relevant\s+|work\s+)?experience|experience\s+not\s+required|0\s*(?:-|–|to)\s*[12]\s*(?:years?|yrs?))\b/.test(t);
  if (validNum !== undefined && validNum >= 2) return validNum; // explicit requirement wins
  if (fresher) return 0;
  return validNum; // 0, 1, or undefined
}

/** Graduating batch years a posting names (Indian-campus convention). */
function parseBatchYears(text) {
  const t = String(text || '');
  const out = new Set();
  const add = (s) =>
    (s.match(/20\d{2}/g) || []).forEach((y) => {
      const n = parseInt(y, 10);
      if (n >= 2020 && n <= 2030) out.add(n);
    });
  let m;
  // keyword → year(s): "batch of 2025", "graduating in 2025/2026"
  const re1 = /\b(?:batch|graduat\w*|class of|passing?\s*out)\b[^.]{0,40}?((?:20\d{2}[,/\s&]*(?:and\s*)?)+)/gi;
  while ((m = re1.exec(t))) add(m[1]);
  // year(s) → keyword: "2025 batch", "2024 & 2025 graduates"
  const re2 = /((?:20\d{2}[,/\s&]*(?:and\s*)?)+)(?:batch|graduates?|pass\s*outs?)\b/gi;
  while ((m = re2.exec(t))) add(m[1]);
  return [...out].sort((a, b) => a - b);
}

/** A stated CGPA cutoff (0–10 scale), when present. */
function parseCgpa(text) {
  const t = String(text || '');
  const m =
    t.match(/(\d(?:\.\d)?)\s*(?:\+|and above|or above)?\s*(?:cgpa|gpa)\b/i) ||
    t.match(/\b(?:cgpa|gpa)\b\s*(?:of|:|>=|above|minimum|min\.?)?\s*(\d(?:\.\d)?)/i);
  if (m) {
    const n = parseFloat(m[1]);
    if (n > 0 && n <= 10) return n;
  }
  return undefined;
}

// Titles that are fresher-eligible on their own. "associate" is deliberately
// excluded — it's ambiguous (Associate Director/Principal are senior). Guarded
// against senior modifiers so "Senior Graduate Recruiter" doesn't slip through.
const FRESHER_TITLE_RE =
  /\b(intern|internship|trainee|apprentice|junior|jr\.?|graduate|new\s?grad|entry[ -]level|campus)\b/i;
const SENIOR_TITLE_RE = /\b(senior|sr\.?|staff|lead|principal|manager|director|head|vp|chief)\b/i;

/** A title that, on its own, signals an early-career / fresher-eligible role. */
function isFresherTitle(title) {
  const t = String(title || '');
  return FRESHER_TITLE_RE.test(t) && !SENIOR_TITLE_RE.test(t);
}

/** Extracts the eligibility fields from a posting. Omits unknown fields. */
function extractEligibility(title, content) {
  const text = (String(title || '') + ' ' + stripTagsSimple(content)).slice(0, 20000);
  const elig = { batchYears: parseBatchYears(text) };
  // A clearly early-career title (intern/junior/graduate/trainee) is authoritative
  // for fresher-eligibility even when the body doesn't spell out "0 years".
  const me = isFresherTitle(title) ? 0 : parseMinExperience(text);
  if (me !== undefined) elig.minExperience = me;
  const cg = parseCgpa(text);
  if (cg !== undefined) elig.cgpaCutoff = cg;
  return elig;
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

// --- Source adapters -------------------------------------------------------
// Each source lives in its own file under scripts/adapters/, exporting
// { ats, tier, fetch } where `fetch(slug, company)` returns postings in the
// common shape { title, location, content, applyUrl, department } (Adzuna also
// sets companyName). The shared pipeline below owns scam filtering, eligibility
// extraction, upsert, and stale reconciliation — so adding a source is a new
// file here plus its companies.json entries, nothing else to touch.
const ADAPTERS = [
  require('./adapters/ingest-greenhouse'),
  require('./adapters/ingest-lever'),
  require('./adapters/ingest-ashby'),
  require('./adapters/ingest-smartrecruiters'),
  require('./adapters/ingest-adzuna'),
  require('./adapters/ingest-jooble'),
];

const ATS_FETCHERS = Object.fromEntries(ADAPTERS.map((a) => [a.ats, a.fetch]));

// Staggered-cron tier assignment, declared by each adapter. The rulebook's
// 4-tier schedule (APIs / India scrapers / ATS / government) is aspirational —
// only two tiers have a real source today: Tier 1 (aggregator APIs) and Tier 3
// (company ATS boards). Tiers 2 and 4 have no adapters yet, so a `--tier=2` run
// cleanly no-ops. Tier is keyed by `ats`, so companies.json stays untouched.
const TIER_BY_ATS = Object.fromEntries(ADAPTERS.map((a) => [a.ats, a.tier]));

/**
 * The staggered-cron tier requested via `--tier=N` (CLI) or INGEST_TIER (CI),
 * or null to run every source in one pass (the default — backward-compatible
 * with the single nightly workflow). Throws on a malformed value so a typo in
 * a cron definition fails loud instead of silently ingesting everything.
 * @returns {number|null}
 */
function parseTierArg(argv = process.argv, env = process.env) {
  const flag = argv.find((a) => a.startsWith('--tier='));
  const raw = flag ? flag.slice('--tier='.length) : env.INGEST_TIER;
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid --tier value "${raw}" — expected a positive integer.`);
  }
  return n;
}

// A skill keyword only counts as a whole token, not a substring — otherwise
// short keywords match inside unrelated words ("AI" inside "trAInee"/"avAIlable",
// "Go" inside "Google"), which was tagging every fresher post with a bogus "AI"
// and rocketing it to a 99% match. Boundaries are "not an ASCII letter/digit" so
// keywords ending in punctuation ("C++", "Node.js", "UI/UX") still match.
const SKILL_MATCHERS = SKILL_KEYWORDS.map((keyword) => {
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { keyword, re: new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i') };
});

function extractTags(job) {
  const tags = [];
  if (job.department) tags.push(job.department);

  const haystack = `${job.title}\n${job.content}`;
  for (const { keyword, re } of SKILL_MATCHERS) {
    if (re.test(haystack) && !tags.includes(keyword)) tags.push(keyword);
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

async function processCompany(company) {
  const { slug, ats } = company;
  const fetchJobs = ATS_FETCHERS[ats];
  if (!fetchJobs) {
    return { slug, ok: false, phase: 'config', message: `Unknown ATS "${ats}"` };
  }

  // Track which phase failed so the summary can separate flaky ATS endpoints
  // from database problems — they need different fixes.
  let phase = 'fetch';
  try {
    // Aggregator fetchers (Adzuna) read extra config (e.g. category) off the
    // company entry; ATS fetchers ignore the second arg.
    const rawJobs = await withRetry(() => fetchJobs(slug, company));
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
        companyName: job.companyName,
        title: job.title,
        location: job.location,
        descriptionHtml: job.content,
        tags: extractTags(job),
        applyUrl: job.applyUrl,
        status: 'Active',
        type: classifyType(job.title),
        isIndia: isIndiaLocation(job.location),
        ...extractEligibility(job.title, job.content),
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

// --- Once-a-day rate limit -------------------------------------------------
// The Adzuna free tier is ~250 API calls/day and one full ingest uses ~144, so
// two runs in a day blow the quota. We enforce "at most one run per day" at the
// script level (not just the cron) so a manual re-run / workflow_dispatch can't
// overshoot. State lives in a tiny `meta` doc. Default gap is 20h — under the
// 24h cron interval (so the nightly run is never wrongly skipped) but far above
// any accidental back-to-back run. Override with FORCE_INGEST=1 or `--force`.
const MIN_INGEST_INTERVAL_HOURS = Number(process.env.MIN_INGEST_INTERVAL_HOURS) || 20;

// Guard state is keyed per tier so staggered tier runs don't clobber each
// other's timestamp: a Tier 1 run at 00:00 stamping the shared key would make a
// Tier 3 run at 04:00 skip. An un-tiered (full) run keeps the original 'ingest'
// key, so the existing single nightly workflow is unaffected.
function metaIdForTier(tier) {
  return tier == null ? 'ingest' : `ingest:tier${tier}`;
}

/** Hours since this key's last recorded run, or null if outside the window / unrecorded. */
async function hoursSinceLastRunIfTooSoon(metaId = 'ingest') {
  const doc = await mongoose.connection.db.collection('meta').findOne({ _id: metaId });
  if (!doc || !doc.lastRunAt) return null;
  const hours = (Date.now() - new Date(doc.lastRunAt).getTime()) / 3.6e6;
  return hours < MIN_INGEST_INTERVAL_HOURS ? hours : null;
}

/** Stamp this key's run time so the next invocation can honor the daily limit. */
async function recordRun(metaId = 'ingest') {
  await mongoose.connection.db
    .collection('meta')
    .updateOne({ _id: metaId }, { $set: { lastRunAt: new Date() } }, { upsert: true });
}

async function ingestJobs() {
  // Which staggered-cron tier to run (null = every source, the default).
  const tier = parseTierArg();
  const metaId = metaIdForTier(tier);

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
    // on by default for Atlas URIs; set it explicitly for safety. The initial
    // connect is retried too — a transient Atlas handshake/overload blip at
    // startup shouldn't abort the whole run (per-company writes already retry).
    await withRetry(() =>
      mongoose.connect(process.env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 60000,
        retryWrites: true,
      })
    , 3, 3000);
    console.log("✅ Connected to MongoDB");

    // Enforce the once-a-day limit before spending any API quota.
    const force = process.argv.includes('--force') || process.env.FORCE_INGEST === '1';
    if (!force) {
      const since = await hoursSinceLastRunIfTooSoon(metaId);
      if (since !== null) {
        console.log(
          `⏳ Last ingest ran ${since.toFixed(1)}h ago (< ${MIN_INGEST_INTERVAL_HOURS}h). ` +
            `Skipping to stay within the once-a-day limit. Use --force (or FORCE_INGEST=1) to override.`
        );
        await mongoose.disconnect();
        return;
      }
    }
  }

  const companiesPath = path.join(__dirname, 'companies.json');
  let companies = JSON.parse(fs.readFileSync(companiesPath, 'utf8'));

  // Scope to the requested tier so a staggered cron only touches its own
  // sources (and only spends that tier's API quota). A tier with no adapters
  // yet is a clean no-op, not an error.
  if (tier !== null) {
    companies = companies.filter((c) => TIER_BY_ATS[c.ats] === tier);
    if (companies.length === 0) {
      console.log(`No sources configured for tier ${tier} — nothing to ingest.`);
      if (process.env.MONGODB_URI) await mongoose.disconnect();
      return;
    }
    console.log(`Tier ${tier}: ${companies.length} source(s) selected.`);
  }

  companies = interleaveByAts(companies);

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
    // Stamp this run so the daily limit is honored next time (the run consumed
    // API quota even if some sources failed, so record it regardless). Keyed
    // per tier so staggered tier runs don't suppress one another.
    await recordRun(metaId);
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
  parseMinExperience,
  isFresherTitle,
  extractEligibility,
  reconcileStaleJobs,
  extractTags,
  interleaveByAts,
  ATS_FETCHERS,
  TIER_BY_ATS,
  parseTierArg,
  metaIdForTier,
  withRetry,
  runIngestPass,
};
