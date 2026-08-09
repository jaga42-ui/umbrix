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

// --- Document reconstruction ----------------------------------------------

import { reconstruct, reconstructBullets } from "./reconstruct";

// A PDF stores visual lines, so this is what a wrapped bullet actually looks
// like coming out of the text layer. Taken from a real résumé.
const WRAPPED = `GURUPRASAD JENA
PROJECTS
GetFreeToolsAI | Production Tool Platform
Tech Stack: Next.js, React, Tailwind CSS
• Designed, built, and launched a production platform with 70+ browser-based tools covering PDF, image, calculator, and
developer utilities, all processed entirely client-side via WebAssembly so user files never leave their device.
• Engineered each tool as an isolated client-side module with lazy-loaded WebAssembly bundles, keeping initial page load
under 2 seconds while supporting heavy operations.`;

test("wrapped bullets are rejoined into whole sentences", () => {
  const doc = reconstruct(WRAPPED);
  assert.equal(doc.bullets.length, 2, "two bullets, not four lines");
  // The regression that started this: the figure lives on the continuation line.
  assert.ok(doc.bullets[1].includes("under 2 seconds"), doc.bullets[1]);
});

test("the truncation bug does not return: evidence on line two is seen", () => {
  // Splitting on newlines reported "0 of 8 bullets quantified" for a résumé
  // that plainly stated its numbers, because every figure was on a wrapped line.
  const measured = detectAll(reconstruct(WRAPPED).bullets).filter((b) => b.result || b.scope);
  assert.ok(measured.length >= 2, `expected figures to survive reflow, got ${measured.length}`);
});

test("ALL-CAPS headings split sections and are not treated as content", () => {
  const doc = reconstruct(WRAPPED);
  assert.ok(doc.headings.includes("PROJECTS"));
  assert.ok(!doc.bullets.some((b) => b === "PROJECTS"));
});

test("labelled lists are kept out of the bullet stream", () => {
  assert.ok(!reconstruct(WRAPPED).bullets.some((b) => /^Tech Stack:/.test(b)));
});

test("scope survives adjectives between the figure and its noun", () => {
  // Real résumés write "70+ browser-based tools", not "70 tools".
  assert.ok(detectEvidence("Shipped 70+ browser-based tools.").scope, "adjectives must not break scope detection");
});

test("a résumé with no markers still yields bullets", () => {
  const prose = "SUMMARY\nBuilt an internal dashboard used by the operations team every day.\nLed the migration to a new database.";
  assert.ok(reconstructBullets(prose).length >= 1, "prose résumés must not analyse as empty");
});

test("an unreadable document is flagged rather than reported as empty", () => {
  const doc = reconstruct("   \n \n");
  assert.equal(doc.lowConfidence, true, "no headings and no bullets means extraction failed");
});

// --- Résumé document ------------------------------------------------------

import {
  buildDocument, moveSection, moveItem, toggleSection, removeItem, addItem,
  resolveDocument, unusedItems, isFresher,
} from "./document";
import { toCareerProfile } from "./adapt";

const fresherProfile: CareerProfile = {
  identity: { name: "A", email: "a@b.com", links: [], summary: "Fresher." },
  items: [
    { id: "p1", kind: "project", title: "Sahayam", source: "user", confidence: 1, skills: [], bullets: detectAll(["Built a matching service using Node.js and MongoDB."]) },
    { id: "p2", kind: "project", title: "GetFreeTools", source: "user", confidence: 1, skills: [], bullets: [] },
    { id: "e1", kind: "education", title: "MCA", source: "user", confidence: 1, skills: [], bullets: [] },
  ],
  declaredSkills: ["React", "Node.js"],
  targetFields: ["it"],
};

test("a fresher's document leads with projects and omits an empty experience heading", () => {
  assert.equal(isFresher(fresherProfile), true);
  const doc = buildDocument(fresherProfile);
  const kinds = doc.sections.map((s) => s.kind);
  assert.ok(!kinds.includes("experience"), "an empty Experience heading advertises the gap");
  assert.ok(kinds.indexOf("project") < kinds.indexOf("education"), "projects are a fresher's strongest evidence");
});

