/**
 * Greenhouse connector. Public job-board API, no authentication.
 *
 * Ported from `scripts/adapters/ingest-greenhouse.js`, split into the four
 * contract methods so `normalize` is pure and can be pinned by a fixture with
 * no network access.
 */

import type { Connector, FetchContext, NormalizedJob } from '@umbrix/core';
import { normalizeCategory, normalizeLocation, detectWorkMode, classifyType, extractTags, stripHtml, decodeEntities, truncateWords, isIndiaLocation } from '@umbrix/normalizer';
import { extractEligibility } from '@umbrix/eligibility';
import { fetchJson, probe } from './http';
import { validateJob } from './validation';

/** The subset of Greenhouse's payload this connector reads. */
export interface GreenhouseJob {
  id?: number;
  title?: string;
  content?: string;
  absolute_url?: string;
  updated_at?: string;
  location?: { name?: string };
  departments?: { name?: string }[];
}

const BOARD_URL = (slug: string) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;

/**
 * Description cap. Full JD text is deliberately not stored — CLAUDE.md limits
 * stored content, and the downstream consumers (eligibility, scam, tagging)
 * all read the opening section where requirements actually appear.
 */
const MAX_DESCRIPTION = 20_000;

export const greenhouseConnector: Connector<GreenhouseJob> = {
  id: 'greenhouse',
  tier: 3,

  async fetch(ctx: FetchContext): Promise<GreenhouseJob[]> {
    const data = await fetchJson<{ jobs?: GreenhouseJob[] }>(BOARD_URL(ctx.slug), { signal: ctx.signal });
    return data.jobs ?? [];
  },

  normalize(raw: GreenhouseJob, ctx: FetchContext): NormalizedJob {
    const title = (raw.title ?? '').trim();
    // Greenhouse delivers HTML-ESCAPED HTML: the body arrives as "&lt;p&gt;…".
    // stripHtml decodes only after stripping (so an encoded tag can never
    // become a live one), which means a single pass leaves "<p>" sitting in the
    // text. Decoding once first turns the escaped markup back into real markup
    // for stripHtml to remove. Safe here because nothing renders this field as
    // HTML — it is read for scoring and search, and stripped again before use.
    const description = truncateWords(stripHtml(decodeEntities(raw.content ?? '')), MAX_DESCRIPTION);
    const department = raw.departments?.[0]?.name;
    // "No Department" is Greenhouse's placeholder, not a real category.
    const rawCategory = department && department !== 'No Department' ? department : undefined;
    const location = normalizeLocation(raw.location?.name, 'Remote');
    const category = normalizeCategory(rawCategory, title);

    return {
      sourceId: 'greenhouse',
      sourceJobId: raw.id !== undefined ? String(raw.id) : undefined,
      groupSlug: ctx.slug,
      title,
      location,
      description,
      applyUrl: raw.absolute_url ?? '',
      category,
      type: classifyType(title),
      workMode: detectWorkMode(location, title),
      tags: extractTags({ title, description, category }),
      isIndia: isIndiaLocation(location),
      eligibility: extractEligibility(title, description),
      sourceUpdatedAt: raw.updated_at ? new Date(raw.updated_at) : undefined,
    };
  },

  validate: validateJob,

  async healthCheck() {
    // A known-live board, so the probe tests Greenhouse itself rather than one
    // customer's slug being retired.
    return probe(BOARD_URL('greenhouse'));
  },
};
