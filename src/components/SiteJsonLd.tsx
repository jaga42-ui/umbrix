const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";

/**
 * Site-wide Organization + WebSite structured data. Rendered once in the root
 * layout so every page carries the publisher/brand schema (helps Google build a
 * knowledge panel and attribute pages to Umbrix).
 */
export function SiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#org`,
        name: "Umbrix",
        url: SITE,
        logo: `${SITE}/icon-512.png`,
        description:
          "A discovery feed of real, scam-checked, fresher-eligible jobs and internships for Indian students and graduates — matched to their branch, batch, and skills.",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: SITE,
        name: "Umbrix",
        publisher: { "@id": `${SITE}/#org` },
      },
    ],
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
