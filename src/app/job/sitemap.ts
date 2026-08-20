import type { MetadataRoute } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import { jobPath } from "@/lib/jobUrl";
import { fresherEligibleConditions } from "@/lib/fresherFilter";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";

/**
 * Individual job postings, served at `/job/sitemap.xml`.
 *
 * Kept separate from the root sitemap so a slow or failed job query can never
 * take down the 21 static and field URLs, which are the site's backbone.
 *
 * **Deliberately one file, not sharded.** Google's limit is 50,000 URLs and
 * 50MB per sitemap; active inventory is roughly 12k, so sharding via
 * `generateSitemaps` would add real coordination cost — robots.txt has to
 * enumerate every shard, and a shard count that changes between builds either
 * strands URLs or advertises 404s — to solve a problem this site does not have.
 * The guard below logs loudly if that stops being true.
 */
export const revalidate = 3600;

/** Google's hard ceiling is 50,000; stop short of it. */
const MAX_URLS = 45000;

/**
 * Raw-HTML length floor, applied in Mongo.
 *
 * A cheap proxy for the parsed-text check the job page runs, not an equivalent
 * of it: markup inflates the count, so a document of 250 characters of empty
 * `<div>`s passes here and is still `noindex` on the page. Computing the real
 * text length would mean pulling every description into this route — tens of
 * megabytes to build one XML file — which is not a trade worth making.
 *
 * What this reliably removes is the case actually seen in production: postings
 * whose description is empty. The page remains the authority on indexability.
 */
const MIN_DESCRIPTION_HTML_CHARS = 200;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    // Same double-attempt as the root sitemap: connectToDatabase races a 3s
    // timeout, and losing that race once would cache an empty job sitemap for a
    // full revalidation window.
    const db = (await connectToDatabase()) ?? (await connectToDatabase());
    if (!db) return [];

    // Mirrors the filter the field and city pages use, so the sitemap only
    // announces postings that are consistent with what the rest of the SEO
    // surface promises: live, India-based, and open to freshers.
    const query: Record<string, unknown> = {
      status: "Active",
      isIndia: true,
      $and: fresherEligibleConditions(),
      // Postings with no description render as `noindex` (see the job page).
      // Listing them here would spend crawl budget to be told no — the same
      // reasoning the root sitemap applies to thin city pages.
      $expr: {
        $gt: [{ $strLenCP: { $ifNull: ["$descriptionHtml", ""] } }, MIN_DESCRIPTION_HTML_CHARS],
      },
    };

    const total = await Opportunity.countDocuments(query);
    if (total > MAX_URLS) {
      console.warn(
        `[sitemap] ${total} active job URLs exceeds the ${MAX_URLS} single-file cap — ${total - MAX_URLS} are being omitted. Split this into shards with generateSitemaps().`
      );
    }

    const jobs = await Opportunity.find(query)
      .select("title lastSeenAt updatedAt createdAt")
      .sort({ createdAt: -1 })
      .limit(MAX_URLS)
      .lean();

    return (jobs as unknown as {
      _id: unknown;
      title: string;
      lastSeenAt?: Date;
      updatedAt?: Date;
      createdAt: Date;
    }[]).map((job) => ({
      url: `${SITE}${jobPath(job)}`,
      // lastSeenAt is when ingest last confirmed the posting is still live,
      // which is the honest "last modified" signal for a job page.
      lastModified: job.lastSeenAt ?? job.updatedAt ?? job.createdAt,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));
  } catch (e) {
    // An empty job sitemap is recoverable on the next revalidation; a thrown
    // error serves a 500 to Googlebot for the whole file.
    console.error("[sitemap] Failed to build the job sitemap:", e);
    return [];
  }
}
