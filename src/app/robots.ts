import type { MetadataRoute } from "next";

/**
 * Only the public landing page should be indexed. The authenticated app
 * surfaces (feed/profile/tracker) and API routes are disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/feed", "/profile", "/tracker"],
    },
    // Individual job postings live in their own sitemap so a slow job query can
    // never take down the static and field URLs. Both must be listed here —
    // robots.txt is the only place that points at the second one.
    sitemap: [`${baseUrl}/sitemap.xml`, `${baseUrl}/job/sitemap.xml`],
    host: baseUrl,
  };
}
