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

test("fresher-eligible roles rank above experience-heavy ones for the same profile", () => {
  const profile = { skills: ["React", "TypeScript"] };
  const base = { title: "Frontend Engineer", tags: ["React", "TypeScript"] };
  const fresher = calculateMatch(profile, { ...base, minExperience: 0 });
  const senior = calculateMatch(profile, { ...base, minExperience: 6 });
  assert.ok(fresher.score > senior.score, `fresher (${fresher.score}) > senior (${senior.score})`);
  assert.ok(fresher.matchExplanation.some((e) => /fresher-friendly/i.test(e)));
  assert.ok(senior.matchExplanation.some((e) => /stretch for a fresher/i.test(e)));
});
