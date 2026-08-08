/**
 * Workday connector. Public career-site JSON API, no authentication.
 *
 * This exists because of a measured failure. The registry's 162 ATS boards
 * yield only 1,591 India jobs (84 of them yield zero), leaving Adzuna carrying
 * ~85% of the fresher feed. The obvious fix — find more Indian companies on
 * Greenhouse/Lever/Ashby/SmartRecruiters — was tested and did not work: probing
 * 198 Indian employers across all four platforms found 9 usable boards totalling
 * 119 India jobs, because 167 of them have no board on any of those platforms at
 * all. Those are US-centric ATS products; Indian employers and the global GCCs
 * that hire Indian freshers at scale largely do not use them.
 *
 * Workday is where that volume actually lives. Two tenants alone (Adobe 153,
 * NVIDIA 221) returned more India jobs than the entire 198-company sweep.
 *
 * The endpoint is the same public JSON API a company's own careers page calls —
 * no auth, no login wall, no proxy, no robots.txt circumvention. It is the same
 * category of source as the existing ATS connectors.
 */

import type { Connector, FetchContext, NormalizedJob } from '@umbrix/core';
import { normalizeCategory, normalizeLocation, detectWorkMode, classifyType, extractTags, stripHtml, truncateWords, isIndiaLocation } from '@umbrix/normalizer';
import { extractEligibility } from '@umbrix/eligibility';
import { fetchJson, probe, USER_AGENT } from './http.js';
import { validateJob } from './validation.js';

export interface WorkdayJob {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
  /** Filled by the detail pass — see the two-phase note on fetch(). */
  jobDescription?: string;
  startDate?: string;
  detailLocation?: string;
}

interface WorkdayResponse {
  total?: number;
  jobPostings?: WorkdayJob[];
}

interface WorkdayDetail {
  jobPostingInfo?: {
    jobDescription?: string;
    startDate?: string;
    location?: string;
  };
}

/**
 * Titles that are senior on their face. Dropped before the detail pass rather
 * than after: the list endpoint carries no description at all, so a title is the
 * only signal available, and fetching 3,963 characters of prose for a "Sr.
 * Manager" only to discard it wastes ~62% of the request budget.
 */
const SENIOR_TITLE_RE =
  /\b(senior|sr\.?|staff|lead|principal|manager|director|head|vp|chief|architect)\b/i;

/** How many detail requests to run at once. Courteous, not aggressive. */
const DETAIL_CONCURRENCY = 6;

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

/**
 * Per-entry config from companies.json. Workday needs three parts because a
 * tenant's URL encodes all three:
 *   https://{tenant}.{wd}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
 */
interface WorkdayConfig {
  /** Tenant id, e.g. "adobe". Falls back to the registry slug. */
  tenant?: string;
  /** Workday pod, e.g. "wd5". Tenants are spread across wd1-wd12. */
  wd?: string;
  /** Career-site name, e.g. "external_experienced". Tenant-specific. */
  site?: string;
  pages?: number;
}

/** Workday's own page size cap for this endpoint. */
const PAGE_SIZE = 20;
const DEFAULT_MAX_PAGES = Number(process.env.WORKDAY_MAX_PAGES) || 15;
const MAX_DESCRIPTION = 4_000;

/**
 * Server-side India filter. Workday searches the whole posting, so this is a
 * coarse narrowing rather than a guarantee — `isIndia` is still decided from the
 * normalized location. Filtering here matters anyway: an unfiltered tenant can
 * be thousands of postings deep, almost all irrelevant, and paging through them
 * to discard 90% wastes the run.
 */
const INDIA_SEARCH_TEXT = 'India';

function endpoint(config: WorkdayConfig, slug: string): string {
  const tenant = config.tenant ?? slug;
  const wd = config.wd ?? 'wd5';
  const site = config.site ?? 'External';
  return `https://${tenant}.${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
}

/** Public posting URL for a result, derived from its externalPath. */
function applyUrlFor(config: WorkdayConfig, slug: string, externalPath: string): string {
  const tenant = config.tenant ?? slug;
  const wd = config.wd ?? 'wd5';
  const site = config.site ?? 'External';
  return `https://${tenant}.${wd}.myworkdayjobs.com/en-US/${site}${externalPath}`;
}

