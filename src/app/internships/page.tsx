import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FieldLinks } from "@/components/FieldLinks";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";
const YEAR = new Date().getFullYear();

/**
 * Hub for the /internships section.
 *
 * Static, like /jobs — the counts live on the field and city pages, and a hub
 * that queried on every render would pay a database round trip to say nothing
 * the links below don't already say.
 */
export const metadata: Metadata = {
  title: `Internships in India for Students & Freshers (${YEAR})`,
  description:
    "Scam-checked internships across India — IT, engineering, marketing, finance, design and more. Open to students and freshers, with no experience required. See which ones you qualify for on Umbrix.",
  alternates: { canonical: `${SITE}/internships` },
  openGraph: {
    title: `Internships in India for Students & Freshers (${YEAR})`,
    description:
      "Scam-checked internships open to students and freshers across every field, matched to your branch, batch, and skills.",
    url: `${SITE}/internships`,
    type: "website",
    siteName: "Umbrix",
  },
};

export default function InternshipsHubPage() {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Umbrix", item: SITE },
      { "@type": "ListItem", position: 2, name: "Internships", item: `${SITE}/internships` },
    ],
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3"
          style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
        >
          Internships in India for students &amp; freshers
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl mb-6">
          Every internship on Umbrix comes from a real company or aggregator and passes our scam
          filter before it&rsquo;s listed &mdash; across every field, open to students and freshers with
          no prior experience. Pick your field below, or upload your r&eacute;sum&eacute; to see which
          internships you actually qualify for, with a match score on each.
        </p>

        <Link
          href="/feed"
          className="um-btn um-btn--primary inline-flex items-center gap-2 px-5 py-2.5 rounded-none text-sm font-semibold mb-10"
          style={{ textDecoration: "none" }}
        >
          See your matches <ArrowRight className="w-4 h-4" />
        </Link>

        <FieldLinks basePath="/internships" heading="Internships by field" />

        <p className="text-sm text-muted-foreground mt-8">
          Looking for full-time work too?{" "}
          <Link href="/jobs" className="text-primary font-semibold">
            Browse fresher jobs
          </Link>{" "}
          across every field.
        </p>
      </main>

      <Footer />
    </div>
  );
}
