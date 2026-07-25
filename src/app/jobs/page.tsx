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

export default function JobsHubPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="text-lg font-mono font-semibold tracking-[0.2em]">UMBRIX</span>
          </Link>
          <Link href="/feed" className="text-sm font-semibold text-primary hover:opacity-80">
            Open the feed →
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mb-3">
          Fresher jobs &amp; internships in India
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl mb-6">
          Every role on Umbrix is sourced from a real company or aggregator and checked by our scam filter
          before it&rsquo;s listed — across every field, open to freshers. Pick your field below, or upload your
          résumé to see which roles you actually qualify for, with a match score on each.
        </p>

        <Link
          href="/feed"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all mb-10"
        >
          See your matches <ArrowRight className="w-4 h-4" />
        </Link>

        <FieldLinks />
      </main>

      <footer className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>© {YEAR} Umbrix</span>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/" className="hover:text-foreground ml-auto">Back to Umbrix →</Link>
        </div>
      </footer>
    </div>
  );
}
