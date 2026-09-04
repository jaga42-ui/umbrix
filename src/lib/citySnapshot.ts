import { companyDisplayName, type ListedJob } from "@/components/JobList";
import { isSeoField } from "@/lib/seoFields";

/**
 * Per-slice hiring facts for the /jobs and /internships field and city pages.
 *
 * These pages were measured at 92-96% identical prose across all 185 of them:
 * the heading, intro sentence and most FAQ answers are the same template with
 * the city name and a count swapped in. That is the doorway pattern Google
 * penalises, and it is the one finding in the SEO audit carrying manual-action
 * risk rather than merely underperforming.
 *
 * The obvious fix — per-city salary bands and stipend medians — is not
 * available: `salary`, `stipend`, `department` and `cgpaCutoff` are populated on
 * 0% of live India inventory, and `batchYears` on 0.4%. Building on them would
 * have rendered empty strings on every page.
 *
 * What IS populated: `tags` (97.7%), `type` (100%), `companyName` (71.2%) and
 * `createdAt` (88.2%). Measured across six cities, the top-six tag lists built
 * from those overlap by an average of only 2.2/6 — Mumbai skews marketing and
 * finance, Bengaluru and Pune skew Python/Java/AWS, Delhi skews hospitality and
 * teaching — and the employer lists barely overlap at all. So this is real
 * differentiation drawn from data the pipeline already stores, not padding.
 */
export interface SnapshotJob extends ListedJob {
  tags?: string[] | null;
  type?: string | null;
  createdAt?: Date | string | null;
}

export interface CitySnapshot {
  /** Live listings in this field+city slice. */
  total: number;
  /** How many first appeared in the last 7 days. */
  addedLastWeek: number;
  /** How many of the slice are internships rather than full-time roles. */
  internships: number;
  /** Most-mentioned real skills, commonest first. */
  skills: string[];
  /** Most frequent real employers, commonest first. */
  employers: string[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Skill keywords the ingest tagger cannot tell from ordinary English.
 *
 * `SKILL_MATCHERS` in scripts/ingest-jobs.js matches on word boundaries, which
 * correctly stopped "AI" matching inside "trAInee" — but it cannot stop "Go"
 * matching the verb, or "Swift"/"Rust"/"Ruby" matching ordinary prose. Left in,
 * /jobs/marketing/mumbai rendered "the skills these listings ask for most often
 * are AI and Go", which is simply false.
 *
 * These are real skills and dropping them loses genuine signal on backend and
 * mobile roles. That is the right trade: a page that states a wrong fact about
 * its own listings is worse than one that states fewer. Remove an entry here
 * once the tagger can disambiguate it — a title-cased match, or requiring a
 * co-occurring technical term.
 */
const AMBIGUOUS_TAGS = new Set(["go", "swift", "rust", "ruby"]);

/**
 * The normalized category vocabulary, which `extractTags` pushes verbatim as a
 * tag before any skill matching happens.
 *
 * `isSeoField` alone is not enough: it only knows the slugs that have SEO pages,
 * so catch-all values like "general" slipped through and /jobs/it/pune listed
 * "general" among its most-mentioned skills. Kept as a literal set rather than
 * imported from packages/core so this module stays free of a cross-package
 * dependency; it changes about once a year.
 */
const CATEGORY_TAGS = new Set([
  "it", "engineering", "finance", "marketing", "sales", "hr",
  "customer-service", "logistics", "healthcare", "teaching", "hospitality",
  "admin", "consultancy", "creative", "manufacturing", "retail", "graduate",
  "government", "internship", "scholarship", "general",
]);

/**
 * Whether a tag names a skill rather than a job category.
 *
 * `extractTags` seeds the array with the adapter's raw department before adding
 * keyword matches, so two kinds of non-skill land in the array: aggregator
 * categories ("IT Jobs", "Hospitality & Catering Jobs") and bare field slugs
 * ("it", "marketing"). On a page already titled "Fresher IT jobs in Pune",
 * echoing either back as a requested skill is noise — and they are the tags
 * most likely to be identical across every page in a field, which is the exact
 * sameness this block exists to break.
 */
export function isSkillTag(tag: string): boolean {
  const trimmed = tag.trim();
  if (trimmed.length === 0) return false;
  const lower = trimmed.toLowerCase();
  if (/\bjobs$/i.test(trimmed)) return false;
  if (isSeoField(lower) || CATEGORY_TAGS.has(lower)) return false;
  return !AMBIGUOUS_TAGS.has(lower);
}

function rank<T>(values: T[], limit: number): T[] {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

/**
 * Summarise one field+city slice into the facts its page can state truthfully.
 *
 * Pure: `now` is injected rather than read from the clock, so a fixture pins the
 * "added this week" figure exactly. `total` is passed separately because the
 * caller counts the whole slice in Mongo while only sampling documents for the
 * tag and employer ranking — ranking does not need every row, but the headline
 * count must not be a sample.
 *
 * @param jobs a sample of the slice, projected to tags/type/company/createdAt
 * @param total the true size of the slice, counted server-side
 * @param now the reference time for the "added this week" window
 */
export function buildCitySnapshot(
  jobs: SnapshotJob[],
  total: number,
  now: Date
): CitySnapshot {
  const cutoff = now.getTime() - WEEK_MS;

  let addedLastWeek = 0;
  let internships = 0;
  const tags: string[] = [];
  const employers: string[] = [];

  for (const job of jobs) {
    if (job.createdAt) {
      const created = new Date(job.createdAt).getTime();
      if (Number.isFinite(created) && created >= cutoff) addedLastWeek++;
    }
    if (job.type === "internship") internships++;
    for (const tag of job.tags ?? []) {
      if (typeof tag === "string" && isSkillTag(tag)) tags.push(tag.trim());
    }
    const name = companyDisplayName(job);
    if (name && name !== "Hiring company") employers.push(name);
  }

  return {
    total,
    addedLastWeek,
    internships,
    skills: rank(tags, 5),
    employers: rank(employers, 4),
  };
}

/**
 * Join a list into readable prose: "A, B and C". Returns "" for an empty list so
 * a caller can skip the clause entirely rather than print a dangling label.
 */
export function toProseList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
