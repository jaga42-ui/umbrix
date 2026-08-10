/**
 * Adzuna connector. Documented JSON API, free credentials.
 *
 * Ported from `scripts/adapters/ingest-adzuna.js`. Adzuna is the one aggregator
 * being kept: it is an official API with the broadest all-field India coverage,
 * and it asks for nothing beyond a key — no IP allowlist, no referrer, so it
 * runs anywhere. It is also messy real-world data from many upstream boards,
 * which is exactly what the scam filter exists for.
 */

import type { Connector, FetchContext, NormalizedJob } from '@umbrix/core';
import { normalizeCategory, normalizeLocation, detectWorkMode, classifyType, extractTags, stripHtml, truncateWords, isIndiaLocation } from '@umbrix/normalizer';
import { extractEligibility } from '@umbrix/eligibility';
import { fetchJson, probe } from './http';
import { validateJob } from './validation';

export interface AdzunaJob {
  id?: string;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  category?: { label?: string; tag?: string };
}

/** 50 per page is Adzuna's maximum; each page is one call against the quota. */
const PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES = Number(process.env.ADZUNA_MAX_PAGES) || 8;
/** Freshness is a core promise — do not import postings older than this. */
const MAX_DAYS_OLD = 30;
/**
 * Field-agnostic fresher terms, deliberately without tech bias so the query
 * spans every stream. Adzuna treats `what_or` as OR, so any one term qualifies.
 */
const FRESHER_TERMS = 'fresher trainee graduate intern entry associate';
const MAX_DESCRIPTION = 20_000;

function credentials(): { appId: string; appKey: string } {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error('ADZUNA_APP_ID / ADZUNA_APP_KEY not set — free credentials at https://developer.adzuna.com');
  }
  return { appId, appKey };
}

export const adzunaConnector: Connector<AdzunaJob> = {
  id: 'adzuna',
  tier: 1,

  async fetch(ctx: FetchContext): Promise<AdzunaJob[]> {
    const { appId, appKey } = credentials();
    const maxPages = Number(ctx.config.pages) || DEFAULT_MAX_PAGES;
    const category = typeof ctx.config.category === 'string' ? ctx.config.category : undefined;

    const out: AdzunaJob[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= maxPages; page++) {
      if (ctx.signal?.aborted) break;

      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: String(PAGE_SIZE),
        what_or: FRESHER_TERMS,
        max_days_old: String(MAX_DAYS_OLD),
        'content-type': 'application/json',
      });
      if (category) params.set('category', category);

      const data = await fetchJson<{ results?: AdzunaJob[] }>(
        `https://api.adzuna.com/v1/api/jobs/in/search/${page}?${params}`,
        { signal: ctx.signal }
      );
      const results = data.results ?? [];
      if (results.length === 0) break;

      for (const job of results) {
        const key = job.redirect_url ?? job.id ?? '';
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(job);
      }

      // A short page means the result set is exhausted; another call would
      // spend quota to receive nothing.
      if (results.length < PAGE_SIZE) break;
    }

    ctx.log.debug('adzuna page sweep complete', { slug: ctx.slug, jobs: out.length });
    return out;
  },

  normalize(raw: AdzunaJob, ctx: FetchContext): NormalizedJob {
    const title = (raw.title ?? '').trim();
    const description = truncateWords(stripHtml(raw.description ?? ''), MAX_DESCRIPTION);
    const location = normalizeLocation(raw.location?.display_name, 'India');
    const category = normalizeCategory(raw.category?.label ?? raw.category?.tag, title);

    return {
      sourceId: 'adzuna',
      sourceJobId: raw.id,
      groupSlug: ctx.slug,
      title,
      // The aggregator spans many employers, so each posting carries its own
      // real company name while grouping under one shard for reconciliation.
      companyName: raw.company?.display_name?.trim() || undefined,
      location,
      description,
      applyUrl: raw.redirect_url ?? '',
      category,
      type: classifyType(title),
      workMode: detectWorkMode(location, title),
      tags: extractTags({ title, description, category }),
      isIndia: isIndiaLocation(location),
      eligibility: extractEligibility(title, description),
      postedAt: raw.created ? new Date(raw.created) : undefined,
    };
  },

  validate: validateJob,

  async healthCheck() {
    try {
      const { appId, appKey } = credentials();
      return await probe(
        `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=1`
      );
    } catch (error) {
      // Missing credentials is a real health failure, reported rather than thrown.
      return { healthy: false, detail: error instanceof Error ? error.message : String(error) };
    }
  },
};
