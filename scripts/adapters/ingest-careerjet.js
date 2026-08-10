// Careerjet adapter (India-native job aggregator) — Tier 1.
//
// Careerjet runs a dedicated India property (careerjet.co.in) and, unlike a raw
// keyword aggregator, exposes a STRUCTURED contract-type filter. That matters:
// `contract_type=i` returns internships as ground truth rather than as a guess
// derived from whether the word "intern" happens to appear in the title. This is
// the single reason this source earns a slot — a Jooble-style keyword sweep for
// "fresher" returns ~68% senior roles, and their short excerpts leave
// minExperience unstated, which then slips past the fresher filter on the
// /jobs/<field> SEO pages. Structured filters avoid that whole failure class.
//
// Needs a free partner key from https://www.careerjet.co.in/partners/api:
//   CAREERJET_API_KEY  (sent as the HTTP Basic Auth *username*, empty password)
//
// Normalizes each posting into the common shape the orchestrator
// (scripts/ingest-jobs.js) consumes.

const CAREERJET_ENDPOINT = 'https://search.api.careerjet.net/v4/query';

// Careerjet caps `page` at 10 and `page_size` at 100, so one shard tops out at
// 1,000 postings. Each page is one API call, so this also bounds quota use.
const CAREERJET_MAX_PAGES = Number(process.env.CAREERJET_MAX_PAGES) || 8;
const CAREERJET_PAGE_SIZE = Number(process.env.CAREERJET_PAGE_SIZE) || 100;

// Hard per-run request ceiling across every shard — the backstop against a
// flaky run plus orchestrator retries burning a free-tier quota. Module-level
// state is correct here: one ingest run is one process, so it resets per run.
const CAREERJET_MAX_REQUESTS = Number(process.env.CAREERJET_MAX_REQUESTS) || 400;
let requestsUsed = 0;

// Identity dedup spans the whole run, not just one shard. With 16 internship
// shards plus 8 keyword shards over one India index, the same role surfaces
// under several of them with a different url each time — distinct applyUrls,
// which is the pipeline's upsert key, so nothing downstream collapses them.
// Whichever shard sees a role first owns it; the others skip it and their stale
// copies reconcile to Closed. Shard order therefore decides which field a
// cross-field role lands under, which is why the more specific internship
// shards are listed ahead of the broad keyword ones in companies.json.
// Module-level state is correct here (one ingest run is one process), and the
// check/add pair is synchronous, so concurrent shards cannot interleave it.
const identitySeen = new Set();

// The API defaults `fragment_size` to a 120-character teaser. That is actively
// harmful for us: parseMinExperience needs enough body text to find "3+ years",
// and with a stub it finds nothing, leaves minExperience unstated, and the
// posting sails onto the fresher SEO pages regardless of its real seniority.
// Ask for a real excerpt so eligibility extraction has something to read.
const CAREERJET_FRAGMENT_SIZE = Number(process.env.CAREERJET_FRAGMENT_SIZE) || 1000;

// Careerjet requires both on every request. Note that `user_ip` is NOT the
// authentication IP: it is the *end user's* address in a normal integration and
// only geo-targets results, so an India address keeps this India-relevant. What
// authenticates is the real source IP of the request, which must be declared on
// the partner account (max 8) — see the 403 branch below.
const CAREERJET_USER_AGENT = 'UmbrixBot/1.0 (+https://umbrix.vercel.app/bot)';
const CAREERJET_USER_IP = process.env.CAREERJET_USER_IP || '49.36.0.1';

// Careerjet rejects a request with no Referer ("Undeclared referrer") even when
// the key and source IP are both valid — its affiliate model attributes every
// call to a site. Send our own origin.
const CAREERJET_REFERER =
  process.env.CAREERJET_REFERER || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.umbrix.in';

// Excerpts arrive as HTML fragments with entities (&nbsp; padding, &amp; in
// company names). Stripping tags alone leaves those raw on the job card.
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

// Mirrors the orchestrator's regexes, kept local to avoid a circular require
// (ingest-jobs.js loads this adapter). Used only on keyword shards, where the
// title is the only trustworthy fresher signal.
const FRESHER_TITLE_RE =
  /\b(intern|internship|trainee|apprentice|junior|jr\.?|graduate|new\s?grad|entry[ -]level|campus)\b/i;
const SENIOR_TITLE_RE =
  /\b(senior|sr\.?|staff|lead|principal|manager|director|head|vp|chief|architect)\b/i;

/** True when a title signals an early-career role on its own. */
function isFresherTitle(title) {
  return FRESHER_TITLE_RE.test(title) && !SENIOR_TITLE_RE.test(title);
}

/**
 * Fetch fresher-eligible India postings from Careerjet. Each job carries its own
 * real `companyName` (the aggregator spans many employers), so every posting
 * groups under the one aggregator `companySlug` for reconciliation while still
 * displaying the true company on the card.
 *
 * Shards come in two flavours, set per entry in companies.json:
 *  - `contractType: 'i'` — internships, structurally guaranteed. Every result is
 *    kept and stamped `minExperience: 0` authoritatively, because the API (not a
 *    title heuristic) is asserting it.
 *  - keyword-only — no structural guarantee, so a posting is kept only when its
 *    title is independently early-career. Precision over volume: this source
 *    feeds the "fresher jobs" SEO pages, and a mislabelled mid-level role there
 *    breaks the product's core promise.
 *
 * @param {string} _slug - Unused; Careerjet is a single aggregator, not a board slug.
 * @param {{keywords?:string, location?:string, contractType?:string, pages?:number}} [company]
 * @returns {Promise<Array<{title:string,companyName:?string,location:string,content:string,applyUrl:string,department:?string,eligibility:?object}>>}
 */