test("only sections with content are created", () => {
  const bare: CareerProfile = { identity: { links: [] }, items: [], declaredSkills: [], targetFields: [] };
  assert.deepEqual(buildDocument(bare).sections, []);
});

test("document operations never mutate the original", () => {
  const doc = buildDocument(fresherProfile);
  const before = JSON.stringify(doc);
  moveSection(doc, doc.sections[0].id, 1);
  toggleSection(doc, doc.sections[0].id);
  removeItem(doc, "project", "p1");
  assert.equal(JSON.stringify(doc), before, "operations must return new documents");
});

test("reordering is clamped at the ends rather than wrapping", () => {
  const doc = buildDocument(fresherProfile);
  const first = doc.sections[0].id;
  assert.equal(moveSection(doc, first, -1).sections[0].id, first, "already first");
});

test("hiding a section keeps it recoverable", () => {
  const doc = buildDocument(fresherProfile);
  const hidden = toggleSection(doc, "project");
  assert.equal(hidden.sections.find((s) => s.id === "project")!.visible, false);
  assert.equal(resolveDocument(hidden, fresherProfile).some((r) => r.section.id === "project"), false);
  // Still present in the document, so it can be brought back.
  assert.ok(hidden.sections.some((s) => s.id === "project"));
});

test("removed evidence returns to the available pool, not the bin", () => {
  const doc = removeItem(buildDocument(fresherProfile), "project", "p1");
  assert.ok(unusedItems(doc, fresherProfile).some((i) => i.id === "p1"));
  assert.equal(addItem(doc, "project", "p1").sections.find((s) => s.id === "project")!.itemIds.includes("p1"), true);
});

test("adding an item twice does not duplicate it", () => {
  const doc = buildDocument(fresherProfile);
  const twice = addItem(addItem(doc, "project", "p1"), "project", "p1");
  const ids = twice.sections.find((s) => s.id === "project")!.itemIds;
  assert.equal(ids.filter((i) => i === "p1").length, 1);
});

test("the document owns item order, not the profile", () => {
  const doc = moveItem(buildDocument(fresherProfile), "project", "p1", 1);
  const items = resolveDocument(doc, fresherProfile).find((r) => r.section.id === "project")!.items;
  assert.equal(items[0].id, "p2", "p1 moved down, so p2 leads");
});

test("a section emptied of items does not print as a bare heading", () => {
  let doc = buildDocument(fresherProfile);
  doc = removeItem(removeItem(doc, "project", "p1"), "project", "p2");
  assert.equal(resolveDocument(doc, fresherProfile).some((r) => r.section.id === "project"), false);
});

// --- Adapter --------------------------------------------------------------

test("personal projects filed under experience are reclassified", () => {
  // Parsers routinely file a project as employment; leading a fresher's résumé
  // with it would overstate their history.
  const p = toCareerProfile({
    experience: [
      { role: "Sahayam", company: "Personal Project", description: "Built a platform using Node.js." },
      { role: "Intern", company: "Infosys", description: "Supported the reporting team." },
    ],
  });
  assert.equal(p.items.find((i) => i.title === "Sahayam")!.kind, "project");
  assert.equal(p.items.find((i) => i.title === "Intern")!.kind, "experience");
});

test("parsed profiles are marked for verification, typed ones are not", () => {
  assert.ok(toCareerProfile({ education: ["MCA"], fromResume: true }).items[0].confidence < 0.7);
  assert.equal(toCareerProfile({ education: ["MCA"] }).items[0].confidence, 1);
});

test("a duration is split into its ends and 'Present' becomes current", () => {
  const item = toCareerProfile({ experience: [{ role: "R", company: "C", duration: "Jun 2024 – Present" }] }).items[0];
  assert.equal(item.startDate, "Jun 2024");
  assert.equal(item.current, true);
  assert.equal(item.endDate, undefined);
});

