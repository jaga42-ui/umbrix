/**
 * The two public SEO sections — /jobs and /internships — and the one place
 * their Mongo queries are built.
 *
 * ## Why a section module rather than a second set of page files
 *
 * /internships is /jobs scoped to `type: "internship"`. Copying the field and
 * city pages to add one condition is exactly the drift CLAUDE.md already
 * records twice: the fresher filter was copy-pasted across five call sites and
 * silently published mid-level roles for months, and `fieldSlugConds` carried a
 * hardcoded source list that hid every new source from its own page. Two page
 * trees querying "fresher-eligible" independently would be the third instance.
 *
 * So the query lives here and the pages differ only in copy — which is the part
 * that *should* differ, since a page about internships must not read like a page
 * about jobs if it is meant to rank for a different query.
 *
 * Pure module: no network, no clock. Shared by the pages and the sitemap.
 */
import { fresherEligibleConditions } from "@/lib/fresherFilter";
import { fieldSlugConds } from "@/lib/seoFields";

export interface SeoSection {
  /** URL segment and cache key, e.g. "internships". */
  slug: "jobs" | "internships";
  /** Path prefix for every link in this section. */
  basePath: string;
  /** Breadcrumb and nav label, e.g. "Internships". */
  navLabel: string;
  /**
   * The noun for a single listing, used in body copy: "roles" reads correctly
   * for jobs, "internships" for internships. Keeping it explicit avoids the
   * pluralisation guesswork that produces "internshipss".
   */
  itemNoun: string;
  /**
   * Extra conditions that scope this section's inventory. Empty for /jobs,
   * which is deliberately the superset — an internship is still a fresher job
   * and stays listed on the jobs pages too. The sections overlap on purpose;
   * they target different queries, not different inventory.
   */
  typeConditions: Record<string, unknown>;
}

export const JOBS_SECTION: SeoSection = {
  slug: "jobs",
  basePath: "/jobs",
  navLabel: "Fresher jobs",
  itemNoun: "roles",
  typeConditions: {},
};

export const INTERNSHIPS_SECTION: SeoSection = {
  slug: "internships",
  basePath: "/internships",
  navLabel: "Internships",
  itemNoun: "internships",
  typeConditions: { type: "internship" },
};

/**
 * Build the Mongo query for one section, field, and optionally one city.
 *
 * `$and` carries the fresher conditions because fresher-eligibility contributes
 * its own `$or` and a document can only hold one — the field scoping needs the
 * top-level `$or` slot.
 *
 * @param section which public section is being rendered
 * @param field an SEO field slug, e.g. "it"
 * @param cityPattern optional regex source matched against the free-text location
 */
export function sectionQuery(
  section: SeoSection,
  field: string,
  cityPattern?: string
): Record<string, unknown> {
  return {
    status: "Active",
    isIndia: true,
    ...section.typeConditions,
    ...(cityPattern ? { location: { $regex: cityPattern, $options: "i" } } : {}),
    $and: [...fresherEligibleConditions(), { $or: fieldSlugConds(field) }],
  };
}