export const workdayConnector: Connector<WorkdayJob & { __config: WorkdayConfig; __slug: string }> = {
  id: 'workday',
  tier: 3,

  async fetch(ctx: FetchContext) {
    const config = ctx.config as WorkdayConfig;
    const maxPages = Number(config.pages) || DEFAULT_MAX_PAGES;
    const url = endpoint(config, ctx.slug);

    const out: (WorkdayJob & { __config: WorkdayConfig; __slug: string })[] = [];
    const seen = new Set<string>();
    // Workday reports `total` only on the FIRST request of a search; every later
    // page returns total: 0 while still serving results. Trusting it per-page
    // makes any `offset >= total` bound fire immediately and truncate the board
    // (measured: 40 of 153 postings fetched). Capture it once.
    let reportedTotal: number | undefined;

    for (let page = 0; page < maxPages; page++) {
      if (ctx.signal?.aborted) break;

      const data = await fetchJson<WorkdayResponse>(url, {
        signal: ctx.signal,
        headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
        method: 'POST',
        body: JSON.stringify({
          appliedFacets: {},
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          searchText: INDIA_SEARCH_TEXT,
        }),
      });

      const postings = data.jobPostings ?? [];
      if (postings.length === 0) break;
      if (page === 0 && typeof data.total === 'number' && data.total > 0) reportedTotal = data.total;

      for (const posting of postings) {
        const key = posting.externalPath ?? posting.title ?? '';
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ ...posting, __config: config, __slug: ctx.slug });
      }

      // Stop on a short page, or once past the total captured from page 0.
      if (postings.length < PAGE_SIZE) break;
      if (reportedTotal !== undefined && (page + 1) * PAGE_SIZE >= reportedTotal) break;
    }

    // --- Phase 2: enrich with descriptions ---------------------------------
    // The list endpoint returns NO description — measured at 0% across 1,319
    // India postings. Without body text, extractEligibility finds nothing,
    // minExperience lands unstated, and unstated PASSES the fresher filter on
    // the /jobs/<field> pages. Shipping phase 1 alone would publish 1,319
    // mostly-senior roles as fresher jobs (62% were senior-titled).
    //
    // Senior titles are dropped first so the expensive pass only runs on
    // plausible candidates.
    const candidates = out.filter((j) => !SENIOR_TITLE_RE.test(j.title ?? ''));
    ctx.log.debug('workday detail pass', { slug: ctx.slug, listed: out.length, candidates: candidates.length });

    await mapLimit(candidates, DETAIL_CONCURRENCY, async (job) => {
      if (!job.externalPath || ctx.signal?.aborted) return;
      const config = job.__config;
      const tenant = config.tenant ?? job.__slug;
      const wd = config.wd ?? 'wd5';
      const site = config.site ?? 'External';
      try {
        const detail = await fetchJson<WorkdayDetail>(
          `https://${tenant}.${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}${job.externalPath}`,
          { signal: ctx.signal, attempts: 2 }
        );
        const info = detail.jobPostingInfo;
        if (!info) return;
        job.jobDescription = info.jobDescription;
        job.startDate = info.startDate;
        job.detailLocation = info.location;
      } catch {
        // One posting failing to enrich must not fail the board. It simply
        // stays without a description and is rejected by the eligibility gate
        // below, which is the safe outcome.
      }
    });

    // Only postings we could actually read are worth ingesting: a posting with
    // no description cannot be honestly labelled fresher-eligible.
    const enriched = candidates.filter((j) => (j.jobDescription ?? '').length > 0);
    if (enriched.length === 0 && out.length > 0) {
      ctx.log.error('[HEALTH ALERT] workday returned postings but none could be enriched', { slug: ctx.slug });
    }

    ctx.log.debug('workday sweep complete', { slug: ctx.slug, jobs: enriched.length });
    return enriched;
  },

  normalize(raw, ctx: FetchContext): NormalizedJob {
    const title = (raw.title ?? '').trim();
    // Description comes from the detail pass; fetch() drops anything it could
    // not enrich, so this is populated for every posting that reaches here.
    const description = truncateWords(stripHtml(raw.jobDescription ?? ''), MAX_DESCRIPTION);
    // The detail location is precise ("Sanand - 303A - AT/SSD/MOD, India"); the
    // list one is often just "4 Locations", which no location parser can use.
    const location = normalizeLocation(raw.detailLocation ?? raw.locationsText, 'India');
    const category = normalizeCategory(null, title);

    return {
      sourceId: 'workday',
      // externalPath is stable per posting and is the tenant's own identifier.
      sourceJobId: raw.externalPath,
      groupSlug: ctx.slug,
      title,
      location,
      description,
      applyUrl: raw.externalPath ? applyUrlFor(raw.__config, raw.__slug, raw.externalPath) : '',
      category,
      type: classifyType(title),
      workMode: detectWorkMode(location, title),
      tags: extractTags({ title, description, category }),
      isIndia: isIndiaLocation(location),
      eligibility: extractEligibility(title, description),
      // `postedOn` from the list is relative text ("Posted 3 Days Ago"); the
      // detail pass supplies a real date, which freshness scoring needs.
      postedAt: raw.startDate ? new Date(raw.startDate) : undefined,
    };
  },

  validate: validateJob,

  async healthCheck() {
    // A known-live tenant, so the probe tests Workday itself rather than one
    // customer's career site being renamed.
    return probe('https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced');
  },
};
