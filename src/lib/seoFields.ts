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

/**
 * Mongo `$or` conditions for "jobs in this field" — mirrors the feed's field
 * scoping. Aggregator shards are `<source>-in-<field>`; "it" also covers every
 * ATS board (software/product). Shared by the field and city SEO pages.
 */
export function fieldSlugConds(field: string): Record<string, unknown>[] {
  if (field === "it") {
    return [
      { companySlug: "adzuna-in-it" },
      { companySlug: "jooble-in-it" },
      { companySlug: { $not: /^(?:adzuna|jooble)-in-/ } },
    ];
  }
  return [{ companySlug: `adzuna-in-${field}` }, { companySlug: `jooble-in-${field}` }];
}
