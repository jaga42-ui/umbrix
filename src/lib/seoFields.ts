/**
 * Display labels for the job fields we build SEO landing pages for. Keys match
 * JOB_FIELDS (matchScore) / the aggregator shard fields, so a page's field maps
 * cleanly to real inventory. Pure module — shared by the pages and the sitemap.
 */
export const FIELD_LABELS: Record<string, string> = {
  it: "IT & Software",
  engineering: "Engineering",
  sales: "Sales",
  marketing: "Marketing",
  finance: "Finance & Accounting",
  "customer-service": "Customer Service & BPO",
  hr: "HR & Recruiting",
  admin: "Admin & Operations",
  retail: "Retail",
  logistics: "Logistics & Supply Chain",
  healthcare: "Healthcare",
  teaching: "Teaching & Education",
  hospitality: "Hospitality",
  creative: "Creative & Design",
  consultancy: "Consulting",
  manufacturing: "Manufacturing",
};

/**
 * The same labels written for mid-sentence use, e.g. "scam-checked IT & software
 * jobs". Spelled out per field rather than derived, because `toLowerCase()` on
 * the display label destroys the acronyms: "IT & Software" became "it & software"
 * in the meta description Google renders, and "HR & Recruiting" became "hr &
 * recruiting". A heuristic that guessed which words were acronyms would be more
 * code and one more thing to get wrong on the next field added.
 */
export const FIELD_LABELS_INLINE: Record<string, string> = {
  it: "IT & software",
  engineering: "engineering",
  sales: "sales",
  marketing: "marketing",
  finance: "finance & accounting",
  "customer-service": "customer service & BPO",
  hr: "HR & recruiting",
  admin: "admin & operations",
  retail: "retail",
  logistics: "logistics & supply chain",
  healthcare: "healthcare",
  teaching: "teaching & education",
  hospitality: "hospitality",
  creative: "creative & design",
  consultancy: "consulting",
  manufacturing: "manufacturing",
};

/** The fields that get a /jobs/<field> SEO page. */
export const SEO_FIELDS = Object.keys(FIELD_LABELS);

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** The field label as it should read mid-sentence. Never use `toLowerCase()`. */
export function fieldLabelInline(field: string): string {
  return FIELD_LABELS_INLINE[field] ?? fieldLabel(field).toLowerCase();
}

export function isSeoField(field: string): boolean {
  return Object.prototype.hasOwnProperty.call(FIELD_LABELS, field);
}

/** Aggregator sources whose companySlugs are field shards, not real companies. */
export const AGGREGATOR_PREFIXES = ["adzuna", "jooble", "careerjet"] as const;

// A source may run more than one shard family over the same field — Careerjet
// has `careerjet-in-<field>` (structured internships) alongside
// `careerjet-fresher-<field>` (keyword sweep). Both are aggregator shards and
// both must be recognised as such.
const SHARD_INFIXES = ["in", "fresher"] as const;

// Anything matching this is an aggregator field shard; anything else is a
// company ATS board. Both lists feed it, so adding a source or a shard family is
// a one-line change — and missing one is not a silent typo but a real defect: an
// unrecognised shard is hidden from its own field page AND swept onto /jobs/it
// by the catch-all branch below, publishing (say) warehouse roles as IT jobs.
const AGGREGATOR_SHARD_RE = new RegExp(
  `^(?:${AGGREGATOR_PREFIXES.join("|")})-(?:${SHARD_INFIXES.join("|")})-`
);

/**
 * Aggregator sources whose companySlug is one bucket spanning every field
 * (`unstop-jobs`, `jsearch-internship`, `serpapi-fresher-it`), with the field
 * carried per posting in `category` instead — set by the connector through
 * `normalizeCategory` (packages/normalizer). Even a slug that names a field,
 * like `serpapi-fresher-it`, is only the search query the connector ran; the
 * postings it returns are classified individually and measurably are not all IT.
 *
 * These were missing from the shard rule, so the IT catch-all treated each
 * bucket as a "company ATS board". Measured 2026-10-03: 1,629 of 2,412 listings
 * on /jobs/it (67%) were Unstop — mostly sales, HR and business-development
 * roles — and none of them appeared on their own field's pages.
 */
export const CATEGORIZED_SOURCES = ["unstop", "jsearch", "serpapi"] as const;

const CATEGORIZED_SOURCE_RE = new RegExp(`^(?:${CATEGORIZED_SOURCES.join("|")})-`);

// Every companySlug that is a source bucket rather than one real employer.
const NON_COMPANY_SLUG_RE = new RegExp(
  `${AGGREGATOR_SHARD_RE.source}|${CATEGORIZED_SOURCE_RE.source}`
);

/**
 * Whether a companySlug is an aggregator bucket rather than a real company ATS
 * board — a per-field shard or a categorized multi-field bucket. Exported so
 * callers outside this module (JobPosting schema, which must not claim
 * `directApply` for a link that bounces through an aggregator) share the one
 * definition instead of re-deriving the pattern.
 */
export function isAggregatorSlug(companySlug: string): boolean {
  return NON_COMPANY_SLUG_RE.test(String(companySlug ?? ""));
}

// Same shape as AGGREGATOR_SHARD_RE, but capturing the field so a posting can
// be mapped back to the field page it belongs under.
const AGGREGATOR_SHARD_FIELD_RE = new RegExp(
  `^(?:${AGGREGATOR_PREFIXES.join("|")})-(?:${SHARD_INFIXES.join("|")})-(.+)$`
);

/**
 * The SEO field a posting belongs to, or null when it has none.
 *
 * The exact inverse of `fieldSlugConds`: per-field shards carry their field in
 * the slug, categorized buckets carry it in `category`, and every genuine ATS
 * board belongs to "it" — which is the rule that function's `it` branch
 * encodes. Keeping the two in one file is what stops a job's breadcrumb from
 * disagreeing with the page that lists it.
 *
 * Null when the posting's field has no page ("general", "graduate",
 * "government"): no field page lists it, so naming one would send the reader
 * somewhere it is absent. (The old slug-only version returned "it" here.)
 */
export function fieldForJob(job: {
  companySlug?: string | null;
  category?: string | null;
}): string | null {
  const slug = String(job.companySlug ?? "");
  if (CATEGORIZED_SOURCE_RE.test(slug)) {
    const category = String(job.category ?? "");
    return isSeoField(category) ? category : null;
  }
  const match = AGGREGATOR_SHARD_FIELD_RE.exec(slug);
  if (match) return isSeoField(match[1]) ? match[1] : null;
  return "it";
}

/**
 * Mongo `$or` conditions for "jobs in this field". Shared by the field and city
 * SEO pages, the job page's similar-roles block and the feed's field scoping.
 */
export function fieldSlugConds(field: string): Record<string, unknown>[] {
  const shards = AGGREGATOR_PREFIXES.flatMap((source) =>
    SHARD_INFIXES.map((infix) => ({ companySlug: `${source}-${infix}-${field}` }))
  );
  const categorized = { companySlug: CATEGORIZED_SOURCE_RE, category: field };
  if (field === "it") {
    // ATS boards are software/product companies, so they belong to IT — but only
    // the genuine ones, never an aggregator bucket of any kind.
    return [...shards, categorized, { companySlug: { $not: NON_COMPANY_SLUG_RE } }];
  }
  return [...shards, categorized];
}
