import type { MetadataRoute } from "next";
import { SEO_FIELDS, fieldSlugConds } from "@/lib/seoFields";
import { fresherEligibleConditions } from "@/lib/fresherFilter";
import { CITIES, MIN_CITY_JOBS_TO_INDEX } from "@/lib/seoCities";
import { connectToDatabase } from "@/lib/mongodb";
import {
  PAGE_UPDATED,
  updatedAsDate,
  startOfUtcDay,
} from "@/lib/contentDates";
import { Opportunity } from "@/models/Opportunity";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";

/**
 * Re-generate at most hourly. The city section costs one query per field, and
 * a sitemap does not need to be second-accurate — but it does need to keep up
 * with inventory, since a city page crossing the indexable threshold is exactly
 * the event this file exists to announce.
 */
export const revalidate = 3600;

/**
 * Count fresher-eligible listings per city for one field.
 *
 * Deliberately ONE query per field rather than one per field×city pair: at 16
 * fields × 15 cities that would be 240 round trips to build a single document.
 * The city split is a regex over a free-text location, which Mongo cannot group
 * by anyway, so locations are fetched once and bucketed in memory.
 *
 * The filter mirrors the city page's own query exactly — same status, India,
 * fresher and field conditions. If these ever diverge the sitemap would promise
 * pages that then render as noindex, which is worse than omitting them.
 */
async function cityCountsForField(field: string): Promise<Map<string, number>> {
  const rows = await Opportunity.find({
    status: "Active",
    isIndia: true,
    // $and, because fresher-eligibility contributes its own $or and a document
    // can only carry one. Must stay identical to the city page's own query —
    // if these diverge the sitemap promises pages that then render noindex.
    $and: [...fresherEligibleConditions(), { $or: fieldSlugConds(field) }],
  } as Record<string, unknown>)
    .select("location")
    .lean();

  const counts = new Map<string, number>();
  for (const city of CITIES) {
    const re = new RegExp(city.pattern, "i");
    let n = 0;
    for (const row of rows) if (re.test(String(row.location ?? ""))) n++;
    counts.set(city.slug, n);
  }
  return counts;
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

  const fieldPages: MetadataRoute.Sitemap = SEO_FIELDS.map((f) => ({
    url: `${SITE}/jobs/${f}`,
    lastModified: today,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const cityPages: MetadataRoute.Sitemap = [];
  try {
    // connectToDatabase races a 3s timeout to avoid hanging on offline DNS.
    // That is right for a page render — falling back to demo mode beats a
    // spinner — but wrong here: losing the race once would cache a sitemap
    // missing all 150 city URLs for a full revalidation window, silently
    // undoing this file's entire purpose. A cold serverless instance can
    // plausibly lose it, so try twice before giving up.
    const db = (await connectToDatabase()) ?? (await connectToDatabase());
    if (db) {
      for (const field of SEO_FIELDS) {
        const counts = await cityCountsForField(field);
        for (const city of CITIES) {
          if ((counts.get(city.slug) ?? 0) < MIN_CITY_JOBS_TO_INDEX) continue;
          cityPages.push({
            url: `${SITE}/jobs/${field}/${city.slug}`,
            lastModified: today,
            changeFrequency: "daily",
            priority: 0.7,
          });
        }
      }
    }
  } catch {
    // A database blip must not produce an empty or failed sitemap — losing the
    // static and field URLs would be far worse than temporarily omitting the
    // city ones, which the next revalidation restores.
  }

  return [...staticPages, ...fieldPages, ...cityPages];
}
