/**
 * Last-meaningful-change dates for the site's static pages, and the helper the
 * sitemap uses to keep inventory-driven `lastmod` values honest.
 *
 * The sitemap used to stamp `new Date()` on all 168 root URLs and regenerate
 * hourly. That made `/privacy` and `/terms` claim modification every hour while
 * declaring `changeFrequency: "yearly"` — self-contradictory, and Google
 * discounts `lastmod` across an entire site once it sees that pattern. Left
 * alone it would have undercut the genuinely honest `lastSeenAt` timestamps in
 * the job sitemap, which are the ones that actually matter for recrawl.
 *
 * Keep these in ISO `YYYY-MM-DD`. Update the entry when you change that page's
 * visible content — that is the whole contract `lastmod` expresses.
 */
export const PAGE_UPDATED = {
  privacy: "2026-07-25",
  terms: "2026-07-25",
  scamCheck: "2026-07-25",
} as const;

/** Parse one of the constants above into a UTC-midnight Date for the sitemap. */
export function updatedAsDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Render one of the constants above as the "Last updated" line the legal pages
 * show, e.g. "25 July 2026". Fixed to en-GB/UTC so the string is identical on
 * the server and in every visitor's timezone — a locale-dependent date would
 * hydrate differently than it rendered.
 */
export function updatedAsHuman(iso: string): string {
  return updatedAsDate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Floor a timestamp to UTC midnight.
 *
 * Pages whose content really does track daily job inventory (`/`, `/jobs`, the
 * field and city pages) still deserve a moving `lastmod` — but at day
 * granularity, matching their declared `changeFrequency: "daily"`. Without this
 * the hourly revalidation would advertise a fresh modification every hour and
 * earn the same discount described above.
 */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
