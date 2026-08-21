import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, GraduationCap, ShieldCheck, ExternalLink, Building2, CalendarClock, Archive } from "lucide-react";
import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { fieldLabel, fieldForSlug, fieldSlugConds } from "@/lib/seoFields";
import { cityBySlug } from "@/lib/seoCities";
import { parseJobId, jobPath } from "@/lib/jobUrl";
import { parseJobLocation } from "@/lib/jobLocation";
import { parseDescriptionHtml, descriptionSummary, hasIndexableDescription } from "@/lib/jobDescription";
import { serializeJsonLd } from "@/lib/jsonLd";
import {
  buildJobPostingJsonLd,
  hiringOrganizationName,
  datePostedFor,
  type JobPostingSource,
} from "@/lib/jobPosting";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";

/**
 * Regenerate hourly. Postings are not edited after ingest, but `status` flips
 * when the freshness sweep closes one — and a closed role must stop showing
 * JobPosting markup promptly, since Google penalizes expired postings that are
 * still live.
 */
export const revalidate = 3600;

/**
 * The shape read from Mongo. Declared rather than inferred because `.lean()`
 * widens to a generic document and the JSON-LD builder needs the real fields.
 */
interface JobDoc extends JobPostingSource {
  status: "Active" | "Closed";
  batchYears?: number[];
  branches?: string[];
  cgpaCutoff?: number;
  tags?: string[];
}

const SELECT =
  "title companyName companySlug location descriptionHtml applyUrl status type roleType minExperience cgpaCutoff batchYears branches tags postedAt lastSeenAt createdAt";

