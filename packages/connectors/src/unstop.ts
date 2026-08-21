/**
 * Unstop connector — India-native jobs and internships for students and freshers.
 *
 * ## Why this source exists
 *
 * The collection's problem is not volume, it is *usable* volume. Measured
 * against production: Adzuna supplies 70% of active India postings and yields
 * zero indexable pages, because its API returns a description snippet
 * hard-truncated at exactly 500 characters and offers no way to get more. A
 * 500-character excerpt rarely contains a requirements list, so it defeats both
 * the eligibility regex and the résumé matcher, and it is too thin to publish.
 *
 * Unstop is the opposite trade, measured over a 90-posting sample of its public
 * API:
 *
 *   description text   median 1,433 chars (min 569, max 6,870)
 *   clears the 600-char indexing bar   99%
 *   fresher-eligible                   86%
 *   BOTH -> indexable                  84%
 *   eligibility regex derives minExperience   80%
 *
 * That 84% yield compares to 0% for Adzuna, 12% for company ATS boards and 29%
 * for Workday. Only SerpAPI and JSearch score higher, and both are capped at a
 * few hundred requests a month; Unstop advertises 10,000 open jobs and costs
 * nothing.
 *
 * The 80% eligibility figure is the second-order win: the regex finally has
 * prose to read, so postings arrive with a real `minExperience` instead of the
 * unstated value that used to sail through the fresher filter.
 *
 * ## Permission
 *
 * `unstop.com/robots.txt` explicitly allows the paths used here:
 *
 *   Allow: /api/public/*
 *   Allow: /internship/
 *   Allow: /job/
 *
 * This reads a public, unauthenticated JSON API — no login, no cookies, no
 * paywall. Requests carry the UmbrixBot user agent (via `fetchJson`) and are
 * spaced by REQUEST_SPACING_MS so a paginating run stays polite.
 *
 * Internshala was evaluated first and rejected: its robots.txt disallows
 * `/internship/details/`, `/job/details/`, `/internship/search/` and
 * `/job/search/` — precisely the pages a connector would need.
 */

import type { Connector, FetchContext, NormalizedJob } from '@umbrix/core';
import {
  normalizeCategory,
  normalizeLocation,
  classifyType,
  extractTags,
  stripHtml,
  truncateWords,
  isIndiaLocation,
} from '@umbrix/normalizer';
import { extractEligibility } from '@umbrix/eligibility';
import { fetchJson, probe } from './http.js';
import { validateJob } from './validation.js';

