import test from "node:test";
import assert from "node:assert";
import { detectEvidence, detectAll, weakestBullet } from "./detector";
import { xray } from "./xray";
import { evidencedSkills, unevidencedSkills, type CareerProfile } from "./types";

// --- Evidence detector ----------------------------------------------------

test("the evidence ladder climbs as a bullet gains proof", () => {
  // The spec's own worked example, strengthened one component at a time.
  assert.equal(detectEvidence("Responsible for the company website.").strength, 1, "bare claim");
  assert.equal(detectEvidence("Built a React application.").strength, 2, "specific activity");
  assert.equal(detectEvidence("Built a React application with 8 modules.").strength, 3, "technical evidence");
  assert.equal(
    detectEvidence("Built a React application serving 500 users, reducing signup time by 40%.").strength,
    4,
    "measured outcome"
  );
  assert.equal(
    detectEvidence("Built a React application at https://x.vercel.app, reducing signup time by 40%.").strength,
    5,
    "measured and externally verifiable"
  );
});

test("the ladder is monotonic — adding evidence never lowers a level", () => {
  const steps = [
    "Worked on the platform.",
    "Built the platform.",
    "Built the platform using Node.js.",
    "Built the platform using Node.js across 8 modules.",
    "Built the platform using Node.js, reducing manual entry by 60%.",
  ].map((t) => detectEvidence(t).strength);
  for (let i = 1; i < steps.length; i++) {
    assert.ok(steps[i] >= steps[i - 1], `step ${i} regressed: ${steps.join(",")}`);
  }
});

test("scope and result are not confused — a count is not an outcome", () => {
  const scoped = detectEvidence("Built an app with 8 modules.");
  assert.ok(scoped.scope, "8 modules is scope");
  assert.equal(scoped.result, undefined, "a count alone is not a measured outcome");

  const measured = detectEvidence("Automated reporting, saving 6 hours per week.");
  assert.ok(measured.result, "a stated saving is a result");
});

test("technologies match whole words only", () => {
  // "AI" inside "trainee" once tagged every fresher posting with machine learning.
  assert.deepEqual(detectEvidence("Graduate trainee, available immediately.").technologies, []);
  assert.ok(detectEvidence("Trained a model with PyTorch.").technologies.includes("pytorch"));
});

test("non-technical work is read as evidence too", () => {
  // A tech-only verb list would score most Umbrix users as evidence-free.
  const b = detectEvidence("Counselled 40 patients weekly, reducing readmissions by 15%.");
  assert.ok(b.action, "counselled is an action");
  assert.ok(b.result, "a 15% reduction is a result");
  assert.ok(b.strength >= 4);
});

test("prompts ask for facts and never supply them", () => {
  const b = detectEvidence("Developed an emergency blood donation platform using React and Node.js.");
  assert.equal(b.result, undefined, "no outcome stated");
  assert.ok(b.prompts.length > 0);
  for (const p of b.prompts) {
    assert.ok(p.trim().endsWith("?"), `prompt must be a question: "${p}"`);
    // A prompt containing a figure would be proposing an achievement.
    assert.ok(!/\d+\s*(%|users|hours)/.test(p), `prompt must not suggest a metric: "${p}"`);
  }
});

test("missing components are reported precisely", () => {
  const b = detectEvidence("Built a dashboard using React.");
  assert.ok(!b.missing.includes("action"));
  assert.ok(!b.missing.includes("technology"));
  assert.ok(b.missing.includes("result"));
});

test("detection is deterministic and preserves order", () => {
  const input = ["Built X using React.", "Led a team of 4."];
  assert.deepEqual(detectAll(input), detectAll(input));
  assert.equal(detectAll(input)[1].text, "Led a team of 4.");
});

test("bullet markers are stripped before analysis", () => {
  assert.equal(detectEvidence("- Built an API using Node.js.").action?.toLowerCase(), "built");
});

test("weakestBullet prefers the longest of equally weak bullets", () => {
  const weak = detectAll(["The system.", "A much longer sentence that still proves absolutely nothing at all."]);
  assert.ok(weakestBullet(weak)!.text.length > 20, "a long weak bullet wastes the most space");
});

// --- Career profile -------------------------------------------------------

function profile(over: Partial<CareerProfile> = {}): CareerProfile {
  return {
    identity: { name: "A", email: "a@b.com", phone: "9876543210", links: [{ label: "GitHub", url: "https://github.com/a" }], headline: "Fresher" },
    items: [
      {
        id: "1", kind: "project", title: "Blood donation platform", source: "user", confidence: 1,
        skills: [], bullets: detectAll(["Built a matching service using Node.js and MongoDB, cutting search time by 30%."]),
      },
      { id: "2", kind: "education", title: "B.Tech IT", source: "user", confidence: 1, skills: [], bullets: [] },
    ],
    declaredSkills: ["Node.js", "MongoDB", "React"],
    targetFields: ["it"],
    ...over,
  };
}

test("declared skills without a supporting bullet are surfaced", () => {
  const p = profile();
  assert.ok(evidencedSkills(p).includes("node.js"));
  // React is listed but never demonstrated — exactly the weakness to surface.
  assert.deepEqual(unevidencedSkills(p), ["React"]);
});

// --- X-Ray ----------------------------------------------------------------

test("every dimension explains itself and stays in range", () => {
  for (const d of xray(profile()).dimensions) {
    assert.ok(d.score >= 0 && d.score <= 100, `${d.id} out of range: ${d.score}`);
    assert.ok(d.what.length > 20, `${d.id} must say what it measures`);
    assert.ok(/\d/.test(d.why), `${d.id} must show the arithmetic: "${d.why}"`);
  }
});

test("a dimension is only a strength when there is nothing left to do", () => {
  for (const s of xray(profile()).strengths) {
    assert.equal(s.how, null, `${s.id} claimed as a strength but still has an action`);
  }
});

test("opportunities are ordered worst-first", () => {
  const scores = xray(profile({ declaredSkills: [], targetFields: [] })).opportunities.map((d) => d.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
});

test("impact clarity counts only bullets with a stated outcome", () => {
  const p = profile({
    items: [{
      id: "1", kind: "project", title: "P", source: "user", confidence: 1, skills: [],
      bullets: detectAll(["Built an app using React.", "Cut load time by 40%."]),
    }],
  });
  const impact = xray(p).dimensions.find((d) => d.id === "impact-clarity")!;
  assert.equal(impact.score, 50, "1 of 2 bullets measured");
});

test("no target role scores role alignment at zero and says why", () => {
  const d = xray(profile({ targetFields: [] })).dimensions.find((x) => x.id === "role-alignment")!;
  assert.equal(d.score, 0);
  assert.ok(d.how, "must tell the user how to fix it");
});

test("an empty profile degrades without throwing", () => {
  const empty: CareerProfile = { identity: { links: [] }, items: [], declaredSkills: [], targetFields: [] };
  const result = xray(empty);
  assert.equal(result.dimensions.length, 7);
  assert.ok(result.overall >= 0 && result.overall <= 100);
});
