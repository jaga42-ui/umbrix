/**
 * Canonical URLs for individual job postings.
 *
 * The route is `/job/<title-slug>-<mongoId>` rather than nesting under
 * `/jobs/<field>/<city>/`, for three reasons:
 *
 *  1. Not every posting has a city we build pages for. Remote, "Pan India", and
 *     the ~40 Indian cities outside `seoCities` would have no valid path, and
 *     inventing a bucket for them puts junk in the URL.
 *  2. A job legitimately belongs to one field but can match several city
 *     patterns ("Bengaluru / Hyderabad"). A nested route would generate more
 *     than one URL for the same posting — duplicate content on the exact pages
 *     Google is strictest about.
 *  3. `/jobs/<field>` already occupies the single-segment slot under `/jobs`,
 *     so a flat job route there would need a catch-all that disambiguates
 *     fields from job slugs at runtime.
 *
 * Breadcrumbs still express Home → Field → City → Job; a breadcrumb trail does
 * not have to mirror the URL path, and Google documents that explicitly.
 *
 * The Mongo `_id` is the lookup key and the slug is decoration, so retitling a
 * posting never breaks an indexed URL.
 */

/** Mongo ObjectId hex, which is what every posting's `_id` serializes to. */
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

/** Keep URLs readable; the id at the end is what actually resolves the page. */
const MAX_SLUG_CHARS = 70;

/**
 * Convert a job title to a URL-safe, kebab-case slug. Non-ASCII is dropped
 * rather than transliterated — it's cosmetic, and the id carries the meaning.
 */
export function titleSlug(title: string): string {
  const slug = String(title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= MAX_SLUG_CHARS) return slug;
  // Trim at a word boundary so the slug never ends mid-word.
  return slug.slice(0, MAX_SLUG_CHARS).replace(/-[^-]*$/, "");
}

/**
 * The canonical path for a posting. Falls back to the bare id when a title
 * slugifies to nothing (e.g. a title that is entirely non-Latin).
 */
export function jobPath(job: { _id: unknown; title?: string }): string {
  const id = String(job._id);
  const slug = titleSlug(job.title ?? "");
  return slug ? `/job/${slug}-${id}` : `/job/${id}`;
}

/**
 * Recover the posting id from a `/job/<slug>` route parameter.
 *
 * Returns null when the trailing segment isn't an ObjectId, so the page can
 * 404 without ever handing an attacker-controlled string to a Mongo query.
 */
export function parseJobId(slugParam: string): string | null {
  const raw = String(slugParam ?? "");
  const id = raw.slice(raw.lastIndexOf("-") + 1);
  return OBJECT_ID_RE.test(id) ? id : null;
}