/** One address row. A posting can list several cities. */
export interface UnstopLocation {
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

/** Structured job facts. Present on the payload but sparsely populated. */
export interface UnstopJobDetail {
  min_experience?: number | string | null;
  max_experience?: number | string | null;
  type?: string | null;
}

export interface UnstopOpportunity {
  id?: number;
  title?: string;
  /** Full description as HTML. The reason this connector exists. */
  details?: string;
  /** "jobs" | "internships". */
  type?: string;
  subtype?: string;
  /** Absolute canonical URL; `public_url` is the relative form. */
  seo_url?: string;
  public_url?: string;
  organisation?: { name?: string | null } | null;
  locations?: UnstopLocation[] | null;
  required_skills?: { skill_name?: string | null; skill?: string | null }[] | null;
  /** Application deadline. Every sampled posting carried one. */
  end_date?: string | null;
  updated_at?: string | null;
  jobDetail?: UnstopJobDetail | null;
}

/** Laravel paginator envelope. */
interface UnstopResponse {
  data?: {
    data?: UnstopOpportunity[];
    current_page?: number;
    last_page?: number;
    total?: number;
  };
}

const ENDPOINT = 'https://unstop.com/api/public/opportunity/search-result';
const BASE_URL = 'https://unstop.com';

const DEFAULT_PER_PAGE = 30;
const DEFAULT_MAX_PAGES = Number(process.env.UNSTOP_MAX_PAGES) || 8;

/**
 * Minimum gap between requests to unstop.com.
 *
 * CLAUDE.md sets a floor of 2 seconds per domain, and this connector is the
 * only thing in the pipeline that paginates against this host, so honouring it
 * here honours it globally.
 */
const REQUEST_SPACING_MS = 2_000;

const MAX_DESCRIPTION = 20_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Absolute apply URL, tolerating the relative `public_url` form. */
export function applyUrlFor(raw: UnstopOpportunity): string {
  const seo = raw.seo_url?.trim();
  if (seo) return seo.startsWith('http') ? seo : `${BASE_URL}/${seo.replace(/^\/+/, '')}`;
  const pub = raw.public_url?.trim();
  return pub ? `${BASE_URL}/${pub.replace(/^\/+/, '')}` : '';
}

/**
 * Collapse the address rows into one display string.
 *
 * A posting may be open in several cities. Joining them keeps every city
 * matchable by the city pages' regexes, which scan the free-text location —
 * taking only the first would silently hide the role from the others.
 */
export function locationFor(raw: UnstopOpportunity): string {
  const rows = raw.locations ?? [];
  const parts = rows
    .map((l) => [l.city, l.state].filter(Boolean).join(', '))
    .filter((s) => s.length > 0);

  const unique = [...new Set(parts)];
  if (unique.length === 0) {
    // Remote-only and campus postings often carry no address at all.
    return normalizeLocation(null, 'India');
  }
  return normalizeLocation(unique.join(' / '), 'India');
}

/** Whether any address row is in India. Falls back to the composed string. */
export function isIndiaFor(raw: UnstopOpportunity, location: string): boolean {
  const rows = raw.locations ?? [];
  if (rows.some((l) => (l.country ?? '').trim().toLowerCase() === 'india')) return true;
  return isIndiaLocation(location);
}

/** Parse an experience value the API sometimes sends as a string. */
function numericExperience(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export const unstopConnector: Connector<UnstopOpportunity> = {
  id: 'unstop',
  // Tier 2 is where CLAUDE.md's cron schedule already places Unstop, and it
  // keeps this off the 00:00 slot the tier-1 aggregator APIs share.
  tier: 2,

  async fetch(ctx: FetchContext): Promise<UnstopOpportunity[]> {
    // "jobs" or "internships" — one registry entry per stream, so a failure in
    // one does not take the other down and each reconciles independently.
    const opportunity = typeof ctx.config.opportunity === 'string' ? ctx.config.opportunity : 'jobs';
    const maxPages = Number(ctx.config.pages) || DEFAULT_MAX_PAGES;
    const perPage = Number(ctx.config.perPage) || DEFAULT_PER_PAGE;

    const out: UnstopOpportunity[] = [];
    const seen = new Set<number>();

    for (let page = 1; page <= maxPages; page++) {
      if (ctx.signal?.aborted) break;
      // Space requests to the same host. Skipped before the first page so a
      // single-page run pays nothing.
      if (page > 1) await sleep(REQUEST_SPACING_MS);

      const params = new URLSearchParams({
        opportunity,
        page: String(page),
        per_page: String(perPage),
      });

      const body = await fetchJson<UnstopResponse>(`${ENDPOINT}?${params}`, {
        signal: ctx.signal,
        timeoutMs: 45_000,
        headers: { Accept: 'application/json' },
      });

      const items = body.data?.data ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        // The paginator can repeat an entry when the underlying list shifts
        // between requests; id is stable, so dedupe on it.
        if (typeof item.id === 'number') {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
        }
        out.push(item);
      }

      const lastPage = body.data?.last_page;
      if (typeof lastPage === 'number' && page >= lastPage) break;
      if (items.length < perPage) break;
    }

    if (out.length === 0) {
      // CLAUDE.md: zero results means the connector is broken, not that the
      // source is empty. Never let this pass as a quiet success.
      ctx.log.error('[HEALTH ALERT] unstop returned 0 postings', {
        slug: ctx.slug,
        opportunity,
      });
    }

    ctx.log.debug('unstop sweep complete', { slug: ctx.slug, opportunity, jobs: out.length });
    return out;
  },

  normalize(raw: UnstopOpportunity, ctx: FetchContext): NormalizedJob {
    const title = (raw.title ?? '').trim();
    // Kept in full — a real description is the entire reason for this source.
    const description = truncateWords(stripHtml(raw.details ?? ''), MAX_DESCRIPTION);
    const location = locationFor(raw);
    const category = normalizeCategory(null, title);

    // "internships" is the stream, `subtype` the per-posting kind; either is a
    // stronger signal than guessing from the title.
    const isInternship =
      raw.type === 'internships' ||
      raw.subtype === 'internships' ||
      /\bintern/i.test(raw.jobDetail?.type ?? '');

    const skills = (raw.required_skills ?? [])
      .map((s) => (s.skill_name ?? s.skill ?? '').trim())
      .filter((s) => s.length > 0);

    // The regex pass reads title + description; where the API states experience
    // outright that is `source`-grade evidence and must win, per the
    // source > llm > regex precedence in CLAUDE.md.
    const eligibility = extractEligibility(title, description);
    const statedMin = numericExperience(raw.jobDetail?.min_experience);
    if (statedMin !== undefined) {
      eligibility.minExperience = statedMin;
      eligibility.source = 'source';
    } else if (isInternship) {
      // An internship is fresher-eligible by definition, and the source told us
      // which stream it came from — also an assertion, not an inference.
      eligibility.minExperience = 0;
      eligibility.source = 'source';
    }

    const updated = raw.updated_at ? new Date(raw.updated_at) : undefined;

    return {
      sourceId: 'unstop',
      sourceJobId: raw.id !== undefined ? String(raw.id) : undefined,
      groupSlug: ctx.slug,
      title,
      companyName: raw.organisation?.name?.trim() || undefined,
      location,
      description,
      applyUrl: applyUrlFor(raw),
      category,
      type: isInternship ? 'internship' : classifyType(title),
      tags: [...new Set([...skills, ...extractTags({ title, description, category })])].slice(0, 30),
      isIndia: isIndiaFor(raw, location),
      eligibility,
      // Unstop reports no publication date, only a last-modified stamp. Feeding
      // that to `postedAt` would date every posting to its last edit and make
      // stale roles look fresh, so it is reported for what it is and freshness
      // scoring can decide what to do with it.
      sourceUpdatedAt: updated && !Number.isNaN(updated.getTime()) ? updated : undefined,
    };
  },

  validate: validateJob,

  async healthCheck() {
    // One cheap page against the same public endpoint the run uses. No key is
    // involved, so this probes availability rather than authentication.
    return probe(`${ENDPOINT}?opportunity=jobs&page=1&per_page=1`, 20_000, {
      Accept: 'application/json',
    });
  },
};
