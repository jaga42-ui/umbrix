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

/** The fields that get a /jobs/<field> SEO page. */
export const SEO_FIELDS = Object.keys(FIELD_LABELS);

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
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
 * Mongo `$or` conditions for "jobs in this field" — mirrors the feed's field
 * scoping. Shared by the field and city SEO pages.
 */
export function fieldSlugConds(field: string): Record<string, unknown>[] {
  const shards = AGGREGATOR_PREFIXES.flatMap((source) =>
    SHARD_INFIXES.map((infix) => ({ companySlug: `${source}-${infix}-${field}` }))
  );
  if (field === "it") {
    // ATS boards are software/product companies, so they belong to IT — but only
    // the genuine ones, not another aggregator's non-IT shard.
    return [...shards, { companySlug: { $not: AGGREGATOR_SHARD_RE } }];
  }
  return shards;
}
