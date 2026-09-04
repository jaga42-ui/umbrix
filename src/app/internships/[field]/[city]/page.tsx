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
import { INTERNSHIPS_SECTION, sectionQuery } from "@/lib/seoSection";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { serializeJsonLd } from "@/lib/jsonLd";
import { CitySnapshot } from "@/components/CitySnapshot";
import { buildCitySnapshot, type SnapshotJob } from "@/lib/citySnapshot";

export const revalidate = 3600;

/**
 * Required for `revalidate` to apply — see the note in
 * @/app/jobs/[field]/page.tsx.
 */
export async function generateStaticParams() {
  return [];
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";
const YEAR = new Date().getFullYear();

async function getCityInternships(field: string, cityPattern: string) {
  try {
    const db = await connectToDatabase();
    if (!db) return { jobs: [] as ListedJob[], total: 0 };
    const query = sectionQuery(INTERNSHIPS_SECTION, field, cityPattern);
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

/**
 * Wider, tag-bearing sample for the hiring snapshot. Separate from the function
 * above because `generateMetadata` calls that one only for the indexability
 * count — see the matching note in @/app/jobs/[field]/[city]/page.tsx.
 */
async function getSnapshotSample(field: string, cityPattern: string): Promise<SnapshotJob[]> {
  try {
    const db = await connectToDatabase();
    if (!db) return [];
    return await Opportunity.find(sectionQuery(INTERNSHIPS_SECTION, field, cityPattern))
      .select("companyName companySlug tags type createdAt title")
      .sort({ createdAt: -1 })
      .limit(300)
      .lean<SnapshotJob[]>();
  } catch {
    return [];
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
  const title = `${label} Internships in ${cityObj.label} for Freshers (${YEAR})`;
  const description = `Scam-checked ${inlineLabel} internships in ${cityObj.label}, open to students and freshers with no experience. See which ones you qualify for — matched to your branch, batch, and skills on Umbrix.`;
  const url = `${SITE}/internships/${field}/${city}`;

  // Only index once the page has enough real listings — below the threshold it
  // still works for users, it just stays out of the index. Mirrors the jobs
  // city pages exactly, and is the same rule the sitemap gates on.
  const { total } = await getCityInternships(field, cityObj.pattern);
  const indexable = total >= MIN_CITY_JOBS_TO_INDEX;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, type: "website", siteName: "Umbrix" },
  };
}

export default async function CityInternshipsPage({
  params,
}: {
  params: Promise<{ field: string; city: string }>;
}) {
  const { field, city } = await params;
  const cityObj = cityBySlug(city);
  if (!isSeoField(field) || !cityObj) notFound();

  const label = fieldLabel(field);
  const inlineLabel = fieldLabelInline(field);
  const [{ jobs, total }, sample] = await Promise.all([
    getCityInternships(field, cityObj.pattern),
    getSnapshotSample(field, cityObj.pattern),
  ]);
  const snapshot = buildCitySnapshot(sample, total, new Date());
  const companies = realCompanyNames(jobs);

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Umbrix", item: SITE },
      { "@type": "ListItem", position: 2, name: "Internships", item: `${SITE}/internships` },
      { "@type": "ListItem", position: 3, name: label, item: `${SITE}/internships/${field}` },
      {
        "@type": "ListItem",
        position: 4,
        name: cityObj.label,
        item: `${SITE}/internships/${field}/${city}`,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }} />

      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
        <nav className="font-mono text-xs text-muted-foreground mb-4">
          <Link href="/internships" className="hover:text-foreground">
            Internships
          </Link>{" "}
          /{" "}
          <Link href={`/internships/${field}`} className="hover:text-foreground">
            {label}
          </Link>{" "}
          / {cityObj.label}
        </nav>

        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3"
          style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
        >
          {label} internships in {cityObj.label}
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl mb-2">
          {total > 0 ? `${total.toLocaleString("en-IN")}+ ` : ""}
          {inlineLabel} internships in {cityObj.label} open to students and freshers &mdash; each from a
          real company or aggregator and checked by our scam filter before it&rsquo;s listed. Upload your
          r&eacute;sum&eacute; on Umbrix to see a match score and which of these you qualify for.
        </p>

        <CitySnapshot
          snapshot={snapshot}
          place={cityObj.label}
          fieldInline={inlineLabel}
          noun="internships"
        />

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
            No live {inlineLabel} internships in {cityObj.label} right now. See{" "}
            <Link href={`/internships/${field}`} className="text-primary font-semibold">
              all {inlineLabel} internships
            </Link>{" "}
            across India, or{" "}
            <Link href={`/jobs/${field}/${city}`} className="text-primary font-semibold">
              fresher jobs in {cityObj.label}
            </Link>
            .
          </div>
        )}

        <JobsFaq
          field={label}
          fieldInline={inlineLabel}
          city={cityObj.label}
          total={total}
          companies={companies}
          internships
          skills={snapshot.skills}
          addedLastWeek={snapshot.addedLastWeek}
        />

        <CityLinks
          field={field}
          currentCity={city}
          basePath="/internships"
          noun="internships"
        />
      </main>

      <Footer />
    </div>
  );
}
