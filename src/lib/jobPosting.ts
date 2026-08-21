/**
 * `JobPosting` structured data — the schema Google requires to show a listing
 * in the Google for Jobs carousel.
 *
 * Two rules govern everything here:
 *
 *  1. **Never invent a field.** Google penalizes inaccurate structured data far
 *     more than absent structured data, and a job board caught claiming
 *     salaries or logos it doesn't have can lose the carousel entirely. Umbrix
 *     stores no compensation, no company logo and no canonical company URL, so
 *     `baseSalary`, `logo` and `sameAs` are omitted rather than guessed.
 *  2. **`validThrough` must never be in the past on a page returning 200.**
 *     Google treats an expired posting that still renders as a live one as a
 *     policy violation.
 *
 * Pure module — no DB, no network, `now` injectable — so the mapping is pinned
 * by fixtures rather than verified by eyeballing a live page.
 */
import { isAggregatorSlug } from "@/lib/seoFields";
import { parseJobLocation } from "@/lib/jobLocation";

/** The posting fields the schema reads. Mirrors `IOpportunity`. */
export interface JobPostingSource {
  _id: unknown;
  title: string;
  companyName?: string;
  companySlug: string;
  location: string;
  descriptionHtml: string;
  applyUrl: string;
  type?: string;
  roleType?: string;
  minExperience?: number;
  cgpaCutoff?: number;
  postedAt?: Date | string | null;
  lastSeenAt?: Date | string | null;
  createdAt: Date | string;
}

/**
 * How long past the last confirmed sighting we claim a posting stays open.
 *
 * Anchored to `lastSeenAt` (when an ingest run last saw the job live on its
 * source) rather than `datePosted`, because a role posted 90 days ago and
 * re-confirmed this morning is open, and dating its expiry from the posting
 * date would emit a past `validThrough` on a live page.
 */
const VALID_THROUGH_DAYS = 30;

/** Floor, so the value is always comfortably in the future. */
const MIN_FUTURE_DAYS = 7;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** When the posting was first published, best available signal. */
export function datePostedFor(job: JobPostingSource): Date {
  return toDate(job.postedAt) ?? toDate(job.createdAt) ?? new Date();
}

/**
 * A `validThrough` that is honest and guaranteed to be in the future — see the
 * note on VALID_THROUGH_DAYS. The freshness sweep closes postings that stop
 * appearing at their source, so "open for another 30 days from the last
 * confirmed sighting" is a claim the pipeline actually backs.
 */
export function validThroughFor(job: JobPostingSource, now: Date = new Date()): Date {
  const anchor = toDate(job.lastSeenAt) ?? toDate(job.postedAt) ?? toDate(job.createdAt) ?? now;
  const projected = addDays(anchor, VALID_THROUGH_DAYS);
  const floor = addDays(now, MIN_FUTURE_DAYS);
  return projected > floor ? projected : floor;
}

/** schema.org employmentType, from whichever of our two type fields is set. */
export function employmentTypeFor(job: JobPostingSource): string {
  if (job.type === "internship") return "INTERN";
  switch (String(job.roleType ?? "").toLowerCase()) {
    case "internship":
      return "INTERN";
    case "part-time":
      return "PART_TIME";
    case "contract":
      return "CONTRACTOR";
    case "full-time":
      return "FULL_TIME";
    default:
      // Overwhelmingly the real case for these sources, and Google requires a
      // value; FULL_TIME is the correct default for a non-internship posting.
      return "FULL_TIME";
  }
}

/**
 * `directApply` is true only when the Apply button lands on the employer's own
 * application form. Aggregator shards bounce through a redirect first, so
 * claiming direct apply for them would be false.
 */
export function isDirectApply(job: JobPostingSource): boolean {
  return !isAggregatorSlug(job.companySlug);
}

/** Display name for the hiring company, falling back rather than showing a slug. */
export function hiringOrganizationName(job: JobPostingSource): string {
  const name = String(job.companyName ?? "").trim();
  if (name) return name;
  const slug = String(job.companySlug ?? "");
  if (!slug || isAggregatorSlug(slug)) return "Hiring company";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/**
 * Build the `JobPosting` JSON-LD object for one posting.
 *
 * @param job  The posting, as stored.
 * @param opts `url` is the canonical page URL; `now` is injectable for tests.
 */
export function buildJobPostingJsonLd(
  job: JobPostingSource,
  opts: { url: string; now?: Date }
): Record<string, unknown> {
  const now = opts.now ?? new Date();
  const place = parseJobLocation(job.location);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.descriptionHtml,
    datePosted: datePostedFor(job).toISOString(),
    validThrough: validThroughFor(job, now).toISOString(),
    employmentType: employmentTypeFor(job),
    hiringOrganization: {
      "@type": "Organization",
      name: hiringOrganizationName(job),
    },
    identifier: {
      "@type": "PropertyValue",
      name: "Umbrix",
      value: String(job._id),
    },
    directApply: isDirectApply(job),
    url: opts.url,
    // Every posting on these SEO surfaces is India-scoped.
    applicantLocationRequirements: { "@type": "Country", name: "India" },
  };

  // A remote role must say so, or Google reads the office address as a
  // requirement to be there.
  if (place.isRemote) {
    data.jobLocationType = "TELECOMMUTE";
  }

  // Only emit jobLocation when there is a real city. "Pan India" is not an
  // address, and an empty PostalAddress is a structured-data warning.
  if (place.locality) {
    data.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: place.locality,
        ...(place.region ? { addressRegion: place.region } : {}),
        addressCountry: "IN",
      },
    };
  }

  // Real extracted data only — `minExperience` is set by the ingest regex pass
  // or the LLM enrichment, and is absent when neither could determine it.
  if (typeof job.minExperience === "number" && Number.isFinite(job.minExperience)) {
    data.experienceRequirements = {
      "@type": "OccupationalExperienceRequirements",
      monthsOfExperience: Math.max(0, Math.round(job.minExperience * 12)),
    };
    if (job.minExperience === 0) {
      data.experienceInPlaceOfEducation = false;
    }
  }

  return data;
}
