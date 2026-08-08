// Jooble adapter (job aggregator with strong India coverage) — Tier 1.
//
// Like Adzuna, Jooble aggregates thousands of boards into one API spanning every
// field — a broad, all-stream source of fresher inventory beyond the ATS boards.
//
// LIVE. Needs JOOBLE_API_KEY set locally (.env.local) and as a repo secret for
// CI. The free key's quota is 500 requests by default — see JOOBLE_MAX_REQUESTS
// below for the guard, and write to Jooble to raise the cap.
//
// Normalizes each posting into the common shape the orchestrator
// (scripts/ingest-jobs.js) consumes.

// Jooble returns ~20 results/page. Each page is one API call, so this bounds
// free-tier quota use. Raise via JOOBLE_MAX_PAGES or a per-entry `pages` field.
const JOOBLE_MAX_PAGES = Number(process.env.JOOBLE_MAX_PAGES) || 10;

// Hard per-run request ceiling. The free key carries a quota (500 by default),
// and the orchestrator retries failed companies — so a flaky run can spend far
// more than the 6 shards x JOOBLE_MAX_PAGES arithmetic suggests. This budget is
// the backstop: once spent, later shards return what they have instead of
// burning quota on calls that would 429 anyway. Module-level state is correct
// here because one ingest run is one process, so the counter resets per run.
const JOOBLE_MAX_REQUESTS = Number(process.env.JOOBLE_MAX_REQUESTS) || 400;
let requestsUsed = 0;

// Identity dedup spans the whole run, not just one shard: the generic fresher
// queries overlap heavily, so the same role comes back under several shards with
// a different /jdp/ id each time — distinct applyUrls, which is the pipeline's
// upsert key, so nothing downstream collapses them. Whichever shard sees a role
// first owns it; the others skip it and their stale copies reconcile to Closed.
// Module-level state is correct here (one ingest run is one process), and the
// check/add pair is synchronous, so concurrent shards cannot interleave it.
const identitySeen = new Set();
// Fresher signal, field-agnostic — any one term qualifies in Jooble's search.
const JOOBLE_FRESHER_TERMS = 'fresher trainee graduate intern entry level';

// Jooble snippets are HTML fragments: ~90% carry entities (&nbsp; padding around
// every ellipsis, &amp; in company names). Stripping tags alone leaves those raw
// on the job card, so decode the common ones before collapsing whitespace.
const ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#160': ' ',
};

function decodeEntities(s) {
  return String(s || '').replace(/&(#?\w+);/g, (match, code) => {
    if (ENTITIES[code] !== undefined) return ENTITIES[code];
    const numeric = /^#(\d+)$/.exec(code);
    return numeric ? String.fromCharCode(Number(numeric[1])) : match;
  });
}

function stripHtmlTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// Jooble is keyword-search, not a fresher filter: a query for "fresher software
// developer intern trainee" matches ANY term, so "Senior Software Developer"
// comes back too (~68% senior-titled on the IT shard). Worse, Jooble snippets
// are ~200-char teasers, so parseMinExperience finds no "3+ years" and the
// orchestrator leaves minExperience unstated — which PASSES the fresher filter
// on /jobs/<field> pages. Measured: 22 of 23 not-senior jobs would have shown up
// as "fresher" on the SEO pages while actually being mid-level.
//
// So this source requires a POSITIVE early-career title rather than merely the
// absence of a senior one. That also makes the label honest: isFresherTitle is
// authoritative in extractEligibility, so everything ingested here is correctly
// stamped minExperience 0 instead of sliding in unstated. Precision over volume
// — it is the product's whole promise. Regexes mirror the orchestrator's (kept
// local to avoid a circular require, since ingest-jobs.js loads this adapter).
const FRESHER_TITLE_RE =
  /\b(intern|internship|trainee|apprentice|junior|jr\.?|graduate|new\s?grad|entry[ -]level|campus)\b/i;
const SENIOR_TITLE_RE =
  /\b(senior|sr\.?|staff|lead|principal|manager|director|head|vp|chief|architect)\b/i;

/** True when a title signals an early-career role on its own. */
function isFresherTitle(title) {
  return FRESHER_TITLE_RE.test(title) && !SENIOR_TITLE_RE.test(title);
}

/**
 * Fetch fresher-eligible India postings from Jooble. Each job carries its own
 * real `companyName` (the aggregator spans many employers), so every posting
 * groups under the one aggregator `companySlug` for reconciliation while still
 * displaying the true company on the card.
 * @param {string} _slug - Unused; Jooble is a single aggregator, not a board slug.
 * @param {{keywords?:string, location?:string, pages?:number}} [company] - Per-entry config.
 * @returns {Promise<Array<{title:string,companyName:?string,location:string,content:string,applyUrl:string,department:?string}>>}
 */
async function fetchJoobleJobs(_slug, company = {}) {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'JOOBLE_API_KEY not set — get a free key at https://jooble.org/api/about, then set JOOBLE_API_KEY.'
    );
  }

  const keywords = company.keywords || JOOBLE_FRESHER_TERMS;
  const location = company.location || 'India';
  const maxPages = Number(company.pages) || JOOBLE_MAX_PAGES;

  const jobs = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page++) {
    if (requestsUsed >= JOOBLE_MAX_REQUESTS) {
      console.error(
        `[HEALTH ALERT] jooble request budget exhausted (${JOOBLE_MAX_REQUESTS}) — stopping at page ${page} of ${keywords}`
      );
      break;
    }
    requestsUsed++;
    const res = await fetch(`https://jooble.org/api/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords, location, page: String(page) }),
    });
    if (!res.ok) {
      // 429 means the account quota is gone, not that this shard is broken.
      // Spend the rest of the budget immediately so the remaining shards skip
      // their calls instead of each burning a retry against a dead quota.
      if (res.status === 429) {
        requestsUsed = JOOBLE_MAX_REQUESTS;
        console.error('[HEALTH ALERT] jooble returned 429 — quota exhausted for this run');
      }
      if (page === 1) throw new Error(`Jooble ${res.status} ${res.statusText}`);
      break; // a later page failing shouldn't discard earlier pages
    }
    const data = await res.json();
    const results = Array.isArray(data.jobs) ? data.jobs : [];
    if (results.length === 0) break;

    for (const r of results) {
      const applyUrl = r.link;
      if (!applyUrl || seen.has(applyUrl)) continue;

      const title = stripHtmlTags(r.title).slice(0, 200);
      if (!isFresherTitle(title)) continue;

      const companyName = (r.company && stripHtmlTags(r.company)) || undefined;
      // Jooble re-lists one role under several /jdp/ ids (~34% of a page), so
      // applyUrl alone -- the pipeline's dedup key -- does not collapse them.
      // Identity is title + company, so the feed shows the role once.
      const identity = `${title}|${companyName || ''}`.toLowerCase();
      if (identitySeen.has(identity)) continue;

      seen.add(applyUrl);
      identitySeen.add(identity);
      jobs.push({
        title,
        companyName,
        location: (r.location && stripHtmlTags(r.location)) || 'India',
        content: stripHtmlTags(r.snippet).slice(0, 4000),
        applyUrl,
        department: null,
      });
    }

    // Stop once we've paged past the reported total.
    if (typeof data.totalCount === 'number' && page * results.length >= data.totalCount) break;
  }
  return jobs;
}

module.exports = { ats: 'jooble', tier: 1, fetch: fetchJoobleJobs };
