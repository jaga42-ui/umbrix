import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FieldLinks } from "@/components/FieldLinks";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";
const YEAR = new Date().getFullYear();

export const metadata: Metadata = {
  title: `Fresher Jobs & Internships in India (${YEAR})`,
  description:
    "Real, scam-checked jobs and internships for Indian freshers across every field — IT, engineering, sales, finance, and more. See which roles you actually qualify for on Umbrix.",
  alternates: { canonical: `${SITE}/jobs` },
  openGraph: {
    title: `Fresher Jobs & Internships in India (${YEAR})`,
    description: "Scam-checked fresher jobs across every field, matched to your branch, batch, and skills.",
    url: `${SITE}/jobs`,
    type: "website",
    siteName: "Umbrix",
  },
};

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function JobsHubPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3"
          style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
        >
          Fresher jobs &amp; internships in India
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl mb-6">
          Every role on Umbrix is sourced from a real company or aggregator and checked by our scam filter
          before it&rsquo;s listed — across every field, open to freshers. Pick your field below, or upload your
          résumé to see which roles you actually qualify for, with a match score on each.
        </p>

        <Link
          href="/feed"
          className="um-btn um-btn--primary inline-flex items-center gap-2 px-5 py-2.5 rounded-none text-sm font-semibold mb-10"
          style={{ textDecoration: "none" }}
        >
          See your matches <ArrowRight className="w-4 h-4" />
        </Link>

        <FieldLinks />
      </main>

      <Footer />
    </div>
  );
}
