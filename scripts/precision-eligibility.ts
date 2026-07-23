/**
 * Precision gate for the LLM eligibility pass. Pulls real Active India jobs whose
 * minExperience is unknown, runs them through the EXACT schema/prompt the cron
 * route uses (imported from ./eligibilityPrompt) + the real assembleResults, and
 * prints the extraction next to a JD snippet so a human can judge correctness
 * BEFORE rollout. Read-only.
 *
 *   node --import tsx scripts/precision-eligibility.ts [count]
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { assembleResults } from "../src/lib/eligibilitySanitize";
import { batchEligibilitySchema, ELIGIBILITY_SYSTEM, buildEligibilityPrompt, stripHtml } from "../src/lib/eligibilityPrompt";

dotenv.config({ path: ".env.local" });

const ARG = process.argv[2] || "8";
const CASES_MODE = ARG === "cases";
const COUNT = Number(ARG) || 8;

// Crafted JDs reproducing the failure modes the first precision run surfaced, so
// the prompt tuning can be verified deterministically. `expect` is the intended
// answer for a human to check against.
const CASES: { id: string; title: string; content: string; expect: string }[] = [
  {
    id: "case-get",
    title: "Trainee_GET_Mechanical/Automobile",
    content: "B.Tech/B.E Degree in Mechanical / Automobile. 60% above in academics (10th, 12th, UG). No backlogs in any semester. Excellent English communication.",
    expect: "minExp 0 (GET trainee), branches [Mechanical, Automobile], cgpa null (60% is a percentage)",
  },
  {
    id: "case-vague",
    title: "Data Entry Operator",
    content: "We are seeking a detail-oriented Data Entry Operator with strong experience in data management and advanced MS Excel skills. The ideal candidate should be accurate and fast.",
    expect: "minExp null (vague 'strong experience', no number)",
  },
  {
    id: "case-batch",
    title: "Graduate Engineer Trainee",
    content: "Eligibility: 2025 and 2026 batch B.E/B.Tech graduates in CSE, IT, ECE. Freshers only. Minimum 7.0 CGPA required.",
    expect: "minExp 0, batch [2025,2026], branches [CSE,IT,ECE], cgpa 7.0",
  },
  {
    id: "case-range",
    title: "Backend Developer",
    content: "Looking for a backend developer with 2-4 years of hands-on experience in Node.js and MongoDB.",
    expect: "minExp 2 (lower bound of stated range)",
  },
];

async function main() {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");

  let items: { id: string; title: string; content: string }[];
  let expects: Record<string, string> = {};

  if (CASES_MODE) {
    items = CASES.map(({ id, title, content }) => ({ id, title, content }));
    expects = Object.fromEntries(CASES.map((c) => [c.id, c.expect]));
  } else {
    await mongoose.connect(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 20000 });
    const db = mongoose.connection.db;
    if (!db) throw new Error("no db");
    const jobs = await db
      .collection("jobs")
      .aggregate([
        { $match: { status: "Active", isIndia: true, minExperience: null, eligibilityLLMAt: { $exists: false } } },
        { $match: { $expr: { $gt: [{ $strLenCP: { $ifNull: ["$descriptionHtml", ""] } }, 200] } } },
        { $sample: { size: COUNT } },
        { $project: { title: 1, descriptionHtml: 1 } },
      ])
      .toArray();
    items = jobs.map((j: any) => ({ id: j._id.toString(), title: j.title || "", content: j.descriptionHtml || "" }));
  }

  const { object } = await generateObject({
    model: groq("openai/gpt-oss-120b"),
    schema: batchEligibilitySchema,
    schemaName: "JobEligibilityBatch",
    system: ELIGIBILITY_SYSTEM,
    prompt: buildEligibilityPrompt(items),
    temperature: 0,
  });

  const results = assembleResults(items.map((i) => i.id), object.jobs);

  console.log(`\n=== Precision gate — ${CASES_MODE ? "crafted failure-mode cases" : `${items.length} random unknown-minExp India jobs`} ===\n`);
  for (const it of items) {
    const e = results.get(it.id);
    console.log(`▸ ${it.title.slice(0, 70)}`);
    console.log(`  JD: ${stripHtml(it.content).slice(0, 200)}…`);
    console.log(
      `  → minExp: ${e?.minExperience ?? "null"} | batch: [${e?.batchYears ?? ""}] | branches: [${(e?.branches ?? []).join(", ")}] | cgpa: ${e?.cgpaCutoff ?? "null"}`
    );
    if (CASES_MODE) console.log(`  expect: ${expects[it.id]}`);
    console.log("");
  }
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
}

main().catch((e) => {
  console.error("precision gate failed:", e.message);
  process.exit(1);
});
