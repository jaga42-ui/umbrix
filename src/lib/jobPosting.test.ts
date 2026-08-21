import { test } from "node:test";
import assert from "node:assert/strict";
import { titleSlug, jobPath, parseJobId } from "./jobUrl";
import { parseJobLocation, citySlugFor } from "./jobLocation";
import { serializeJsonLd } from "./jsonLd";
import {
  buildJobPostingJsonLd,
  validThroughFor,
  employmentTypeFor,
  isDirectApply,
  hiringOrganizationName,
  datePostedFor,
  type JobPostingSource,
} from "./jobPosting";

const NOW = new Date("2026-08-20T00:00:00Z");
const ID = "6512ab34cd56ef7890123456";

function job(overrides: Partial<JobPostingSource> = {}): JobPostingSource {
  return {
    _id: ID,
    title: "Software Engineer",
    companyName: "Acme Corp",
    companySlug: "acme",
    location: "Bengaluru, Karnataka",
    descriptionHtml: "<p>Build things.</p>",
    applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
    type: "job",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    lastSeenAt: new Date("2026-08-19T00:00:00Z"),
    ...overrides,
  };
}

// ── URLs ────────────────────────────────────────────────────────────────────

test("titleSlug: kebab-cases and strips punctuation", () => {
  assert.equal(titleSlug("Software Engineer (Fresher)"), "software-engineer-fresher");
  assert.equal(titleSlug("  Data  Analyst — 2026  "), "data-analyst-2026");
});

test("titleSlug: never ends mid-word when truncating", () => {
  const long = titleSlug("Senior Principal Distinguished Staff Software Engineer Backend Platform Infrastructure");
  assert.ok(long.length <= 70);
  assert.ok(!long.endsWith("-"), "slug must not end with a separator");
});

test("titleSlug: a title with no Latin characters slugifies to empty", () => {
  assert.equal(titleSlug("सॉफ्टवेयर"), "");
});

test("jobPath: falls back to the bare id when the title slugifies to nothing", () => {
  assert.equal(jobPath({ _id: ID, title: "Software Engineer" }), `/job/software-engineer-${ID}`);
  assert.equal(jobPath({ _id: ID, title: "सॉफ्टवेयर" }), `/job/${ID}`);
});

test("parseJobId: round-trips the id out of a generated path", () => {
  const path = jobPath({ _id: ID, title: "Backend Engineer, Payments" });
  assert.equal(parseJobId(path.replace("/job/", "")), ID);
});

test("parseJobId: rejects anything that is not an ObjectId", () => {
  // The page must 404 rather than pass an attacker-controlled string to Mongo.
  assert.equal(parseJobId("software-engineer"), null);
  assert.equal(parseJobId("job-'; drop collection --"), null);
  assert.equal(parseJobId(""), null);
  assert.equal(parseJobId("engineer-6512ab34cd56ef789012345"), null, "23 chars is not an ObjectId");
});

// ── Location parsing ────────────────────────────────────────────────────────

test("parseJobLocation: splits city and state", () => {
  const p = parseJobLocation("Bengaluru, Karnataka");
  assert.equal(p.locality, "Bengaluru");
  assert.equal(p.region, "Karnataka");
  assert.equal(p.citySlug, "bengaluru");
  assert.equal(p.isRemote, false);
});

test("parseJobLocation: strips a trailing country", () => {
  const p = parseJobLocation("Hyderabad, Telangana, India");
  assert.equal(p.locality, "Hyderabad");
  assert.equal(p.region, "Telangana");
});

test("parseJobLocation: country-wide strings yield no locality", () => {
  // "Pan India" in a PostalAddress is not an address — better to omit it.
  for (const raw of ["Pan India", "India", "Multiple Locations"]) {
    assert.equal(parseJobLocation(raw).locality, undefined, `${raw} must not become a city`);
  }
});

test("parseJobLocation: detects remote and never uses it as the city name", () => {
  const p = parseJobLocation("Remote, Bengaluru");
  assert.equal(p.isRemote, true);
  assert.equal(p.locality, "Bengaluru");
  assert.equal(parseJobLocation("Remote").locality, undefined);
});

test("parseJobLocation: collapses a repeated city/region", () => {
  assert.equal(parseJobLocation("Pune, Pune").region, undefined);
});

test("citySlugFor: matches alternate spellings the city pages already use", () => {
  assert.equal(citySlugFor("Bangalore"), "bengaluru");
  assert.equal(citySlugFor("Gurugram, Haryana"), "gurgaon");
  assert.equal(citySlugFor("Reykjavik"), undefined);
});

// ── validThrough ────────────────────────────────────────────────────────────

test("validThroughFor: is always in the future, even for a long-open posting", () => {
  // The failure this guards: a role posted months ago but still confirmed live.
  // Dating expiry from datePosted would emit a past validThrough on a 200 page,
  // which Google treats as a policy violation.
  const old = job({
    postedAt: new Date("2025-01-01T00:00:00Z"),
    createdAt: new Date("2025-01-01T00:00:00Z"),
    lastSeenAt: new Date("2025-02-01T00:00:00Z"),
  });
  assert.ok(validThroughFor(old, NOW) > NOW, "validThrough must never be in the past");
});

test("validThroughFor: tracks the last confirmed sighting", () => {
  const v = validThroughFor(job({ lastSeenAt: new Date("2026-08-19T00:00:00Z") }), NOW);
  assert.equal(v.toISOString(), "2026-09-18T00:00:00.000Z");
});

