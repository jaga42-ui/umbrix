// Adzuna adapter (all-field India job aggregator) — Tier 1.
//
// The ATS adapters are company-by-company and skew tech/senior. Adzuna is a
// documented JSON API that aggregates thousands of boards into one India
// endpoint spanning EVERY field — sales, marketing, BPO, finance, admin, retail,
// ops, healthcare, teaching, … — which is how UMBRIX gets broad *fresher*
// inventory across all streams, not just software. It's also messy real-world
// data (multiple upstream boards), so the scam filter finally has something to
// catch. Needs free credentials from https://developer.adzuna.com:
//   ADZUNA_APP_ID / ADZUNA_APP_KEY.
//
// Normalizes each posting into the common shape the orchestrator
// (scripts/ingest-jobs.js) consumes.

// 50 results/page (Adzuna's max) × pages. Each page is one API call, so this
// also bounds free-tier quota use. With ~18 category shards this default keeps
// the whole run well under the free 250-calls/day cap (18 × 8 = 144). Raise via
// ADZUNA_MAX_PAGES (global) or a per-entry `pages` field once your plan allows.
const ADZUNA_MAX_PAGES = Number(process.env.ADZUNA_MAX_PAGES) || 8;
// Only pull recently-posted roles — freshness is a core UMBRIX promise.
const ADZUNA_MAX_DAYS_OLD = 30;
// Fresher signal, deliberately field-agnostic (no tech bias) so the query spans
// every stream. Adzuna treats `what_or` terms as OR, so any one match qualifies.
const ADZUNA_FRESHER_TERMS = 'fresher trainee graduate intern entry associate';

function stripHtmlTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Fetch fresher-eligible India postings across all fields from Adzuna. Each job
 * carries its own real `companyName` (the aggregator spans many employers), so
 * every posting groups under the one aggregator `companySlug` for reconciliation
 * while still displaying the true company on the card.
 * @param {string} _slug - Unused; Adzuna is a single aggregator, not a board slug.
 * @param {{category?:string,pages?:number}} [company] - Optional per-entry config.
 * @returns {Promise<Array<{title:string,companyName:?string,location:string,content:string,applyUrl:string,department:?string}>>}
 */
async function fetchAdzunaJobs(_slug, company = {}) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error(
      'ADZUNA_APP_ID / ADZUNA_APP_KEY not set — get a free key at https://developer.adzuna.com'
    );
  }

  const maxPages = Number(company.pages) || ADZUNA_MAX_PAGES;
  const jobs = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: '50',
      what_or: ADZUNA_FRESHER_TERMS,
      max_days_old: String(ADZUNA_MAX_DAYS_OLD),
      'content-type': 'application/json',
    });
    // Optional per-entry category shard (e.g. "sales-jobs") for deeper coverage
    // of a single field; omitted = all fields in one broad sweep.
    if (company.category) params.set('category', company.category);

    const res = await fetch(`https://api.adzuna.com/v1/api/jobs/in/search/${page}?${params}`);
    if (!res.ok) {
      if (page === 1) throw new Error(`Adzuna ${res.status} ${res.statusText}`);
      break; // a later page failing shouldn't discard earlier pages
    }
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    if (results.length === 0) break;

    for (const r of results) {
      const applyUrl = r.redirect_url;
      if (!applyUrl || seen.has(applyUrl)) continue;
      seen.add(applyUrl);
      jobs.push({
        title: stripHtmlTags(r.title).slice(0, 200),
        companyName: (r.company && r.company.display_name) || undefined,
        location: (r.location && r.location.display_name) || 'India',
        content: stripHtmlTags(r.description).slice(0, 4000),
        applyUrl,
        department: (r.category && r.category.label) || null,
      });
    }
  }
  return jobs;
}

module.exports = { ats: 'adzuna', tier: 1, fetch: fetchAdzunaJobs };
