import type { MetadataRoute } from "next";
import { SEO_FIELDS } from "@/lib/seoFields";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";

/**
 * Indexable public URLs. The authenticated app (feed/profile/tracker) is
 * excluded — it's disallowed in robots and needs sign-in, so it isn't indexable.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/jobs`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/scam-check`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const fieldPages: MetadataRoute.Sitemap = SEO_FIELDS.map((f) => ({
    url: `${SITE}/jobs/${f}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticPages, ...fieldPages];
}