test("datePostedFor: prefers the source's posted date over our ingest date", () => {
  const d = datePostedFor(job({ postedAt: new Date("2026-07-04T00:00:00Z") }));
  assert.equal(d.toISOString(), "2026-07-04T00:00:00.000Z");
  // Falls back when the source never supplied one.
  assert.equal(
    datePostedFor(job({ postedAt: null })).toISOString(),
    "2026-08-01T00:00:00.000Z"
  );
});

// ── Field mapping ───────────────────────────────────────────────────────────

test("employmentTypeFor: internships map to INTERN by either field", () => {
  assert.equal(employmentTypeFor(job({ type: "internship" })), "INTERN");
  assert.equal(employmentTypeFor(job({ type: "job", roleType: "internship" })), "INTERN");
  assert.equal(employmentTypeFor(job({ roleType: "part-time" })), "PART_TIME");
  assert.equal(employmentTypeFor(job({ roleType: "contract" })), "CONTRACTOR");
  assert.equal(employmentTypeFor(job()), "FULL_TIME");
});

test("isDirectApply: false for aggregator shards that redirect", () => {
  assert.equal(isDirectApply(job({ companySlug: "acme" })), true);
  assert.equal(isDirectApply(job({ companySlug: "adzuna-in-it" })), false);
  assert.equal(isDirectApply(job({ companySlug: "careerjet-fresher-sales" })), false);
});

test("hiringOrganizationName: never exposes an aggregator shard slug", () => {
  assert.equal(hiringOrganizationName(job({ companyName: "Acme Corp" })), "Acme Corp");
  assert.equal(hiringOrganizationName(job({ companyName: undefined, companySlug: "zoho" })), "Zoho");
  assert.equal(
    hiringOrganizationName(job({ companyName: undefined, companySlug: "adzuna-in-it" })),
    "Hiring company"
  );
});

// ── Whole document ──────────────────────────────────────────────────────────

test("buildJobPostingJsonLd: emits the properties Google requires", () => {
  const ld = buildJobPostingJsonLd(job(), { url: "https://www.umbrix.in/job/x", now: NOW });
  for (const required of ["title", "description", "datePosted", "hiringOrganization", "jobLocation"]) {
    assert.ok(ld[required], `missing required property ${required}`);
  }
  assert.equal(ld["@type"], "JobPosting");
  assert.deepEqual(ld.identifier, { "@type": "PropertyValue", name: "Umbrix", value: ID });
});

test("buildJobPostingJsonLd: never fabricates salary, logo or company URL", () => {
  // Umbrix stores none of these. Emitting them would be inaccurate structured
  // data, which Google penalizes harder than omission.
  const ld = buildJobPostingJsonLd(job(), { url: "https://www.umbrix.in/job/x", now: NOW });
  assert.equal(ld.baseSalary, undefined);
  const org = ld.hiringOrganization as Record<string, unknown>;
  assert.equal(org.logo, undefined);
  assert.equal(org.sameAs, undefined);
});

test("buildJobPostingJsonLd: remote roles are marked TELECOMMUTE", () => {
  const ld = buildJobPostingJsonLd(job({ location: "Remote" }), {
    url: "https://www.umbrix.in/job/x",
    now: NOW,
  });
  assert.equal(ld.jobLocationType, "TELECOMMUTE");
  assert.equal(ld.jobLocation, undefined, "no address to give for a city-less remote role");
});

test("buildJobPostingJsonLd: fresher roles state zero months of experience", () => {
  const ld = buildJobPostingJsonLd(job({ minExperience: 0 }), {
    url: "https://www.umbrix.in/job/x",
    now: NOW,
  });
  assert.deepEqual(ld.experienceRequirements, {
    "@type": "OccupationalExperienceRequirements",
    monthsOfExperience: 0,
  });
});

test("buildJobPostingJsonLd: omits experience when neither pass could determine it", () => {
  const ld = buildJobPostingJsonLd(job({ minExperience: undefined }), {
    url: "https://www.umbrix.in/job/x",
    now: NOW,
  });
  assert.equal(ld.experienceRequirements, undefined);
});

// ── Serialization safety ────────────────────────────────────────────────────

test("serializeJsonLd: a hostile job title cannot break out of the script tag", () => {
  // Titles and descriptions come from third-party ATS feeds, so this is a real
  // stored-XSS vector, not a theoretical one.
  const ld = buildJobPostingJsonLd(
    job({ title: `Engineer</script><img src=x onerror=alert(1)>` }),
    { url: "https://www.umbrix.in/job/x", now: NOW }
  );
  const out = serializeJsonLd(ld);
  assert.ok(!out.includes("</script>"), "must not contain a literal closing script tag");
  assert.ok(!out.includes("<img"), "must not contain raw markup");
  // Still valid JSON that a crawler can parse.
  assert.equal((JSON.parse(out) as { title: string }).title, "Engineer</script><img src=x onerror=alert(1)>");
});

test("serializeJsonLd: escapes JS line terminators that are legal in JSON", () => {
  const out = serializeJsonLd({ t: `a${String.fromCharCode(0x2028)}b` });
  assert.ok(out.includes("\\u2028"));
  assert.equal(JSON.parse(out).t, `a${String.fromCharCode(0x2028)}b`);
});