async function fetchCareerjetJobs(_slug, company = {}) {
  const apiKey = process.env.CAREERJET_API_KEY;
  if (!apiKey) {
    throw new Error(
      'CAREERJET_API_KEY not set — get a free partner key at https://www.careerjet.co.in/partners/api'
    );
  }

  const keywords = company.keywords || 'fresher trainee graduate intern entry level';
  const location = company.location || 'India';
  const contractType = company.contractType;
  const maxPages = Number(company.pages) || CAREERJET_MAX_PAGES;
  // Basic auth: the key is the username and the password is empty.
  const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');

  const jobs = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page++) {
    if (requestsUsed >= CAREERJET_MAX_REQUESTS) {
      console.error(
        `[HEALTH ALERT] careerjet request budget exhausted (${CAREERJET_MAX_REQUESTS}) — stopping at page ${page} of "${keywords}"`
      );
      break;
    }

    const params = new URLSearchParams({
      locale_code: 'en_IN',
      keywords,
      location,
      sort: 'date', // freshness is a core UMBRIX promise
      page: String(page),
      page_size: String(CAREERJET_PAGE_SIZE),
      fragment_size: String(CAREERJET_FRAGMENT_SIZE),
      user_ip: CAREERJET_USER_IP,
      user_agent: CAREERJET_USER_AGENT,
    });
    if (contractType) params.set('contract_type', contractType);

    requestsUsed++;
    const res = await fetch(`${CAREERJET_ENDPOINT}?${params}`, {
      headers: {
        Authorization: auth,
        'User-Agent': CAREERJET_USER_AGENT,
        Referer: CAREERJET_REFERER,
      },
    });
    if (!res.ok) {
      // 429 means the account quota is gone, not that this shard is broken.
      // Spend the rest of the budget so the remaining shards skip their calls
      // instead of each burning a retry against a dead quota.
      if (res.status === 429) {
        requestsUsed = CAREERJET_MAX_REQUESTS;
        console.error('[HEALTH ALERT] careerjet returned 429 — quota exhausted for this run');
      }
      // 403 is the IP allowlist, not a bad key, and it is the failure mode this
      // source is most likely to hit: Careerjet authenticates the calling server
      // by IP (max 8), and the body names the address it rejected. Surface that
      // address — without it this reads as a broken adapter rather than "the
      // runner egressed from an IP nobody declared". Same reasoning as 429:
      // every shard would otherwise burn a retry against the same wall.
      if (res.status === 403) {
        requestsUsed = CAREERJET_MAX_REQUESTS;
        const detail = await res.text().catch(() => '');
        const ip = /from IP ([\d.]+)/.exec(detail);
        console.error(
          `[HEALTH ALERT] careerjet returned 403 — caller IP is not on the allowlist` +
            (ip ? ` (rejected ${ip[1]})` : '') +
            '. Declare it at https://www.careerjet.co.in/partners/api'
        );
      }
      if (page === 1) throw new Error(`Careerjet ${res.status} ${res.statusText}`);
      break; // a later page failing shouldn't discard earlier pages
    }

    const data = await res.json();
    const results = Array.isArray(data.jobs) ? data.jobs : [];
    if (results.length === 0) break;

    for (const r of results) {
      const applyUrl = r.url;
      if (!applyUrl || seen.has(applyUrl)) continue;

      const title = stripHtmlTags(r.title).slice(0, 200);
      if (!title) continue;
      // Senior titles are dropped from every shard: an "internship" contract
      // type on a "Senior ..." title is upstream mislabelling, not a fresher role.
      if (SENIOR_TITLE_RE.test(title)) continue;
      // Keyword shards carry no structural guarantee, so demand a fresher title.
      if (!contractType && !isFresherTitle(title)) continue;

      const companyName = (r.company && stripHtmlTags(r.company)) || undefined;
      // Aggregators re-list one role under several ids, and applyUrl — the
      // pipeline's dedup key — does not collapse those. Identity is title+company.
      const identity = `${title}|${companyName || ''}`.toLowerCase();
      if (identitySeen.has(identity)) continue;

      seen.add(applyUrl);
      identitySeen.add(identity);
      jobs.push({
        title,
        companyName,
        location: (r.locations && stripHtmlTags(r.locations)) || 'India',
        content: stripHtmlTags(r.description).slice(0, 20000),
        applyUrl,
        department: null,
        // Ground truth beats inference. On an internship shard the API has
        // already asserted this is an internship, so stamp it rather than
        // letting a keyword-free title fall through as unstated.
        eligibility: contractType === 'i' ? { minExperience: 0 } : undefined,
      });
    }

    // Stop once we have paged past the reported total.
    if (typeof data.pages === 'number' && page >= data.pages) break;
  }

  return jobs;
}

// DORMANT — no scheduled workflow runs this.
//
// Tier 5 is the static-IP tier, not a time slot. Careerjet authenticates the
// calling server by IP (max 8 declared addresses), which GitHub-hosted runners
// cannot satisfy: their egress spans ~5,600 CIDR ranges (~28M addresses) and
// the API answers 403 "Unauthorized access from IP <x>". Free static-IP hosting
// requires a payment method, so there is nowhere to run this today.
//
// The connector is kept because the data is genuinely good — measured at 5.13
// jobs/request with 0% unstated eligibility, well ahead of any other aggregator
// tried. Give it a host with a declared IP and `--tier=5` turns it back on; the
// hosted crons ask for tiers 1 and 3 and never reach it in the meantime.
module.exports = { ats: 'careerjet', tier: 5, fetch: fetchCareerjetJobs };
