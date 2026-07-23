import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateMatch, rankByMatch, type MatchProfile, type JobLike } from "./matchScore";

const jobs: (JobLike & { createdAt: string })[] = [
  { title: "Senior Frontend Engineer", tags: ["React", "TypeScript", "Next.js", "Engineering"], descriptionHtml: "React TypeScript Next.js", createdAt: "2026-07-01" },
  { title: "Staff Backend Engineer", tags: ["Go", "Kubernetes", "PostgreSQL"], descriptionHtml: "distributed systems in Go", createdAt: "2026-07-05" },
  { title: "Product Designer", tags: ["Figma", "UI/UX", "Design"], descriptionHtml: "design interfaces", createdAt: "2026-07-06" },
  { title: "Junior React Developer", tags: ["React", "JavaScript"], descriptionHtml: "entry level", createdAt: "2026-07-07" },
];

function rank(profile: MatchProfile) {
  const scored = jobs.map((j) => ({ title: j.title, createdAt: j.createdAt, ...calculateMatch(profile, j) }));
  return rankByMatch(scored.map((s) => ({ ...s, matchScore: s.score })));
}

test("senior frontend profile ranks the matching role first", () => {
  const ranked = rank({ skills: ["React", "TypeScript", "Next.js"], title: "Senior Frontend Engineer" });
  assert.equal(ranked[0].title, "Senior Frontend Engineer");
  assert.ok(ranked[0].matchScore > 85);
});

test("backend profile surfaces the backend role", () => {
  const ranked = rank({ skills: ["Go", "Kubernetes", "PostgreSQL"], title: "Staff Software Engineer" });
  assert.equal(ranked[0].title, "Staff Backend Engineer");
});

test("no resume yields a flat baseline in recency order", () => {
  const ranked = rank({ skills: [] });
  assert.ok(ranked.every((r) => r.matchScore === 70));
  assert.equal(ranked[0].title, "Junior React Developer"); // newest
});

test("scores are capped at 99", () => {
  const ranked = rank({ skills: ["React", "TypeScript", "Next.js"], title: "Senior Frontend Engineer" });
  assert.ok(ranked.every((r) => r.matchScore <= 99));
});

test("skill aliases match despite formatting (JS / NodeJS / Postgres)", () => {
  const profile = { skills: ["JavaScript", "Node.js", "PostgreSQL"] };
  const job = { title: "Backend Developer", tags: ["JS", "NodeJS", "Postgres"] };
  const res = calculateMatch(profile, job);
  assert.deepEqual(res.missingSkills, [], "all tags should match via aliases");
  assert.equal(res.matchingSkills.length, 3);
});

test("alias variants don't double-count in the skill breadth signal", () => {
  // "React" and "react.js" canonicalize to the same skill — the job tag matches,
  // but the extra resume variant must not inflate the score via description hits.
  const one = calculateMatch({ skills: ["React"] }, { title: "Frontend Dev", tags: ["React"], descriptionHtml: "react work" });
  const dup = calculateMatch({ skills: ["React", "react.js"] }, { title: "Frontend Dev", tags: ["React"], descriptionHtml: "react work" });
  assert.equal(one.score, dup.score, "duplicate alias of the same skill shouldn't change the score");
});

test("a fresher's profile treats entry roles as a fit, not 'below your level'", () => {
  const profile = { skills: ["React"], title: "B.Tech Student" };
  const res = calculateMatch(profile, { title: "Junior Frontend Developer", tags: ["React"] });
  assert.ok(
    !res.matchExplanation.some((e) => /below your current level/i.test(e)),
    "an entry role must not read as below a fresher's level",
  );
  assert.ok(
    res.matchExplanation.some((e) => /matches your level|close seniority/i.test(e)),
    "an entry role should read as a seniority fit for a fresher",
  );
});

test("non-tech domain alignment: a marketing background aligns with a marketing role", () => {
  const profile = { skills: ["x"], title: "Digital Marketing Executive" };
  const marketing = calculateMatch(profile, { title: "Brand Marketing Associate", tags: [] });
  const unrelated = calculateMatch(profile, { title: "Warehouse Associate", tags: [] });
  assert.ok(
    marketing.score > unrelated.score,
    `in-discipline role (${marketing.score}) should beat an unrelated one (${unrelated.score})`,
  );
  assert.ok(
    marketing.matchExplanation.some((e) => /domain alignment/i.test(e) && /marketing/i.test(e)),
    "a marketing role should explain its marketing-discipline alignment",
  );
});

test("word boundaries: 'ai' inside 'retail'/'email' no longer fakes a data/ML domain", () => {
  // Regression: substring matching credited "ai" inside "retAIl" and "emAIl",
  // wrongly aligning a retail-sales person with an email-marketing role on data/ML.
  const profile = { skills: ["x"], title: "Retail Sales Executive" };
  const res = calculateMatch(profile, { title: "Email Marketing Executive", tags: [] });
  assert.ok(
    !res.matchExplanation.some((e) => /domain alignment/i.test(e) && /data \/ ML/i.test(e)),
    "'ai' inside a word must not create a spurious data/ML alignment",
  );
});

test("eligibility ladder is monotonic: fresher > junior > 2yr > 3yr > 6yr", () => {
  const profile = { skills: ["React"] };
  const base = { title: "Frontend Engineer", tags: ["React"] };
  const s = (n: number) => calculateMatch(profile, { ...base, minExperience: n }).score;
  assert.ok(
    s(0) > s(1) && s(1) > s(2) && s(2) > s(3) && s(3) > s(6),
    `ladder should strictly decrease: ${[0, 1, 2, 3, 6].map(s).join(" > ")}`,
  );
});

test("experienced-required penalty scales with the years demanded", () => {
  const profile = { skills: ["React", "TypeScript"] };
  const base = { title: "Frontend Engineer", tags: ["React", "TypeScript"] };
  const y3 = calculateMatch(profile, { ...base, minExperience: 3 });
  const y10 = calculateMatch(profile, { ...base, minExperience: 10 });
  assert.ok(y10.score < y3.score, `a 10yr role (${y10.score}) should score below a 3yr role (${y3.score})`);
});

test("fresher-eligible roles rank above experience-heavy ones for the same profile", () => {
  const profile = { skills: ["React", "TypeScript"] };
  const base = { title: "Frontend Engineer", tags: ["React", "TypeScript"] };
  const fresher = calculateMatch(profile, { ...base, minExperience: 0 });
  const senior = calculateMatch(profile, { ...base, minExperience: 6 });
  assert.ok(fresher.score > senior.score, `fresher (${fresher.score}) > senior (${senior.score})`);
  assert.ok(fresher.matchExplanation.some((e) => /fresher-friendly/i.test(e)));
  assert.ok(senior.matchExplanation.some((e) => /stretch for a fresher/i.test(e)));
});
