import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldForJob, fieldSlugConds, isAggregatorSlug, SEO_FIELDS } from "./seoFields";

interface Doc {
  companySlug: string;
  category?: string | null;
}

/**
 * Evaluate one `fieldSlugConds` condition against a document, in memory.
 * Covers exactly the three shapes that function emits — equality on the slug,
 * a regex slug plus category, and `$not` regex — so a new shape fails loudly
 * here instead of being silently treated as a match.
 */
function matches(cond: Record<string, unknown>, doc: Doc): boolean {
  return Object.entries(cond).every(([key, want]) => {
    const have = (doc as unknown as Record<string, unknown>)[key];
    if (typeof want === "string") return have === want;
    if (want instanceof RegExp) return want.test(String(have ?? ""));
    if (want && typeof want === "object" && "$not" in want) {
      return !(want.$not as RegExp).test(String(have ?? ""));
    }
    throw new Error(`unhandled condition shape for ${key}`);
  });
}

const listedUnder = (doc: Doc) =>
  SEO_FIELDS.filter((f) => fieldSlugConds(f).some((c) => matches(c, doc)));

const DOCS: Doc[] = [
  { companySlug: "hpe" },
  { companySlug: "adzuna-in-it" },
  { companySlug: "adzuna-in-sales" },
  { companySlug: "careerjet-fresher-hr" },
  { companySlug: "jooble-in-graduate" },
  { companySlug: "unstop-jobs", category: "sales" },
  { companySlug: "unstop-jobs", category: "it" },
  { companySlug: "unstop-internships", category: "marketing" },
  { companySlug: "unstop-jobs", category: "general" },
  { companySlug: "unstop-jobs", category: null },
  { companySlug: "jsearch-internship", category: "creative" },
  { companySlug: "serpapi-fresher-it", category: "healthcare" },
];

test("a posting is listed under a field page exactly when fieldForJob names it", () => {
  // The breadcrumb on a job page and the field pages that list it must agree,
  // or the breadcrumb links somewhere the job is absent.
  for (const doc of DOCS) {
    const field = fieldForJob(doc);
    assert.deepEqual(listedUnder(doc), field ? [field] : [], JSON.stringify(doc));
  }
});

test("categorized buckets are classified by category, never swept into IT", () => {
  // Measured 2026-10-03: 67% of /jobs/it was Unstop, mostly sales and HR roles.
  assert.deepEqual(listedUnder({ companySlug: "unstop-jobs", category: "sales" }), ["sales"]);
  assert.equal(fieldForJob({ companySlug: "unstop-jobs", category: "sales" }), "sales");
  // A slug that names a field is only the connector's search query.
  assert.equal(fieldForJob({ companySlug: "serpapi-fresher-it", category: "healthcare" }), "healthcare");
});

test("postings whose field has no page are listed nowhere and get no field", () => {
  assert.equal(fieldForJob({ companySlug: "unstop-jobs", category: "general" }), null);
  assert.equal(fieldForJob({ companySlug: "unstop-jobs" }), null);
  assert.equal(fieldForJob({ companySlug: "jooble-in-graduate" }), null);
});

test("genuine company boards still belong to IT", () => {
  assert.equal(fieldForJob({ companySlug: "phonepe" }), "it");
  assert.deepEqual(listedUnder({ companySlug: "phonepe" }), ["it"]);
});

test("every aggregator bucket is recognised as not-a-company", () => {
  // Drives the JobPosting `directApply` claim and the employer-name fallback.
  for (const slug of ["adzuna-in-it", "careerjet-fresher-sales", "unstop-jobs", "jsearch-internship", "serpapi-fresher-general"]) {
    assert.equal(isAggregatorSlug(slug), true, slug);
  }
  for (const slug of ["hpe", "phonepe", "unstoppable-domains"]) {
    assert.equal(isAggregatorSlug(slug), false, slug);
  }
});