test("links are labelled by host", () => {
  const links = toCareerProfile({ resumeText: "github.com/jaga42-ui linkedin.com/in/x" }).identity.links;
  assert.ok(links.some((l) => l.label === "GitHub"));
  assert.ok(links.some((l) => l.label === "LinkedIn"));
});

// --- Versions and diff ----------------------------------------------------

import { diffDocuments, describeChange, branchVersion, missingFromVersion, type ResumeVersion } from "./versions";

const NOW = "2026-08-09T00:00:00.000Z";

test("an unchanged document diffs to nothing", () => {
  const doc = buildDocument(fresherProfile);
  const d = diffDocuments(doc, doc, fresherProfile);
  assert.equal(d.identical, true);
  assert.deepEqual(d.changes, []);
});

test("the diff names evidence in the candidate's own words, not ids", () => {
  const before = buildDocument(fresherProfile);
  const after = removeItem(before, "project", "p1");
  const change = diffDocuments(before, after, fresherProfile).changes[0];
  assert.equal(change.label, "Sahayam", "must resolve the id to its title");
  assert.equal(change.kind, "removed");
});

test("reordering reads as promoted, with the distance moved", () => {
  const before = buildDocument(fresherProfile);
  const after = moveItem(before, "project", "p2", -1);
  const change = diffDocuments(before, after, fresherProfile).changes.find((c) => c.kind === "promoted");
  assert.equal(change?.label, "GetFreeTools");
  assert.equal(change?.positions, 1);
});

test("removing the top item does not report every survivor as promoted", () => {
  // Measuring against absolute position would make one removal look like a
  // wholesale reshuffle — noise, not a change the candidate made.
  const before = buildDocument(fresherProfile);
  const after = removeItem(before, "project", "p1");
  const promoted = diffDocuments(before, after, fresherProfile).changes.filter((c) => c.kind === "promoted");
  assert.deepEqual(promoted, [], "p2 did not move relative to the other survivors");
});

test("hiding a section is reported as hidden, not removed", () => {
  const before = buildDocument(fresherProfile);
  const after = toggleSection(before, "project");
  const change = diffDocuments(before, after, fresherProfile).changes.find((c) => c.kind === "hidden");
  assert.ok(change, "hiding must be distinguishable from deleting");
});

test("each change describes itself in a readable line", () => {
  const before = buildDocument(fresherProfile);
  const after = removeItem(moveItem(before, "project", "p2", -1), "education", "e1");
  for (const c of diffDocuments(before, after, fresherProfile).changes) {
    const line = describeChange(c);
    assert.ok(line.length > 8 && !line.includes("undefined"), `unreadable: "${line}"`);
  }
});

test("a branched version cannot be reached by later edits to its parent", () => {
  // A version's whole purpose is surviving changes to the master; sharing the
  // section arrays by reference would quietly defeat that.
  const master: ResumeVersion = { id: "m", name: "Master", document: buildDocument(fresherProfile), updatedAt: NOW };
  const branch = branchVersion(master, "Frontend", "f", NOW);
  master.document.sections[0].itemIds.push("p2");
  assert.equal(branch.document.sections[0].itemIds.includes("p2"), false, "branch must be independent");
  assert.equal(branch.derivedFrom, "m");
});

test("a version reports which evidence it is not showing", () => {
  const doc = removeItem(buildDocument(fresherProfile), "project", "p1");
  const version: ResumeVersion = { id: "v", name: "V", document: doc, updatedAt: NOW };
  assert.ok(missingFromVersion(version, fresherProfile).includes("Sahayam"));
});

// --- Job → résumé alignment -----------------------------------------------

import { extractRequirements, alignToProfile, matchJob } from "./jobMatch";

const JD = `Frontend Developer
We are a fast growing company that uses Kubernetes across our platform.

Requirements:
- Strong knowledge of React and JavaScript
- Experience with Node.js and MongoDB
- 2+ years of experience in web development
- B.Tech in Computer Science
TypeScript is a nice to have.`;

