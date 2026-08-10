/**
 * SerpAPI connector — Google Jobs engine.
 *
 * Google Jobs aggregates postings from company career pages and boards that
 * Umbrix does not reach individually, and — the reason this source earns a slot
 * — it returns the *full* description. Measured against the live account:
 * median 714 characters and up to 3,651, where the descriptions already in the
 * collection have a median of 500. Requirement extraction and résumé alignment
 * need that text; a summary almost never contains a requirements list.
 *
 * The quota is the binding constraint. The free plan allows 250 searches per
 * month at ten results each, so this can never be a bulk source: a daily run
 * across many queries would exhaust a month in days. It is deliberately
 * configured as a small, high-quality supplement, and the request budget below
 * is a hard stop rather than a guideline.
 */

import type { Connector, FetchContext, NormalizedJob } from '@umbrix/core';
import { normalizeCategory, normalizeLocation, detectWorkMode, classifyType, extractTags, stripHtml, truncateWords, isIndiaLocation } from '@umbrix/normalizer';
import { extractEligibility } from '@umbrix/eligibility';
import { fetchJson, probe } from './http.js';
import { validateJob } from './validation.js';

export interface SerpApiJob {
  job_id?: string;
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  /** The board Google found it on — "via LinkedIn", "via Naukri". */
  via?: string;
  share_link?: string;
  apply_options?: { title?: string; link?: string }[];
  detected_extensions?: { posted_at?: string; schedule_type?: string };
}

interface SerpApiResponse {
  jobs_results?: SerpApiJob[];
  serpapi_pagination?: { next_page_token?: string };
  error?: string;
}

/** Google Jobs returns ten results per search; one search is one billed unit. */
const RESULTS_PER_SEARCH = 10;
/** Pages per registry entry. Each is a separate billed search. */
const DEFAULT_MAX_PAGES = Number(process.env.SERPAPI_MAX_PAGES) || 2;

/**
 * Hard ceiling on billed searches per run.
 *
 * The free plan is 250 per month. At the default two pages per shard, a
 * six-shard daily run would spend 360 a month — more than the whole allowance.
 * This stops a misconfigured registry from silently burning the quota, and logs
 * loudly when it bites so the cause is visible rather than mysterious.
 */
const SERPAPI_MAX_SEARCHES = Number(process.env.SERPAPI_MAX_SEARCHES) || 6;
let searchesUsed = 0;

/** Full descriptions are the point of this source; keep them. */
const MAX_DESCRIPTION = 20_000;

function credentials(): string {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error('SERPAPI_KEY not set — get one at https://serpapi.com');
  return key;
}

export const serpapiConnector: Connector<SerpApiJob> = {
  id: 'serpapi',
  tier: 1,

  async fetch(ctx: FetchContext): Promise<SerpApiJob[]> {
    const key = credentials();
    const query = typeof ctx.config.query === 'string' ? ctx.config.query : 'fresher jobs';
    const location = typeof ctx.config.location === 'string' ? ctx.config.location : 'India';
    const maxPages = Number(ctx.config.pages) || DEFAULT_MAX_PAGES;

    const out: SerpApiJob[] = [];
    const seen = new Set<string>();
    let nextPageToken: string | undefined;

    for (let page = 0; page < maxPages; page++) {
      if (ctx.signal?.aborted) break;
      if (searchesUsed >= SERPAPI_MAX_SEARCHES) {
        ctx.log.error('[HEALTH ALERT] serpapi search budget exhausted for this run', {
          budget: SERPAPI_MAX_SEARCHES,
          slug: ctx.slug,
        });
        break;
      }

      const params = new URLSearchParams({
        engine: 'google_jobs',
        q: query,
        location,
        hl: 'en',
        api_key: key,
      });
      if (nextPageToken) params.set('next_page_token', nextPageToken);

      searchesUsed++;
      const data = await fetchJson<SerpApiResponse>(`https://serpapi.com/search.json?${params}`, {
        signal: ctx.signal,
        timeoutMs: 40_000,
      });

      // SerpAPI reports quota and query problems in the body with HTTP 200, so
      // a 200 alone is not success.
      if (data.error) {
        ctx.log.error('[HEALTH ALERT] serpapi returned an error', { slug: ctx.slug, detail: data.error });
        break;
      }

      const results = data.jobs_results ?? [];
      if (results.length === 0) break;

      for (const job of results) {
        const id = job.job_id ?? job.share_link ?? job.title ?? '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(job);
      }

      nextPageToken = data.serpapi_pagination?.next_page_token;
      if (!nextPageToken || results.length < RESULTS_PER_SEARCH) break;
    }

    ctx.log.debug('serpapi sweep complete', { slug: ctx.slug, jobs: out.length, searchesUsed });
    return out;
  },

  normalize(raw: SerpApiJob, ctx: FetchContext): NormalizedJob {
    const title = (raw.title ?? '').trim();
    // The full description is kept deliberately — requirement extraction and
    // résumé alignment read it, and a summary contains no requirements.
    const description = truncateWords(stripHtml(raw.description ?? ''), MAX_DESCRIPTION);
    const location = normalizeLocation(raw.location, 'India');
    const category = normalizeCategory(null, title);

    // Prefer a direct employer link over Google's share link, so Apply lands on
    // the real posting rather than a search result.
    const applyUrl = raw.apply_options?.find((o) => o.link)?.link ?? raw.share_link ?? '';

    return {
      sourceId: 'serpapi',
      sourceJobId: raw.job_id,
      groupSlug: ctx.slug,
      title,
      companyName: raw.company_name?.trim() || undefined,
      location,
      description,
      applyUrl,
      category,
      type: /\bintern/i.test(raw.detected_extensions?.schedule_type ?? '') ? 'internship' : classifyType(title),
      workMode: detectWorkMode(location, raw.detected_extensions?.schedule_type, title),
      tags: extractTags({ title, description, category }),
      isIndia: isIndiaLocation(location),
      eligibility: extractEligibility(title, description),
      // `posted_at` is relative text ("3 days ago"), not a date, so it is not
      // converted into one — a wrong date is worse than an absent one.
      postedAt: undefined,
    };
  },

  validate: validateJob,

  async healthCheck() {
    try {
      const key = credentials();
      // The account endpoint reports quota without spending a search.
      return await probe(`https://serpapi.com/account?api_key=${key}`);
    } catch (error) {
      return { healthy: false, detail: error instanceof Error ? error.message : String(error) };
    }
  },
};
