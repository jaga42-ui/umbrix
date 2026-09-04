import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCitySnapshot,
  isSkillTag,
  toProseList,
  type SnapshotJob,
} from "./citySnapshot";

const NOW = new Date("2026-09-04T00:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function job(over: Partial<SnapshotJob> = {}): SnapshotJob {
  return {
    _id: Math.random(),
    title: "Software Engineer",
    companyName: "Acme",
    createdAt: daysAgo(1),
    type: "job",
    tags: ["Python"],
    ...over,
  };
}

test("aggregator category tags are not reported as requested skills", () => {
  // extractTags seeds the array with the adapter's raw department, so these
  // arrive mixed in with real skills.
  assert.equal(isSkillTag("IT Jobs"), false);
  assert.equal(isSkillTag("Hospitality & Catering Jobs"), false);
  assert.equal(isSkillTag("PR, Advertising & Marketing Jobs"), false);
  assert.equal(isSkillTag("Python"), true);
  assert.equal(isSkillTag("AWS"), true);
  // "Jobs" only counts as a category suffix at the end of the tag.
  assert.equal(isSkillTag("Jobs Board Tooling"), true);
});

test("bare field slugs from the raw department are not skills", () => {
  // extractTags pushes job.department verbatim, so "it" arrives as a tag on
  // every IT posting — the least differentiating string possible on /jobs/it/*.
  assert.equal(isSkillTag("it"), false);
  assert.equal(isSkillTag("marketing"), false);
  assert.equal(isSkillTag("healthcare"), false);
  // The catch-all category is the one that actually reached production copy:
  // /jobs/it/pune listed "general" among its most-mentioned skills.
  assert.equal(isSkillTag("general"), false);
  assert.equal(isSkillTag("scholarship"), false);
});

test("keywords the tagger cannot tell from ordinary English are dropped", () => {
  // The matcher is word-boundary based, so "Go" hits the verb and put
  // "AI and Go" on a marketing page. Better to say less than to say wrong.
  assert.equal(isSkillTag("Go"), false);
  assert.equal(isSkillTag("Swift"), false);
  assert.equal(isSkillTag("Rust"), false);
  assert.equal(isSkillTag("Ruby"), false);
  // Unambiguous ones survive.
  assert.equal(isSkillTag("Python"), true);
  assert.equal(isSkillTag("Kubernetes"), true);
  assert.equal(isSkillTag("Machine Learning"), true);
});

test("skills and employers rank by frequency, commonest first", () => {
  const snap = buildCitySnapshot(
    [
      job({ tags: ["Python", "AWS"], companyName: "Infosys" }),
      job({ tags: ["Python"], companyName: "Infosys" }),
      job({ tags: ["Python", "Java"], companyName: "TCS" }),
      job({ tags: ["AWS"], companyName: "Infosys" }),
    ],
    4,
    NOW
  );
  assert.equal(snap.skills[0], "Python");
  assert.equal(snap.skills[1], "AWS");
  assert.equal(snap.employers[0], "Infosys");
  assert.deepEqual(snap.employers.slice(0, 2), ["Infosys", "TCS"]);
});

test("the headline total is the caller's count, not the sample size", () => {
  // The page counts the whole slice in Mongo but only samples rows for ranking.
  const snap = buildCitySnapshot([job(), job()], 247, NOW);
  assert.equal(snap.total, 247);
});

test("added-this-week counts only the last 7 days, measured from the injected clock", () => {
  const snap = buildCitySnapshot(
    [
      job({ createdAt: daysAgo(0) }),
      job({ createdAt: daysAgo(6) }),
      job({ createdAt: daysAgo(8) }),
      job({ createdAt: daysAgo(60) }),
    ],
    4,
    NOW
  );
  assert.equal(snap.addedLastWeek, 2);
});

test("internships are counted separately from full-time roles", () => {
  const snap = buildCitySnapshot(
    [job({ type: "internship" }), job({ type: "internship" }), job({ type: "job" })],
    3,
    NOW
  );
  assert.equal(snap.internships, 2);
});

test("synthetic aggregator company slugs never surface as employers", () => {
  // "adzuna-in-it" is a field bucket, not a company.
  const snap = buildCitySnapshot(
    [
      job({ companyName: null, companySlug: "adzuna-in-it" }),
      job({ companyName: null, companySlug: "jooble-in-finance" }),
      job({ companyName: "Zoho" }),
    ],
    3,
    NOW
  );
  assert.deepEqual(snap.employers, ["Zoho"]);
});

test("missing and malformed fields degrade quietly rather than throwing", () => {
  const snap = buildCitySnapshot(
    [
      { _id: 1, title: "A" },
      { _id: 2, title: "B", tags: null, createdAt: null, type: null },
      { _id: 3, title: "C", createdAt: "not-a-date", tags: ["Docker"] },
    ],
    3,
    NOW
  );
  assert.equal(snap.total, 3);
  assert.equal(snap.addedLastWeek, 0);
  assert.deepEqual(snap.skills, ["Docker"]);
});

test("an empty slice yields empty lists, so the page can omit the block", () => {
  const snap = buildCitySnapshot([], 0, NOW);
  assert.deepEqual(snap.skills, []);
  assert.deepEqual(snap.employers, []);
  assert.equal(snap.total, 0);
});

test("prose lists read naturally and collapse to nothing when empty", () => {
  assert.equal(toProseList([]), "");
  assert.equal(toProseList(["Python"]), "Python");
  assert.equal(toProseList(["Python", "AWS"]), "Python and AWS");
  assert.equal(toProseList(["Python", "AWS", "Java"]), "Python, AWS and Java");
});
