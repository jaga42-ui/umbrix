/**
 * Turn a posting's free-text `location` into the structured pieces
 * `JobPosting` schema needs.
 *
 * Locations arrive as whatever the source wrote — "Bengaluru, Karnataka",
 * "Bangalore", "Remote", "Pan India", "Hyderabad, Telangana, India". Google
 * wants a `PostalAddress` with a locality, so this parses rather than guesses,
 * and reports honestly when there is no city to give.
 *
 * Pure module — no DB, no clock — so it is pinned by fixtures.
 */
import { CITIES, cityBySlug } from "@/lib/seoCities";

export interface ParsedJobLocation {
  /** The role is remote / work-from-home. */
  isRemote: boolean;
  /** City name as written, when the string names one. */
  locality?: string;
  /** State / union territory, when the string carries one. */
  region?: string;
  /** Matching `seoCities` slug, used for breadcrumbs and "similar roles". */
  citySlug?: string;
  /** The original string, kept for display. */
  raw: string;
}

const REMOTE_RE = /\b(remote|work from home|wfh|anywhere)\b/i;

/**
 * Country-level strings that name no city. Listing these as a locality would
 * put "Pan India" in a PostalAddress, which is not an address.
 */
const COUNTRY_WIDE_RE = /^\s*(pan[\s-]?india|india|all over india|multiple locations|various locations)\s*$/i;

/** Trailing country tokens to strip before splitting into city / region. */
const COUNTRY_TAIL_RE = /,\s*(india|in)\s*$/i;

/**
 * Work-arrangement prefixes that sources glue onto the city — "Hybrid in
 * Bangalore", "Remote - Pune", "On-site: Chennai". Left in place these become
 * the `addressLocality`, and "Hybrid in Bangalore" is not an address.
 */
const ARRANGEMENT_PREFIX_RE =
  /^\s*(?:hybrid|remote|on-?site|in-?office|work from home|wfh)\s*(?:in|at|from|[-–—:])?\s*/i;

/** Precompiled once — this runs per job card on listing pages. */
const CITY_MATCHERS = CITIES.map((c) => ({ slug: c.slug, re: new RegExp(c.pattern, "i") }));

/** Find the `seoCities` slug a free-text location belongs to, if any. */
export function citySlugFor(raw: string): string | undefined {
  const text = String(raw ?? "");
  return CITY_MATCHERS.find((c) => c.re.test(text))?.slug;
}

/** Parse a free-text location into structured address parts. */
export function parseJobLocation(raw: string): ParsedJobLocation {
  const text = String(raw ?? "").trim();
  const isRemote = REMOTE_RE.test(text);

  // A remote role may still name a base city ("Remote, Bengaluru"), so keep
  // parsing rather than returning early.
  const withoutCountry = text.replace(COUNTRY_TAIL_RE, "").trim();

  if (!withoutCountry || COUNTRY_WIDE_RE.test(withoutCountry)) {
    return { isRemote, raw: text, citySlug: citySlugFor(text) };
  }

  const parts = withoutCountry
    .split(",")
    .map((p) => p.trim())
    // Strip "Hybrid in " / "Remote - " style prefixes from each segment.
    .map((p) => p.replace(ARRANGEMENT_PREFIX_RE, "").trim())
    .filter(Boolean)
    // Drop a segment that was *only* a work arrangement.
    .filter((p) => !/^(remote|work from home|wfh|hybrid|on-?site|in-?office)$/i.test(p));

  const citySlug = citySlugFor(text);

  // Prefer the canonical city name when the location matches one we know.
  // Sources spell the same city several ways ("Bangalore", "Bengaluru",
  // "Bangalore Urban"); emitting one spelling keeps the structured data
  // consistent across every posting in that city.
  const canonical = citySlug ? cityBySlug(citySlug)?.label : undefined;
  const locality = canonical ?? parts[0] ?? undefined;
  const region = parts.length > 1 ? parts[parts.length - 1] : undefined;

  return {
    isRemote,
    locality,
    // Guard against "Bengaluru, Bengaluru" style repeats from sloppy sources.
    region: region && region.toLowerCase() !== locality?.toLowerCase() ? region : undefined,
    citySlug,
    raw: text,
  };
}
