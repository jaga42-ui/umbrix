import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import { fieldLabel, fieldLabelInline, isSeoField } from "@/lib/seoFields";
import { cityBySlug, MIN_CITY_JOBS_TO_INDEX } from "@/lib/seoCities";
import { CityLinks } from "@/components/CityLinks";
import { JobsFaq } from "@/components/JobsFaq";
import { JobList, realCompanyNames, type ListedJob } from "@/components/JobList";
import { JOBS_SECTION, sectionQuery } from "@/lib/seoSection";

export const revalidate = 3600;

/**
 * Required for `revalidate` to apply — see the note in ../page.tsx. Without it
 * Next 16 renders this segment dynamically and all 147 city pages hit Mongo on
 * every request.
 */
export async function generateStaticParams() {
  return [];
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";
const YEAR = new Date().getFullYear();

async function getCityJobs(field: string, cityPattern: string) {
  try {
    const db = await connectToDatabase();
    if (!db) return { jobs: [] as ListedJob[], total: 0 };
    const query = sectionQuery(JOBS_SECTION, field, cityPattern);
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ field: string; city: string }>;
}): Promise<Metadata> {
  const { field, city } = await params;
  const cityObj = cityBySlug(city);
  if (!isSeoField(field) || !cityObj) return {};

  const label = fieldLabel(field);
  const inlineLabel = fieldLabelInline(field);
  const title = `Fresher ${label} Jobs in ${cityObj.label} (${YEAR})`;
  const description = `Scam-checked ${inlineLabel} jobs and internships open to freshers in ${cityObj.label}. See which ones you qualify for — matched to your branch, batch, and skills on Umbrix.`;
  const url = `${SITE}/jobs/${field}/${city}`;

  // Thin pages hurt SEO — only let a city page into the index once it has enough
  // real listings. Below the threshold it still works for users, just noindex.
  const { total } = await getCityJobs(field, cityObj.pattern);
  const indexable = total >= MIN_CITY_JOBS_TO_INDEX;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, type: "website", siteName: "Umbrix" },
  };
}

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { serializeJsonLd } from "@/lib/jsonLd";

export default async function CityJobsPage({
  params,
}: {
  params: Promise<{ field: string; city: string }>;
}) {
  const { field, city } = await params;
  const cityObj = cityBySlug(city);
  if (!isSeoField(field) || !cityObj) notFound();

  const label = fieldLabel(field);
  const inlineLabel = fieldLabelInline(field);
  const { jobs, total } = await getCityJobs(field, cityObj.pattern);

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Umbrix", item: SITE },
      { "@type": "ListItem", position: 2, name: "Fresher jobs", item: `${SITE}/jobs` },
      { "@type": "ListItem", position: 3, name: label, item: `${SITE}/jobs/${field}` },
      { "@type": "ListItem", position: 4, name: cityObj.label, item: `${SITE}/jobs/${field}/${city}` },
    ],
  };

  const companies = realCompanyNames(jobs);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }} />

      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
        <nav className="font-mono text-xs text-muted-foreground mb-4">
          <Link href="/jobs" className="hover:text-foreground">Fresher jobs</Link> /{" "}
          <Link href={`/jobs/${field}`} className="hover:text-foreground">{label}</Link> / {cityObj.label}
        </nav>

        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3"
          style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
        >
          Fresher {label} jobs in {cityObj.label}
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl mb-2">
          {total > 0 ? `${total.toLocaleString("en-IN")}+ ` : ""}
          {inlineLabel} roles and internships open to freshers in {cityObj.label} — each from a real
          company or aggregator and checked by our scam filter before it&rsquo;s listed. Upload your résumé on
          Umbrix to see a match score and which of these you qualify for.
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
            No live {inlineLabel} roles in {cityObj.label} right now. See{" "}
            <Link href={`/jobs/${field}`} className="text-primary font-semibold">all {inlineLabel} jobs</Link>{" "}
            across India, or <Link href="/feed" className="text-primary font-semibold">open the feed</Link>.
          </div>
        )}

        <JobsFaq field={label} fieldInline={inlineLabel} city={cityObj.label} total={total} companies={companies} />

        <CityLinks field={field} currentCity={city} />
      </main>

      <Footer />
    </div>
  );
}