async function getJob(slugParam: string): Promise<JobDoc | null> {
  const id = parseJobId(slugParam);
  if (!id) return null;
  try {
    const db = await connectToDatabase();
    if (!db) return null;
    const doc = await Opportunity.findById(id).select(SELECT).lean();
    return (doc as JobDoc | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Other live roles in the same field, preferring the same city.
 *
 * This is the internal-linking mechanism as much as a UX module: without it the
 * only route into a job page is the sitemap, and a page a crawler reaches only
 * via the sitemap accumulates far less authority than one linked from a hub.
 */
async function getSimilar(job: JobDoc, field: string, citySlug?: string): Promise<JobDoc[]> {
  try {
    const db = await connectToDatabase();
    if (!db) return [];
    // Typed loosely, matching the field/city pages: Mongoose's strict filter
    // type rejects `$not`/`$ne` shapes it can't narrow.
    const base: Record<string, unknown> = {
      _id: { $ne: job._id },
      status: "Active",
      isIndia: true,
      minExperience: { $not: { $gte: 2 } },
      $or: fieldSlugConds(field),
    };

    const city = citySlug ? cityBySlug(citySlug) : undefined;
    const results: JobDoc[] = [];

    // Same city first — a fresher in Pune wants Pune roles, and it makes the
    // link genuinely useful rather than filler.
    if (city) {
      const localQuery: Record<string, unknown> = {
        ...base,
        location: { $regex: city.pattern, $options: "i" },
      };
      const local = await Opportunity.find(localQuery)
        .select("title companyName companySlug location minExperience")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
      results.push(...(local as unknown as JobDoc[]));
    }

    if (results.length < 5) {
      const seen = new Set(results.map((r) => String(r._id)));
      const more = await Opportunity.find(base)
        .select("title companyName companySlug location minExperience")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      for (const doc of more as unknown as JobDoc[]) {
        if (results.length >= 5) break;
        if (seen.has(String(doc._id))) continue;
        results.push(doc);
      }
    }
    return results.slice(0, 5);
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) return { title: "Job not found", robots: { index: false, follow: true } };

  const company = hiringOrganizationName(job);
  const closed = job.status === "Closed";
  const title = `${job.title} at ${company} — ${job.location}`;
  const description =
    descriptionSummary(job.descriptionHtml) ||
    `${job.title} at ${company} in ${job.location}. Scam-checked and open to freshers on Umbrix.`;
  const url = `${SITE}${jobPath(job)}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    // Two reasons a job page stays out of the index:
    //  - Closed: Google is explicit that expired postings must not remain
    //    indexed. The page still renders for anyone on a stale link.
    //  - No real description: nothing unique to say, so it is thin content —
    //    and at this URL count thin pages drag down the whole section.
    robots:
      closed || !hasIndexableDescription(job.descriptionHtml)
        ? { index: false, follow: true }
        : { index: true, follow: true },
    openGraph: { title, description, url, type: "article", siteName: "Umbrix" },
  };
}

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) notFound();

  const closed = job.status === "Closed";
  const company = hiringOrganizationName(job);
  const field = fieldForSlug(job.companySlug);
  const label = fieldLabel(field);
  const place = parseJobLocation(job.location);
  const city = place.citySlug ? cityBySlug(place.citySlug) : undefined;
  const blocks = parseDescriptionHtml(job.descriptionHtml);
  const fresher = typeof job.minExperience === "number" && job.minExperience <= 1;
  const url = `${SITE}${jobPath(job)}`;
  const similar = await getSimilar(job, field, place.citySlug);

  // Home → Field → City → Job. The trail is deeper than the URL, which is fine:
  // breadcrumbs describe position in the site, not the path structure.
  const crumbs = [
    { name: "Umbrix", item: SITE },
    { name: "Fresher jobs", item: `${SITE}/jobs` },
    { name: label, item: `${SITE}/jobs/${field}` },
    ...(city ? [{ name: city.label, item: `${SITE}/jobs/${field}/${city.slug}` }] : []),
    { name: job.title, item: url },
  ];

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.item,
    })),
  };

  const posted = datePostedFor(job);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* JobPosting markup only while the role is genuinely open AND has a
          real description — `description` is a required property, so emitting
          the block without one earns a Search Console error, not a listing. */}
      {!closed && hasIndexableDescription(job.descriptionHtml) && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(buildJobPostingJsonLd(job, { url })),
          }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbLd) }}
      />

      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        <nav aria-label="Breadcrumb" className="font-mono text-xs text-muted-foreground mb-5">
          <Link href="/jobs" className="hover:text-foreground">
            Fresher jobs
          </Link>{" "}
          /{" "}
          <Link href={`/jobs/${field}`} className="hover:text-foreground">
            {label}
          </Link>
          {city && (
            <>
              {" "}
              /{" "}
              <Link href={`/jobs/${field}/${city.slug}`} className="hover:text-foreground">
                {city.label}
              </Link>
            </>
          )}
        </nav>

        {closed && (
          <div
            role="status"
            className="mb-7 border-2 border-border bg-secondary/30 p-4 flex items-start gap-3"
          >
            <Archive className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold text-foreground">This role has closed.</p>
              <p className="text-muted-foreground mt-1 leading-relaxed">
                It&rsquo;s no longer listed by the employer, so applying won&rsquo;t reach anyone.
                Similar openings are below, and{" "}
                <Link href={`/jobs/${field}`} className="text-primary font-semibold">
                  more {label.toLowerCase()} roles
                </Link>{" "}
                land every day.
              </p>
            </div>
          </div>
        )}

        <h1
          className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3"
          style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
        >
          {job.title} at {company}
        </h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-5">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 opacity-70" aria-hidden />
            {company}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 opacity-70" aria-hidden />
            {job.location}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 opacity-70" aria-hidden />
            <time dateTime={posted.toISOString()}>
              Posted {posted.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </time>
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-7">
          {fresher && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent bg-accent/10 border border-accent/25 px-2.5 py-1">
              <GraduationCap className="w-3.5 h-3.5" aria-hidden />
              Fresher-friendly
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80 bg-secondary/40 border border-border px-2.5 py-1">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
            Checked by our scam filter
          </span>
          {job.type === "internship" && (
            <span className="inline-flex items-center text-[11px] font-semibold text-foreground/80 bg-secondary/40 border border-border px-2.5 py-1">
              Internship
            </span>
          )}
        </div>

        {!closed && (
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="um-btn um-btn--primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold mb-9"
            style={{ textDecoration: "none" }}
          >
            Apply on {company}&rsquo;s site <ExternalLink className="w-4 h-4" aria-hidden />
          </a>
        )}

        <Eligibility job={job} fresher={fresher} />

        <section className="mb-10">
          <h2 className="text-lg font-bold tracking-tight mb-3">About this role</h2>
          {blocks.length > 0 ? (
            <DescriptionBody blocks={blocks} />
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              The employer hasn&rsquo;t published a full description for this role. Open the
              original posting to see the details.
            </p>
          )}
        </section>

        <Faq job={job} company={company} label={label} fresher={fresher} closed={closed} />

        {similar.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold tracking-tight mb-3">
              Similar {label.toLowerCase()} roles{city ? ` in ${city.label}` : ""}
            </h2>
            <ul className="space-y-2.5">
              {similar.map((s) => (
                <li key={String(s._id)}>
                  <Link
                    href={jobPath(s)}
                    className="block bg-surface border border-border p-3.5 hover:border-foreground/40 transition-colors"
                  >
                    <span className="font-semibold tracking-tight block">{s.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {hiringOrganizationName(s)} &middot; {s.location}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="border-t border-border pt-6 text-sm">
          <Link href={`/jobs/${field}`} className="text-primary font-semibold">
            Browse all fresher {label.toLowerCase()} jobs in India
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/** Renders parsed description blocks as React elements — never as raw HTML. */
function DescriptionBody({ blocks }: { blocks: { kind: string; text: string }[] }) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];

  const flush = (key: string) => {
    if (!list.length) return;
    out.push(
      <ul key={key} className="list-disc pl-5 space-y-1.5 my-3 text-sm text-muted-foreground leading-relaxed">
        {list.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    );
    list = [];
  };

  blocks.forEach((b, i) => {
    if (b.kind === "listItem") {
      list.push(b.text);
      return;
    }
    flush(`ul-${i}`);
    if (b.kind === "heading") {
      out.push(
        <h3 key={i} className="font-semibold tracking-tight mt-5 mb-1.5">
          {b.text}
        </h3>
      );
    } else {
      out.push(
        <p key={i} className="text-sm text-muted-foreground leading-relaxed my-2.5">
          {b.text}
        </p>
      );
    }
  });
  flush("ul-final");

  return <div>{out}</div>;
}

/** Eligibility facts, shown only where extraction actually found something. */
function Eligibility({ job, fresher }: { job: JobDoc; fresher: boolean }) {
  const rows: [string, string][] = [];
  if (typeof job.minExperience === "number") {
    rows.push([
      "Experience",
      job.minExperience === 0 ? "No experience required" : `${job.minExperience}+ years`,
    ]);
  }
  if (job.batchYears?.length) rows.push(["Batch years", job.batchYears.join(", ")]);
  if (job.branches?.length) rows.push(["Branches", job.branches.join(", ")]);
  if (typeof job.cgpaCutoff === "number") rows.push(["Minimum CGPA", String(job.cgpaCutoff)]);

  if (!rows.length) {
    return (
      <section className="mb-8 border border-border bg-secondary/20 p-4">
        <h2 className="text-sm font-bold tracking-tight mb-1.5">Who can apply</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The employer hasn&rsquo;t stated batch, branch or CGPA requirements for this role.
          {fresher ? " It is open to candidates with no prior experience." : ""}{" "}
          <Link href="/feed" className="text-primary font-semibold">
            Upload your résumé
          </Link>{" "}
          to see how well you match.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8 border border-border bg-secondary/20 p-4">
      <h2 className="text-sm font-bold tracking-tight mb-3">Who can apply</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground/80">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * A short FAQ in the same voice as the field pages. Two jobs: it answers what
 * freshers actually ask, and it gives each posting enough unique prose that a
 * short JD doesn't read as thin content at this URL count.
 */
function Faq({
  job,
  company,
  label,
  fresher,
  closed,
}: {
  job: JobDoc;
  company: string;
  label: string;
  fresher: boolean;
  closed: boolean;
}) {
  const qa: [string, string][] = [
    [
      "Is this role open to freshers?",
      fresher
        ? `Yes. ${company} has listed this ${job.title} role as open to candidates with no prior full-time experience, which is why it appears on Umbrix's fresher feed.`
        : `${company} hasn't stated an experience requirement for this role. Umbrix only lists roles that are fresher-eligible or leave experience unstated, so it's worth applying and letting the employer decide.`,
    ],
    [
      "Does applying cost anything?",
      "No. Applying is free, and it always should be. Umbrix runs every listing through a scam filter before publishing it, and any posting that asks for a registration fee, a security deposit or a training charge is rejected outright. If this employer asks you for money at any stage, that is a scam — stop and report it.",
    ],
    [
      "Where does this listing come from?",
      `This posting was collected from ${company}'s own careers listing or a licensed job feed, checked by our scam filter, and re-verified on each ingest run. The Apply button sends you to the original posting — Umbrix never sits between you and the employer.`,
    ],
  ];

  if (!closed) {
    qa.push([
      "Is this job still open?",
      `Umbrix re-checks every listing against its source on a schedule and closes any posting that disappears. This ${label.toLowerCase()} role was still live at the last check. If the employer's page says otherwise, it closed since then.`,
    ]);
  }

  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold tracking-tight mb-3">Questions freshers ask</h2>
      <div className="border-t border-border">
        {qa.map(([q, a]) => (
          <div key={q} className="py-4 border-b border-border">
            <h3 className="text-sm font-semibold mb-1.5">{q}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
