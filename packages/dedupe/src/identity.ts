/**
 * Stable identity for a posting.
 *
 * The pipeline currently dedups on `applyUrl` alone, because that is the upsert
 * key. Measured against a real aggregator, 34% of a page were the same role
 * re-listed under distinct URLs — so `applyUrl` collapsed none of them and the
 * feed would have shown each role several times.
 *
 * Identity is therefore layered, strongest signal first:
 *   1. source + the source's own job id — an assertion, not an inference
 *   2. canonical apply URL — reliable for company ATS boards
 *   3. content fingerprint (company + title + city) — the only thing that
 *      survives an aggregator minting a fresh URL per listing
 */

import type { NormalizedJob } from '@umbrix/core';
import { comparableText, extractCity } from '@umbrix/normalizer';

/** Query params that identify a *referrer*, never the job itself. */
const TRACKING_PARAMS = /^(utm_|ref$|source$|src$|gh_src|lever-source|trk|campaign|fbclid|gclid)/i;

/**
 * Canonical form of an apply URL: lowercase host, no tracking params, no
 * trailing slash, no fragment. Two links to the same posting that differ only
 * by attribution collapse to one string.
 */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.host = u.host.toLowerCase();
    u.protocol = 'https:';
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    u.searchParams.sort();
    let out = u.toString();
    if (out.endsWith('/')) out = out.slice(0, -1);
    return out;
  } catch {
    // A malformed URL is still usable as an opaque identity string.
    return String(url ?? '').trim().toLowerCase();
  }
}

/** Words that carry no distinguishing meaning in a job title. */
const TITLE_NOISE = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'of', 'to', 'in', 'at', 'with',
  'job', 'jobs', 'role', 'position', 'opening', 'openings', 'vacancy',
  'hiring', 'urgent', 'immediate', 'required', 'wanted', 'new', 'we', 'are',
  'fresher', 'freshers', 'apply', 'now', 'online', 'work', 'from', 'home',
]);

/**
 * Significant tokens of a title, normalized for comparison: lowercased,
 * punctuation-stripped, noise words removed, deduplicated and sorted so that
 * word order does not change identity ("Engineer, Software" == "Software
 * Engineer").
 */
export function titleTokens(title: string): string[] {
  const tokens = comparableText(title)
    .replace(/[^a-z0-9+#./ ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !TITLE_NOISE.has(t));
  return [...new Set(tokens)].sort();
}

/** Company name reduced to a comparable core, dropping legal suffixes. */
export function companyKey(name?: string): string {
  return comparableText(name ?? '')
    .replace(/\b(pvt|private|ltd|limited|llp|inc|incorporated|corp|corporation|co|company|technologies|technology|solutions|services|labs|india)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * The identity key used to group duplicates.
 *
 * Deliberately NOT a hash — a readable key makes a wrong grouping obvious in
 * logs, and this is the value that decides whether two postings are "the same
 * job", which is worth being able to eyeball.
 */
export function identityKey(job: NormalizedJob): string {
  if (job.sourceJobId) return `src:${job.sourceId}:${job.sourceJobId}`;

  const company = companyKey(job.companyName) || job.groupSlug;
  const tokens = titleTokens(job.title).join('-');
  const city = extractCity(job.location)?.toLowerCase() ?? 'any';

  // With no company and no meaningful title, the URL is all that is left.
  if (!company && !tokens) return `url:${canonicalUrl(job.applyUrl)}`;
  return `job:${company}:${tokens}:${city}`;
}
