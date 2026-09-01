import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import { fieldLabel, fieldLabelInline, isSeoField } from "@/lib/seoFields";
import { FieldLinks } from "@/components/FieldLinks";
import { CityLinks } from "@/components/CityLinks";
import { JobsFaq } from "@/components/JobsFaq";
import { JobList, realCompanyNames, type ListedJob } from "@/components/JobList";
import { JOBS_SECTION, sectionQuery } from "@/lib/seoSection";

// Regenerate hourly — fresh listings without a DB hit on every request.
export const revalidate = 3600;

/**
 * Required for `revalidate` above to mean anything.
 *
 * Next 16: "You must always return an array from generateStaticParams, even if
 * it's empty. Otherwise, the route will be dynamically rendered." Without this
 * export the segment opts out of the full route cache entirely — measured in
 * production as `X-Vercel-Cache: MISS` and `Cache-Control: no-store` on every
 * single request, so each crawler hit re-ran the Mongo query below.
 *
 * Empty array rather than the 16 known fields on purpose: enumerating them
 * would prerender at build time, and this page queries Mongo. A build running
 * without a reachable database would then bake 16 empty field pages into the
 * deployment and serve them for a full revalidation window. On-demand plus ISR
 * has the same steady-state cost and cannot fail closed that way.
 */
export async function generateStaticParams() {
  return [];
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";
const YEAR = new Date().getFullYear();

async function getFieldJobs(field: string) {
  try {
    const db = await connectToDatabase();
    if (!db) return { jobs: [] as ListedJob[], total: 0 };
    const query = sectionQuery(JOBS_SECTION, field);
    const [jobs, total] = await Promise.all([
      Opportunity.find(query)
        .select("title companyName companySlug location createdAt minExperience")
        .sort({ createdAt: -1 })
        .limit(24)
        .lean<ListedJob[]>(),
      Opportunity.countDocuments(query),
    ]);
    return { jobs, total };
  } catch {
    return { jobs: [] as ListedJob[], total: 0 };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ field: string }> }): Promise<Metadata> {
  const { field } = await params;
  if (!isSeoField(field)) return {};
  const label = fieldLabel(field);
  const inlineLabel = fieldLabelInline(field);
  const title = `Fresher ${label} Jobs & Internships in India (${YEAR})`;
  const description = `Real, scam-checked ${inlineLabel} jobs and internships open to freshers across India. See which roles you actually qualify for — matched to your branch, batch, and skills on Umbrix.`;
  const url = `${SITE}/jobs/${field}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "Umbrix" },
  };
}

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { serializeJsonLd } from "@/lib/jsonLd";

export default async function FieldJobsPage({ params }: { params: Promise<{ field: string }> }) {
  const { field } = await params;
  if (!isSeoField(field)) notFound();

  const label = fieldLabel(field);
  const inlineLabel = fieldLabelInline(field);
  const { jobs, total } = await getFieldJobs(field);

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Umbrix", item: SITE },
      { "@type": "ListItem", position: 2, name: "Fresher jobs", item: `${SITE}/jobs` },
      { "@type": "ListItem", position: 3, name: `${label} (Freshers)`, item: `${SITE}/jobs/${field}` },
    ],
  };

  const companies = realCompanyNames(jobs);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }} />

      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
        <nav className="font-mono text-xs text-muted-foreground mb-4">
          <Link href="/jobs" className="hover:text-foreground">Fresher jobs</Link> / {label}
        </nav>

        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3"
          style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
        >
          Fresher {label} jobs in India
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl mb-2">
          {total > 0 ? `${total.toLocaleString("en-IN")}+ ` : ""}
          {inlineLabel} roles and internships open to freshers across India — each sourced from a real
          company or aggregator and checked by our scam filter before it&rsquo;s listed. Upload your résumé on
          Umbrix to see a match score and exactly which of these you qualify for.
        </p>

        <Link
          href="/feed"
          className="um-btn um-btn--primary inline-flex items-center gap-2 px-5 py-2.5 rounded-none text-sm font-semibold my-6"
          style={{ textDecoration: "none" }}
        >
          See your matches <ArrowRight className="w-4 h-4" />
        </Link>

        {jobs.length > 0 ? (
          <JobList jobs={jobs} />
        ) : (
          <div className="border border-dashed border-border rounded-none p-8 text-center text-muted-foreground mb-12">
            New {inlineLabel} roles land here every day. <Link href="/feed" className="text-primary font-semibold">Open the feed</Link> to see the latest.
          </div>
        )}

        <JobsFaq field={label} fieldInline={inlineLabel} total={total} companies={companies} />

        <div className="mb-10">
          <CityLinks field={field} />
        </div>

        <FieldLinks current={field} />
      </main>

      <Footer />
    </div>
  );
}
