import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, GraduationCap, ArrowRight } from "lucide-react";
import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import { fieldLabel, isSeoField, fieldSlugConds } from "@/lib/seoFields";
import { FieldLinks } from "@/components/FieldLinks";
import { CityLinks } from "@/components/CityLinks";
import { JobsFaq } from "@/components/JobsFaq";

// Regenerate hourly — fresh listings without a DB hit on every request.
export const revalidate = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";
const YEAR = new Date().getFullYear();

async function getFieldJobs(field: string) {
  try {
    const db = await connectToDatabase();
    if (!db) return { jobs: [] as any[], total: 0 };
    const query: Record<string, unknown> = {
      status: "Active",
      isIndia: true,
      minExperience: { $not: { $gte: 2 } }, // fresher-eligible (0-1) or unstated
      $or: fieldSlugConds(field),
    };
    const [jobs, total] = await Promise.all([
      Opportunity.find(query)
        .select("title companyName companySlug location createdAt minExperience")
        .sort({ createdAt: -1 })
        .limit(24)
        .lean(),
      Opportunity.countDocuments(query),
    ]);
    return { jobs, total };
  } catch {
    return { jobs: [] as any[], total: 0 };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ field: string }> }): Promise<Metadata> {
  const { field } = await params;
  if (!isSeoField(field)) return {};
  const label = fieldLabel(field);
  const title = `Fresher ${label} Jobs & Internships in India (${YEAR})`;
  const description = `Real, scam-checked ${label.toLowerCase()} jobs and internships open to freshers across India. See which roles you actually qualify for — matched to your branch, batch, and skills on Umbrix.`;
  const url = `${SITE}/jobs/${field}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "Umbrix" },
  };
}

export default async function FieldJobsPage({ params }: { params: Promise<{ field: string }> }) {
  const { field } = await params;
  if (!isSeoField(field)) notFound();

  const label = fieldLabel(field);
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

  const companyName = (j: any) =>
    j.companyName ||
    (typeof j.companySlug === "string" && !j.companySlug.startsWith("adzuna-in-") && !j.companySlug.startsWith("jooble-in-")
      ? j.companySlug.charAt(0).toUpperCase() + j.companySlug.slice(1)
      : "Hiring company");

  const companies = Array.from(new Set(jobs.map(companyName))).filter((c) => c && c !== "Hiring company").slice(0, 4) as string[];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

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
        <nav className="font-mono text-xs text-muted-foreground mb-4">
          <Link href="/jobs" className="hover:text-foreground">Fresher jobs</Link> / {label}
        </nav>

        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mb-3">
          Fresher {label} jobs in India
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl mb-2">
          {total > 0 ? `${total.toLocaleString("en-IN")}+ ` : ""}
          {label.toLowerCase()} roles and internships open to freshers across India — each sourced from a real
          company or aggregator and checked by our scam filter before it&rsquo;s listed. Upload your résumé on
          Umbrix to see a match score and exactly which of these you qualify for.
        </p>

        <Link
          href="/feed"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all my-6"
        >
          See your matches <ArrowRight className="w-4 h-4" />
        </Link>

        {jobs.length > 0 ? (
          <ul className="space-y-3 mb-12">
            {jobs.map((j: any) => {
              const fresher = j.minExperience != null && j.minExperience <= 1;
              return (
                <li key={String(j._id)} className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-semibold tracking-tight">{j.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground/90">{companyName(j)}</span>
                    <span className="flex items-center">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-muted-foreground/70" />
                      {j.location}
                    </span>
                    {fresher && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent bg-accent/10 border border-accent/25 px-2 py-0.5 rounded-full">
                        <GraduationCap className="w-3.5 h-3.5" />
                        Fresher-friendly
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground mb-12">
            New {label.toLowerCase()} roles land here every day. <Link href="/feed" className="text-primary font-semibold">Open the feed</Link> to see the latest.
          </div>
        )}

        <JobsFaq field={label} total={total} companies={companies} />

        <div className="mb-10">
          <CityLinks field={field} />
        </div>

        <FieldLinks current={field} />
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