test("requirements come from the requirements block, not company boilerplate", () => {
  const reqs = extractRequirements(JD, "Frontend Developer");
  const labels = reqs.map((r) => r.label);
  assert.ok(labels.includes("react"));
  // "we use Kubernetes across our platform" is description, not a requirement.
  assert.ok(!labels.includes("kubernetes"), `boilerplate leaked in: ${labels.join(", ")}`);
});

test("preferred items are not treated as essential", () => {
  const ts = extractRequirements(JD).find((r) => r.label === "typescript");
  assert.equal(ts?.essential, false, "'nice to have' must not be essential");
  assert.equal(extractRequirements(JD).find((r) => r.label === "react")?.essential, true);
});

test("experience and education requirements are detected", () => {
  const reqs = extractRequirements(JD);
  assert.ok(reqs.some((r) => r.kind === "experience" && r.label.startsWith("2+")));
  assert.ok(reqs.some((r) => r.kind === "education"));
});

test("proven beats claimed: a skill shown in a bullet names its evidence", () => {
  const profile: CareerProfile = {
    identity: { links: [] },
    items: [{
      id: "p1", kind: "project", title: "Sahayam", source: "user", confidence: 1, skills: [],
      bullets: detectAll(["Built a matching service using Node.js and MongoDB."]),
    }],
    declaredSkills: ["React", "Node.js", "MongoDB"],
    targetFields: ["it"],
  };
  const alignment = alignToProfile(extractRequirements(JD), profile, 0);

  const node = alignment.matches.find((m) => m.requirement.label === "node.js")!;
  assert.equal(node.status, "proven");
  assert.equal(node.evidence[0].itemTitle, "Sahayam", "must name where it is proven");

  // Listed on the résumé but demonstrated nowhere — the distinction that makes
  // this different from keyword matching.
  const react = alignment.matches.find((m) => m.requirement.label === "react")!;
  assert.equal(react.status, "claimed");
  assert.deepEqual(react.evidence, []);
});

test("a skill neither shown nor listed is missing, not claimed", () => {
  const bare: CareerProfile = { identity: { links: [] }, items: [], declaredSkills: [], targetFields: [] };
  const react = alignToProfile(extractRequirements(JD), bare).matches.find((m) => m.requirement.label === "react")!;
  assert.equal(react.status, "missing");
});

test("the summary states a count, never a bare percentage", () => {
  const bare: CareerProfile = { identity: { links: [] }, items: [], declaredSkills: [], targetFields: [] };
  const summary = alignToProfile(extractRequirements(JD), bare).summary;
  assert.ok(/\d+ of the \d+/.test(summary), `expected a count: "${summary}"`);
  assert.ok(!/%/.test(summary), "a percentage implies precision this does not have");
});

test("unstated experience is reported as unproven, never assumed", () => {
  const bare: CareerProfile = { identity: { links: [] }, items: [], declaredSkills: [], targetFields: [] };
  const exp = alignToProfile(extractRequirements(JD), bare, undefined).matches.find((m) => m.requirement.kind === "experience")!;
  assert.equal(exp.status, "missing", "silence is not evidence of experience");
});

test("only essential unmet requirements are critical gaps", () => {
  const bare: CareerProfile = { identity: { links: [] }, items: [], declaredSkills: [], targetFields: [] };
  const gaps = alignToProfile(extractRequirements(JD), bare).criticalGaps.map((r) => r.label);
  assert.ok(gaps.includes("react"));
  assert.ok(!gaps.includes("typescript"), "a nice-to-have is not a critical gap");
});

test("a posting with no listed requirements says so rather than scoring zero", () => {
  const bare: CareerProfile = { identity: { links: [] }, items: [], declaredSkills: [], targetFields: [] };
  const alignment = matchJob({ title: "Associate", description: "Join our team." }, bare);
  assert.equal(alignment.total, 0);
  assert.ok(alignment.summary.includes("doesn't list specific requirements"));
});
