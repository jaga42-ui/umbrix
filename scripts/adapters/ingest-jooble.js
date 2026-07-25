// Jooble adapter (job aggregator with strong India coverage) — Tier 1.
//
// Like Adzuna, Jooble aggregates thousands of boards into one API spanning every
// field — a broad, all-stream source of fresher inventory beyond the ATS boards.
//
// READY TO RUN — just add the key:
//   1. Get a free API key at https://jooble.org/api/about
//   2. Set JOOBLE_API_KEY in .env.local (and as a repo/Vercel secret for CI)
//   3. Run the ingest — the jooble-in-* shards in companies.json are already wired.
// No further code changes needed.
//
// Normalizes each posting into the common shape the orchestrator
// (scripts/ingest-jobs.js) consumes.

// Jooble returns ~20 results/page. Each page is one API call, so this bounds
// free-tier quota use. Raise via JOOBLE_MAX_PAGES or a per-entry `pages` field.
const JOOBLE_MAX_PAGES = Number(process.env.JOOBLE_MAX_PAGES) || 10;
// Fresher signal, field-agnostic — any one term qualifies in Jooble's search.
const JOOBLE_FRESHER_TERMS = 'fresher trainee graduate intern entry level';

function stripHtmlTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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
  // TODO(owner): set JOOBLE_API_KEY once you grab a free key from
  // https://jooble.org/api/about — nothing else is needed to run.
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
    const res = await fetch(`https://jooble.org/api/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords, location, page: String(page) }),
    });
    if (!res.ok) {
      if (page === 1) throw new Error(`Jooble ${res.status} ${res.statusText}`);
      break; // a later page failing shouldn't discard earlier pages
    }
    const data = await res.json();
    const results = Array.isArray(data.jobs) ? data.jobs : [];
    if (results.length === 0) break;

    for (const r of results) {
      const applyUrl = r.link;
      if (!applyUrl || seen.has(applyUrl)) continue;
      seen.add(applyUrl);
      jobs.push({
        title: stripHtmlTags(r.title).slice(0, 200),
        companyName: (r.company && String(r.company).trim()) || undefined,
        location: (r.location && String(r.location).trim()) || 'India',
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
