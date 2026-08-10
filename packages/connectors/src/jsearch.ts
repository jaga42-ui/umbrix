/**
 * JSearch connector (RapidAPI) — Google for Jobs aggregation.
 *
 * Overlaps with the SerpAPI connector in purpose: both return full job
 * descriptions, which is what requirement extraction and résumé matching need
 * and what the rest of the collection lacks. JSearch is kept alongside it for
 * two things it does better, both measured against the live API:
 *
 *  - a real ISO publication date (`job_posted_at_datetime_utc`), where SerpAPI
 *    reports only relative text like "3 days ago". Freshness scoring reads
 *    `postedAt`, so this is the difference between a graded listing and one
 *    that can only ever be "verified today".
 *  - structured location and remote fields, rather than a single display string
 *    that has to be parsed back apart.
 *
 * Measured: 10 results per request, descriptions median 947 characters and up
 * to 6,366.
 *
 * The quota binds hard — 200 requests a month on the free plan — so this is a
 * small supplement, never a bulk source, and the per-run budget below is a stop
 * rather than a guideline.
 */

import type { Connector, FetchContext, NormalizedJob } from '@umbrix/core';
import { normalizeCategory, normalizeLocation, classifyType, extractTags, stripHtml, truncateWords, isIndiaLocation } from '@umbrix/normalizer';
import { extractEligibility } from '@umbrix/eligibility';
import { fetchJson, probe } from './http.js';
import { validateJob } from './validation.js';

export interface JSearchJob {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_description?: string;
  job_apply_link?: string;
  job_employment_type?: string;
  job_is_remote?: boolean;
  job_location?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  /** ISO 8601. The reason this connector exists alongside SerpAPI. */
  job_posted_at_datetime_utc?: string;
}

interface JSearchResponse {
  status?: string;
  /** v5 nests the array; earlier versions returned it flat. */
  data?: { jobs?: JSearchJob[] } | JSearchJob[];
  error?: unknown;
}

const ENDPOINT = 'https://jsearch.p.rapidapi.com/search-v2';
const HOST = 'jsearch.p.rapidapi.com';

/** Results per request. One request is one billed unit. */
const RESULTS_PER_REQUEST = 10;
const DEFAULT_MAX_PAGES = Number(process.env.JSEARCH_MAX_PAGES) || 1;

/**
 * Hard ceiling on billed requests per run.
 *
 * The free plan allows 200 a month. A daily run across several shards would
 * exhaust that in under a fortnight, so this stops a misconfigured registry
 * from silently spending the allowance and logs loudly when it bites.
 */
const JSEARCH_MAX_REQUESTS = Number(process.env.JSEARCH_MAX_REQUESTS) || 4;
let requestsUsed = 0;

const MAX_DESCRIPTION = 20_000;

function credentials(): string {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error('RAPIDAPI_KEY not set — subscribe to JSearch at https://rapidapi.com');
  return key;
}

/** v5 nests jobs under `data.jobs`; tolerate both shapes rather than assume. */
function readJobs(data: JSearchResponse['data']): JSearchJob[] {
  if (Array.isArray(data)) return data;
  return data?.jobs ?? [];
}

export const jsearchConnector: Connector<JSearchJob> = {
  id: 'jsearch',
  tier: 1,

  async fetch(ctx: FetchContext): Promise<JSearchJob[]> {
    const key = credentials();
    const query = typeof ctx.config.query === 'string' ? ctx.config.query : 'fresher jobs in India';
    const maxPages = Number(ctx.config.pages) || DEFAULT_MAX_PAGES;

    const out: JSearchJob[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= maxPages; page++) {
      if (ctx.signal?.aborted) break;
      if (requestsUsed >= JSEARCH_MAX_REQUESTS) {
        ctx.log.error('[HEALTH ALERT] jsearch request budget exhausted for this run', {
          budget: JSEARCH_MAX_REQUESTS,
          slug: ctx.slug,
        });
        break;
      }

      const params = new URLSearchParams({
        query,
        page: String(page),
        num_pages: '1',
        country: typeof ctx.config.country === 'string' ? ctx.config.country : 'in',
        // Stale postings are the thing this product exists to filter out, so
        // never import beyond a month old.
        date_posted: 'month',
      });

      requestsUsed++;
      const data = await fetchJson<JSearchResponse>(`${ENDPOINT}?${params}`, {
        signal: ctx.signal,
        timeoutMs: 45_000,
        headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': HOST },
      });

      // A non-OK status arrives with HTTP 200, so the body is the real check.
      if (data.status && data.status !== 'OK') {
        ctx.log.error('[HEALTH ALERT] jsearch returned a non-OK status', {
          slug: ctx.slug,
          detail: String(data.status),
        });
        break;
      }

      const jobs = readJobs(data.data);
      if (jobs.length === 0) break;

      for (const job of jobs) {
        const id = job.job_id ?? job.job_apply_link ?? '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(job);
      }

      if (jobs.length < RESULTS_PER_REQUEST) break;
    }

    ctx.log.debug('jsearch sweep complete', { slug: ctx.slug, jobs: out.length, requestsUsed });
    return out;
  },

  normalize(raw: JSearchJob, ctx: FetchContext): NormalizedJob {
    const title = (raw.job_title ?? '').trim();
    // Full description kept deliberately — it is why this source is here.
    const description = truncateWords(stripHtml(raw.job_description ?? ''), MAX_DESCRIPTION);

    // Prefer the structured parts over the display string, which is often just
    // the country and loses the city the SEO pages match on. The country field
    // is an ISO code, so expand it — "IN" is not a location a candidate should
    // read, and the city pages cannot match it either.
    const country = raw.job_country?.toUpperCase() === 'IN' ? 'India' : raw.job_country;
    const composed = [raw.job_city, raw.job_state, country].filter(Boolean).join(', ');
    const location = normalizeLocation(composed || raw.job_location, 'India');
    const category = normalizeCategory(null, title);

    const posted = raw.job_posted_at_datetime_utc ? new Date(raw.job_posted_at_datetime_utc) : undefined;

    return {
      sourceId: 'jsearch',
      sourceJobId: raw.job_id,
      groupSlug: ctx.slug,
      title,
      companyName: raw.employer_name?.trim() || undefined,
      location,
      description,
      applyUrl: raw.job_apply_link ?? '',
      category,
      type: /\bintern/i.test(raw.job_employment_type ?? '') ? 'internship' : classifyType(title),
      // The source states this outright, so it beats guessing from a string.
      workMode: raw.job_is_remote ? 'remote' : undefined,
      tags: extractTags({ title, description, category }),
      // `job_country` is an ISO code ("IN"), which the India regex would miss,
      // so check it directly as well as the composed location.
      isIndia: raw.job_country?.toUpperCase() === 'IN' || isIndiaLocation(location),
      eligibility: extractEligibility(title, description),
      // Guard against an unparseable date rather than storing Invalid Date.
      postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : undefined,
    };
  },

  validate: validateJob,

  async healthCheck() {
    try {
      const key = credentials();
      // A minimal query, which does spend one request — the API has no free
      // status endpoint, and a health check that lies is worse than one that
      // costs. The key must be sent, or this probes authentication rather than
      // availability and reports every healthy day as an outage.
      return await probe(`${ENDPOINT}?query=test&num_pages=1&country=in`, 20_000, {
        'x-rapidapi-key': key,
        'x-rapidapi-host': HOST,
      });
    } catch (error) {
      return { healthy: false, detail: error instanceof Error ? error.message : String(error) };
    }
  },
};
