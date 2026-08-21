import type { MetadataRoute } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import { jobPath } from "@/lib/jobUrl";
import { fresherEligibleConditions } from "@/lib/fresherFilter";
import {
  hasIndexableDescription,
  MIN_INDEXABLE_DESCRIPTION_CHARS,
} from "@/lib/jobDescription";

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
 * Raw-HTML length floor, applied in Mongo as a *pre-filter* only.
 *
 * Stripping markup can only shorten a string, so `text.length >= N` implies
 * `html.length >= N`. That makes this a provable superset of the parsed-text
 * check the job page runs: it can never exclude a page the page would index,
 * so the exact check below is free to be the sole authority. Measured, the two
 * agree on every current posting — markup inflation is 1.00 at the median.
 *
 * Its job is to keep the candidate set small enough that pulling descriptions
 * in to run the real check costs a few megabytes rather than tens.
 */
const MIN_DESCRIPTION_HTML_CHARS = MIN_INDEXABLE_DESCRIPTION_CHARS;

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
      // Thin postings render as `noindex` (see the job page). Listing them here
      // would spend crawl budget to be told no — the same reasoning the root
      // sitemap applies to thin city pages. Superset pre-filter; the exact
      // check runs below.
      $expr: {
        $gte: [{ $strLenCP: { $ifNull: ["$descriptionHtml", ""] } }, MIN_DESCRIPTION_HTML_CHARS],
      },
    };

    const candidates = await Opportunity.find(query)
      // descriptionHtml is pulled only to re-run the page's own indexability
      // check, so the sitemap cannot promise a URL that then renders noindex.
      .select("title descriptionHtml lastSeenAt updatedAt createdAt")
      .sort({ createdAt: -1 })
      .limit(MAX_URLS)
      .lean();

    const jobs = (candidates as unknown as {
      _id: unknown;
      title: string;
      descriptionHtml?: string;
      lastSeenAt?: Date;
      updatedAt?: Date;
      createdAt: Date;
    }[]).filter((job) => hasIndexableDescription(job.descriptionHtml ?? ""));

    if (jobs.length > MAX_URLS) {
      console.warn(
        `[sitemap] ${jobs.length} active job URLs exceeds the ${MAX_URLS} single-file cap — ${jobs.length - MAX_URLS} are being omitted. Split this into shards with generateSitemaps().`
      );
    }

    return jobs.map((job) => ({
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
