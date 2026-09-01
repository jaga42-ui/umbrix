import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import { fieldLabel, fieldLabelInline, isSeoField } from "@/lib/seoFields";
import { MIN_CITY_JOBS_TO_INDEX } from "@/lib/seoCities";
import { FieldLinks } from "@/components/FieldLinks";
import { CityLinks } from "@/components/CityLinks";
import { JobsFaq } from "@/components/JobsFaq";
import { JobList, realCompanyNames, type ListedJob } from "@/components/JobList";
import { INTERNSHIPS_SECTION, sectionQuery } from "@/lib/seoSection";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { serializeJsonLd } from "@/lib/jsonLd";

// Regenerate hourly, matching the jobs pages.
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

async function getFieldInternships(field: string) {
  try {
    const db = await connectToDatabase();
    if (!db) return { jobs: [] as ListedJob[], total: 0 };
    const query = sectionQuery(INTERNSHIPS_SECTION, field);
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
  params: Promise<{ field: string }>;
}): Promise<Metadata> {
  const { field } = await params;
  if (!isSeoField(field)) return {};
  const label = fieldLabel(field);
  const inlineLabel = fieldLabelInline(field);
  const title = `${label} Internships in India for Freshers (${YEAR})`;
  const description = `Scam-checked ${inlineLabel} internships open to students and freshers across India — no experience required. See which ones you qualify for, matched to your branch, batch, and skills on Umbrix.`;
  const url = `${SITE}/internships/${field}`;

  // Same thin-page rule the city pages apply. A field with almost no
  // internships would otherwise be a near-empty page competing against its own
  // /jobs equivalent, which does have inventory.
  const { total } = await getFieldInternships(field);
  const indexable = total >= MIN_CITY_JOBS_TO_INDEX;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, type: "website", siteName: "Umbrix" },
  };
}

export default async function FieldInternshipsPage({
  params,
}: {
  params: Promise<{ field: string }>;
}) {
  const { field } = await params;
  if (!isSeoField(field)) notFound();

  const label = fieldLabel(field);
  const inlineLabel = fieldLabelInline(field);
  const { jobs, total } = await getFieldInternships(field);
  const companies = realCompanyNames(jobs);

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Umbrix", item: SITE },
      { "@type": "ListItem", position: 2, name: "Internships", item: `${SITE}/internships` },
      { "@type": "ListItem", position: 3, name: label, item: `${SITE}/internships/${field}` },
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
          / {label}
        </nav>

        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3"
          style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
        >
          {label} internships in India
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl mb-2">
          {total > 0 ? `${total.toLocaleString("en-IN")}+ ` : ""}
          {inlineLabel} internships open to students and freshers across India &mdash; each from a real
          company or aggregator and checked by our scam filter before it&rsquo;s listed. Upload your
          r&eacute;sum&eacute; on Umbrix to see a match score and exactly which of these you qualify for.
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
            No live {inlineLabel} internships right now. See{" "}
            <Link href={`/jobs/${field}`} className="text-primary font-semibold">
              all {inlineLabel} fresher jobs
            </Link>{" "}
            instead, or <Link href="/feed" className="text-primary font-semibold">open the feed</Link>.
          </div>
        )}

        <JobsFaq
          field={label}
          fieldInline={inlineLabel}
          total={total}
          companies={companies}
          internships
        />

        <div className="mb-10">
          <CityLinks field={field} basePath="/internships" noun="internships" />
        </div>

        <FieldLinks current={field} basePath="/internships" heading="Internships by field" />

        <p className="text-sm text-muted-foreground mt-8">
          Want full-time roles as well?{" "}
          <Link href={`/jobs/${field}`} className="text-primary font-semibold">
            Fresher {inlineLabel} jobs
          </Link>{" "}
          across India.
        </p>
      </main>

      <Footer />
    </div>
  );
}
