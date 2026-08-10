/**
 * Lever connector. Public postings API, no authentication.
 *
 * Ported from `scripts/adapters/ingest-lever.js`. Lever is noted there as much
 * higher latency than Greenhouse (2–10s per request) and prone to dropping
 * connections when several requests land inside the same concurrency window,
 * which is why the shared client's jittered backoff matters most here.
 */

import type { Connector, FetchContext, NormalizedJob } from '@umbrix/core';
import { normalizeCategory, normalizeLocation, detectWorkMode, classifyType, extractTags, stripHtml, truncateWords, isIndiaLocation } from '@umbrix/normalizer';
import { extractEligibility } from '@umbrix/eligibility';
import { fetchJson, probe } from './http';
import { validateJob } from './validation';

export interface LeverJob {
  id?: string;
  text?: string;
  description?: string;
  descriptionPlain?: string;
  hostedUrl?: string;
  createdAt?: number;
  categories?: { location?: string; team?: string; commitment?: string };
}

const BOARD_URL = (slug: string) => `https://api.lever.co/v0/postings/${slug}?mode=json`;
const MAX_DESCRIPTION = 20_000;

export const leverConnector: Connector<LeverJob> = {
  id: 'lever',
  tier: 3,

  async fetch(ctx: FetchContext): Promise<LeverJob[]> {
    const jobs = await fetchJson<LeverJob[]>(BOARD_URL(ctx.slug), {
      signal: ctx.signal,
      // Lever's own latency, not ours — a 20s cap times out healthy boards.
      timeoutMs: 30_000,
    });
    return Array.isArray(jobs) ? jobs : [];
  },

  normalize(raw: LeverJob, ctx: FetchContext): NormalizedJob {
    const title = (raw.text ?? '').trim();
    const description = truncateWords(
      stripHtml(raw.description ?? raw.descriptionPlain ?? ''),
      MAX_DESCRIPTION
    );
    const location = normalizeLocation(raw.categories?.location, 'Remote');
    const category = normalizeCategory(raw.categories?.team, title);

    return {
      sourceId: 'lever',
      sourceJobId: raw.id,
      groupSlug: ctx.slug,
      title,
      location,
      description,
      applyUrl: raw.hostedUrl ?? '',
      category,
      // `commitment` is Lever's own field for Intern / Full-time, so it is a
      // stronger type signal than guessing from the title.
      type: /\bintern/i.test(raw.categories?.commitment ?? '') ? 'internship' : classifyType(title),
      workMode: detectWorkMode(location, raw.categories?.commitment, title),
      tags: extractTags({ title, description, category }),
      isIndia: isIndiaLocation(location),
      eligibility: extractEligibility(title, description),
      postedAt: raw.createdAt ? new Date(raw.createdAt) : undefined,
    };
  },

  validate: validateJob,

  async healthCheck() {
    return probe(BOARD_URL('leverdemo'), 15_000);
  },
};
