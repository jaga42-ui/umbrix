import type { MetadataRoute } from "next";

/**
 * Only the public landing page should be indexed. The authenticated app
 * surfaces (feed/profile/tracker) and API routes are disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://umbrix.vercel.app";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/feed", "/profile", "/tracker"],
    },
    host: baseUrl,
  };
}
