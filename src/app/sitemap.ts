import type { MetadataRoute } from "next";
import { SEO_FIELDS } from "@/lib/seoFields";
import {
  CITIES,
  MIN_CITY_JOBS_TO_INDEX,
  MIN_FIELD_JOBS_TO_INDEX,
} from "@/lib/seoCities";
import {
  JOBS_SECTION,
  INTERNSHIPS_SECTION,
  sectionQuery,
  type SeoSection,
} from "@/lib/seoSection";
import { connectToDatabase } from "@/lib/mongodb";
import {
  PAGE_UPDATED,
  updatedAsDate,
  startOfUtcDay,
} from "@/lib/contentDates";
import { Opportunity } from "@/models/Opportunity";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";

/**
 * Built fresh on every request.
 *
 * `revalidate` alone was not enough and the failure was silent. Per the Next 16
 * docs, "sitemap.js is a special Route Handler that is cached by default unless
 * it uses a Request-time API or dynamic config option" — so this file was baked
 * at build time and served unchanged until the next deploy. Measured on
 * 2026-09-01: the live sitemap still advertised `lastmod 2026-08-25` on all 219
 * inventory-driven URLs, seven days stale, while declaring `changefreq: daily`.
 *
 * That is the exact lastmod-credibility problem @/lib/contentDates was written
 * to avoid, and it had a second-order cost: /job/sitemap.xml filters
 * `status: "Active"` correctly, but a frozen copy kept advertising postings the
 * freshness sweep had since closed — 61% of a 41-URL sample.
 *
 * A sitemap is fetched a handful of times a day by crawlers, so paying the
 * query cost per request is the right trade for never serving a stale one.
 */
export const dynamic = "force-dynamic";

/**
 * Per-city counts, plus the field total, for one section and field.
 *
 * Deliberately ONE query per field rather than one per field×city pair: at 16
 * fields × 15 cities that would be 240 round trips per section to build a
 * single document. The city split is a regex over a free-text location, which
 * Mongo cannot group by anyway, so locations are fetched once and bucketed in
 * memory.
 *
 * The filter comes from `sectionQuery`, the same builder the pages call, so the
 * sitemap cannot promise a URL that then renders `noindex` — the failure mode
 * that a hand-copied filter here would reintroduce.
 */
async function countsForField(
  section: SeoSection,
  field: string
): Promise<{ total: number; byCity: Map<string, number> }> {
  const rows = await Opportunity.find(sectionQuery(section, field))
    .select("location")
    .lean<{ location?: string }[]>();

  const byCity = new Map<string, number>();
  for (const city of CITIES) {
    const re = new RegExp(city.pattern, "i");
    let n = 0;
    for (const row of rows) if (re.test(String(row.location ?? ""))) n++;
    byCity.set(city.slug, n);
  }
  return { total: rows.length, byCity };
}

/**
 * Every indexable URL for one section: its field pages and its field×city pages.
 *
 * `gateFieldPages` is the one difference between the two sections. Every /jobs
 * field page has real inventory, so all 16 are always listed. An /internships
 * field page can be genuinely empty — logistics has 3 listings nationwide — and
 * those render `noindex`, so listing them would spend crawl budget to be told no.
 */
async function sectionUrls(
  section: SeoSection,
  lastModified: Date,
  { gateFieldPages }: { gateFieldPages: boolean }
): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];
  for (const field of SEO_FIELDS) {
    const { total, byCity } = await countsForField(section, field);

    // Field pages keep the original, lower bar — see MIN_FIELD_JOBS_TO_INDEX.
    // A nationwide /internships/<field> hub is not a location page, so the
    // doorway reasoning behind the raised city threshold does not apply to it.
    if (!gateFieldPages || total >= MIN_FIELD_JOBS_TO_INDEX) {
      urls.push({
        url: `${SITE}${section.basePath}/${field}`,
        lastModified,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }

    for (const city of CITIES) {
      if ((byCity.get(city.slug) ?? 0) < MIN_CITY_JOBS_TO_INDEX) continue;
      urls.push({
        url: `${SITE}${section.basePath}/${field}/${city.slug}`,
        lastModified,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }
  return urls;
}

/**
 * Indexable public URLs. The authenticated app (feed/profile/tracker) is
 * excluded — it's disallowed in robots and needs sign-in, so it isn't indexable.
 *
 * City pages were previously missing entirely: 240 pages were built and shipped
 * but never announced, so the long-tail queries they exist to win ("fresher
 * marketing jobs in Pune") had no route into the index. They are included here
 * only above MIN_CITY_JOBS_TO_INDEX, because below it the page itself sends
 * `noindex` — listing those would spend crawl budget to be told no.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Day granularity, not `new Date()`. These pages revalidate hourly, so a raw
  // timestamp would advertise a fresh modification every hour on URLs that
  // change at most daily — see the note in @/lib/contentDates.
  const today = startOfUtcDay(new Date());

  // Editorial pages carry their own last-updated date; only the pages that
  // genuinely track daily job inventory move with `today`.
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: today, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/jobs`, lastModified: today, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/internships`, lastModified: today, changeFrequency: "daily", priority: 0.9 },
    {
      url: `${SITE}/scam-check`,
      lastModified: updatedAsDate(PAGE_UPDATED.scamCheck),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/privacy`,
      lastModified: updatedAsDate(PAGE_UPDATED.privacy),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE}/terms`,
      lastModified: updatedAsDate(PAGE_UPDATED.terms),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Field and city URLs for both public sections. /jobs field pages are always
  // listed — every one has inventory. /internships field pages are gated,
  // because a field can genuinely have almost no internships and those pages
  // render `noindex`.
  let sectionPages: MetadataRoute.Sitemap = [];
  try {
    // connectToDatabase races a 3s timeout to avoid hanging on offline DNS.
    // That is right for a page render — falling back to demo mode beats a
    // spinner — but wrong here: losing the race once would cache a sitemap
    // missing every field and city URL for a full revalidation window, silently
    // undoing this file's entire purpose. A cold serverless instance can
    // plausibly lose it, so try twice before giving up.
    const db = (await connectToDatabase()) ?? (await connectToDatabase());
    if (db) {
      sectionPages = [
        ...(await sectionUrls(JOBS_SECTION, today, { gateFieldPages: false })),
        ...(await sectionUrls(INTERNSHIPS_SECTION, today, { gateFieldPages: true })),
      ];
    }
  } catch {
    // A database blip must not produce an empty or failed sitemap — losing the
    // static URLs would be far worse than temporarily omitting the rest, which
    // the next revalidation restores.
  }

  return [...staticPages, ...sectionPages];
}
