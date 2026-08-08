import test from "node:test";
import assert from "node:assert";
import { analyzeResume } from "./resumeAnalyzer";
import { analyzeSkillGap } from "./skillGap";

const STRONG = `
Priya Sharma
priya.sharma@gmail.com | 9876543210 | linkedin.com/in/priyasharma | github.com/priyas

EDUCATION
B.Tech Computer Science, VIT Vellore, 2025

PROJECTS
- Built a campus event booking app used by 400+ students, cutting manual registration time by 70%
- Shipped a REST API handling 1200 requests per day with 99.9% uptime
- Automated attendance reporting, saving the department 6 hours each week

SKILLS
JavaScript, React, Node.js, MongoDB, Git, Python
`;

const WEAK = `
CURRICULUM VITAE
Rahul Kumar
Date of Birth: 12/04/2003
Father's Name: Suresh Kumar
Marital Status: Single

OBJECTIVE
I am a hard working team player and quick learner. I am passionate about technology.

EXPERIENCE
- Responsible for the website
- Worked on various tasks
- Helped with testing
`;

const find = (a: ReturnType<typeof analyzeResume>, id: string) => a.findings.find((f) => f.id === id);

test("a strong résumé scores well and its findings are not padded", () => {
  const a = analyzeResume({
    text: STRONG,
    skills: ["JavaScript", "React", "Node.js", "MongoDB", "Git", "Python"],
    experience: [{ role: "Event app", company: "Personal Project" }, { role: "REST API", company: "Personal Project" }],
    education: ["B.Tech CS, VIT Vellore, 2025"],
  });
  assert.ok(a.score >= 80, `expected a strong score, got ${a.score}`);
  assert.equal(a.band, "strong");
  assert.equal(find(a, "no-email"), undefined);
  assert.equal(find(a, "low-quantification"), undefined, "quantified bullets must not be flagged");
  assert.ok(a.strengths.length > 0);
});

test("a weak résumé is scored down and every problem is caught", () => {
  const a = analyzeResume({ text: WEAK, skills: [], experience: [], education: [] });
  assert.ok(a.score < 55, `expected a low score, got ${a.score}`);
  assert.equal(a.band, "needs-work");
  for (const id of ["no-email", "no-skills", "weak-openers", "filler-phrases", "personal-details"]) {
    assert.ok(find(a, id), `expected finding "${id}"`);
  }
});

test("Indian résumé conventions that hurt the candidate are named explicitly", () => {
  const f = find(analyzeResume({ text: WEAK }), "personal-details");
  assert.ok(f);
  // The value is naming exactly what to delete, not "remove personal info".
  for (const label of ["date of birth", "marital status", "father's name"]) {
    assert.ok(f!.title.includes(label), `should name "${label}": ${f!.title}`);
  }
});

test("every finding carries an actionable fix, not just a complaint", () => {
  for (const a of [analyzeResume({ text: WEAK }), analyzeResume({ text: STRONG, skills: ["React"] })]) {
    for (const f of a.findings) {
      assert.ok(f.fix.length > 25, `finding "${f.id}" needs a real fix, got: ${f.fix}`);
      assert.ok(f.detail.length > 25, `finding "${f.id}" needs to explain the cost`);
    }
  }
});

test("findings point at the offending lines so they can be found instantly", () => {
  const f = find(analyzeResume({ text: WEAK }), "weak-openers");
  assert.ok(f?.evidence && f.evidence.length > 0, "weak openers must quote the bullets");
  assert.ok(f!.evidence!.some((e) => /responsible for/i.test(e)));
});

test("findings are ordered worst-first", () => {
  const costs = { critical: 3, important: 2, polish: 1 } as const;
  const sev = analyzeResume({ text: WEAK }).findings.map((f) => costs[f.severity]);
  assert.deepEqual(sev, [...sev].sort((a, b) => b - a), "critical issues must lead");
});

test("scoring is deterministic", () => {
  const run = () => analyzeResume({ text: WEAK, skills: [] }).score;
  assert.equal(run(), run());
});

test("an empty résumé degrades without throwing", () => {
  const a = analyzeResume({ text: "" });
  assert.ok(a.score >= 0 && a.score <= 100);
  assert.ok(Array.isArray(a.findings));
});

test("quantification detects Indian-format figures", () => {
  const a = analyzeResume({
    text: "- Increased revenue by ₹5 lakh across 3 months for the college fest committee team\n",
  });
  assert.equal(find(a, "low-quantification"), undefined, "₹ and lakh must count as quantified");
});

// --- Market-grounded skill gap -------------------------------------------

const MARKET = [
  { tags: ["it", "React", "TypeScript"] },
  { tags: ["it", "React", "Node.js"] },
  { tags: ["it", "TypeScript", "AWS"] },
  { tags: ["it", "Python", "SQL"] },
  { tags: ["it", "Python", "SQL"] },
];

test("skill gap counts real listings, not keyword popularity", () => {
  const gap = analyzeSkillGap(["React"], MARKET);
  assert.equal(gap.sampleSize, 5);
  assert.equal(gap.reachable, 2, "React appears in exactly 2 listings");
  assert.equal(gap.coverage, 40);
});

test("an opportunity only counts listings the candidate cannot already reach", () => {
  // TypeScript appears in 2 listings, but one of them already matches on React,
  // so learning it unlocks exactly 1 additional listing — not 2.
  const gap = analyzeSkillGap(["React"], MARKET);
  const ts = gap.opportunities.find((o) => o.skill === "typescript");
  assert.equal(ts?.jobsUnlocked, 1, "must not credit jobs already reachable");
});

test("the biggest unlock ranks first", () => {
  const gap = analyzeSkillGap(["React"], MARKET);
  // python and sql each appear in 2 unreachable listings.
  assert.ok(["python", "sql"].includes(gap.opportunities[0].skill), gap.opportunities[0].skill);
  assert.equal(gap.opportunities[0].jobsUnlocked, 2);
});

test("category tags are never suggested as skills to learn", () => {
  const gap = analyzeSkillGap([], MARKET);
  assert.ok(!gap.opportunities.some((o) => o.skill === "it"), "\"it\" is a category, not a skill");
});

test("aliases collapse so JS and JavaScript are one skill", () => {
  const gap = analyzeSkillGap(["JS"], [{ tags: ["JavaScript"] }]);
  assert.equal(gap.reachable, 1, "JS must match JavaScript");
});

test("skills the candidate has are validated against real demand", () => {
  const gap = analyzeSkillGap(["React", "COBOL"], MARKET);
  assert.equal(gap.validatedSkills[0].skill, "react");
  assert.ok(!gap.validatedSkills.some((s) => s.skill === "cobol"), "zero-demand skills are not claimed as validated");
});

test("an empty market does not divide by zero", () => {
  const gap = analyzeSkillGap(["React"], []);
  assert.equal(gap.coverage, 0);
  assert.deepEqual(gap.opportunities, []);
});
