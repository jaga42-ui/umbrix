import Link from "next/link";
import { MapPin, GraduationCap } from "lucide-react";
import { jobPath } from "@/lib/jobUrl";
import { isAggregatorSlug } from "@/lib/seoFields";
import { labelFromSlug } from "@/lib/companyName";

/** The listing fields every SEO page selects. */
export interface ListedJob {
  _id: unknown;
  title: string;
  companyName?: string | null;
  companySlug?: string | null;
  location?: string | null;
  minExperience?: number | null;
}

/**
 * Best available display name for a listing.
 *
 * Aggregator shards store a synthetic `companySlug` like "adzuna-in-it" that is
 * a field bucket, not a company — showing it would put "Adzuna-in-it" where a
 * reader expects an employer. Falls back to a neutral label instead.
 *
 * Two fixes here rather than one, because they shared a cause — logic derived
 * by hand instead of reused:
 *
 *  - The shard test was spelled out inline as two `startsWith` calls, so it
 *    missed `careerjet-*` and every `*-fresher-*` slug. `isAggregatorSlug` is
 *    the canonical definition and says in its own comment that callers should
 *    share it; a missed shard is not cosmetic, it publishes a bucket name where
 *    an employer belongs.
 *  - Casing was "uppercase the first character", which produced "Hpe",
 *    "Mongodb", "Phonepe" and "Servicenow" — now in indexed prose via the city
 *    snapshot and FAQ, not just in a card. `labelFromSlug` carries the brand
 *    exceptions.
 */
export function companyDisplayName(job: ListedJob): string {
  if (job.companyName) return job.companyName;
  const slug = job.companySlug;
  if (typeof slug === "string" && slug.length > 0 && !isAggregatorSlug(slug)) {
    return labelFromSlug(slug);
  }
  return "Hiring company";
}

/** The real employer names on a page, for the FAQ block. Synthetic ones dropped. */
export function realCompanyNames(jobs: ListedJob[], limit = 4): string[] {
  return Array.from(new Set(jobs.map(companyDisplayName)))
    .filter((c) => c && c !== "Hiring company")
    .slice(0, limit);
}

/**
 * The listing card list shared by every /jobs and /internships page.
 *
 * Cards are links, not inert text. A sitemap entry alone is a weak discovery
 * signal — a job page a crawler can only reach through the sitemap accumulates
 * far less authority than one linked from its field hub.
 */
export function JobList({ jobs }: { jobs: ListedJob[] }) {
  return (
    <ul className="space-y-3 mb-12">
      {jobs.map((j) => {
        const fresher = j.minExperience != null && j.minExperience <= 1;
        return (
          <li key={String(j._id)}>
            <Link
              href={jobPath(j as Parameters<typeof jobPath>[0])}
              className="block bg-surface border border-border rounded-none p-4 hover:border-foreground/40 transition-colors"
            >
              <h3 className="font-semibold tracking-tight">{j.title}</h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                <span className="font-medium text-foreground/90">{companyDisplayName(j)}</span>
                <span className="flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-muted-foreground/70" />
                  {j.location}
                </span>
                {fresher && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent bg-accent/10 border border-accent/25 px-2 py-0.5 rounded-none">
                    <GraduationCap className="w-3.5 h-3.5" />
                    Fresher-friendly
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
