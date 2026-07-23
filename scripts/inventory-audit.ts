/**
 * Inventory-reality audit. For realistic Indian fresher personas across fields,
 * mirrors the live feed candidate query + match scoring and reports how many
 * jobs are *actually applicable* today — the founder's ground truth on whether
 * the all-field promise holds. Read-only.
 *
 *   node --import tsx scripts/inventory-audit.ts
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { calculateMatch, jobFieldFromSlug, type MatchProfile } from "../src/lib/matchScore";

// Uses .env.local like the rest of the pipeline.
dotenv.config({ path: ".env.local" });

const CANDIDATE_LIMIT = 2000; // mirror src/app/api/jobs/route.ts

interface Persona {
  label: string;
  profile: MatchProfile;
}

const PERSONAS: Persona[] = [
  {
    label: "CSE fresher (IT)",
    profile: { title: "B.Tech Computer Science student, 2026 batch", targetFields: ["it"], skills: ["React", "JavaScript", "Python", "SQL", "Git", "Node.js"] },
  },
  {
    label: "Mechanical fresher",
    profile: { title: "B.Tech Mechanical Engineering fresher", targetFields: ["engineering", "manufacturing"], skills: ["AutoCAD", "SolidWorks", "CATIA", "Manufacturing", "Thermodynamics"] },
  },
  {
    label: "Marketing fresher (BBA)",
    profile: { title: "BBA graduate, marketing", targetFields: ["marketing", "sales"], skills: ["Social Media Marketing", "Content Writing", "Communication", "SEO", "Canva"] },
  },
  {
    label: "Commerce/Finance fresher (B.Com)",
    profile: { title: "B.Com graduate", targetFields: ["finance"], skills: ["Accounting", "Tally", "Excel", "Taxation", "GST"] },
  },
  {
    label: "Arts generalist (BA)",
    profile: { title: "BA graduate", targetFields: ["customer-service", "admin", "hr"], skills: ["Communication", "MS Office", "Customer Service", "English"] },
  },
];

/** Mirror the feed route's field-scoped candidate query. */
function buildQuery(targetFields: string[]): Record<string, unknown> {
  const query: Record<string, unknown> = { status: "Active", isIndia: true };
  const conds: unknown[] = [];
  const adzunaSlugs = targetFields.filter((f) => f !== "it").map((f) => `adzuna-in-${f}`);
  if (adzunaSlugs.length) conds.push({ companySlug: { $in: adzunaSlugs } });
  if (targetFields.includes("it")) {
    conds.push({ companySlug: "adzuna-in-it" });
    conds.push({ companySlug: { $not: /^adzuna-in-/ } });
  }
  if (conds.length) query.$or = conds;
  return query;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle after connect");
  const coll = db.collection("jobs");

  const activeIndia = await coll.countDocuments({ status: "Active", isIndia: true });
  console.log(`\n=== UMBRIX inventory-reality audit ===`);
  console.log(`Active India roles (feed universe): ${activeIndia}\n`);

  for (const { label, profile } of PERSONAS) {
    const query = buildQuery(profile.targetFields || []);
    const inFieldTotal = await coll.countDocuments(query);
    const jobs = await coll
      .find(query)
      .project({ companySlug: 1, companyName: 1, title: 1, tags: 1, minExperience: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(CANDIDATE_LIMIT)
      .toArray();

    let eligible = 0, unknown = 0, needsExp = 0;
    let strong = 0, decent = 0;
    let applicable = 0; // fresher-eligible (0-1 or unknown) AND score >= 70
    const scored = jobs.map((j) => {
      const me = j.minExperience;
      if (me == null) unknown++;
      else if (me <= 1) eligible++;
      else needsExp++;
      const m = calculateMatch(profile, {
        title: j.title,
        tags: j.tags || [],
        minExperience: me,
        field: jobFieldFromSlug(j.companySlug),
      });
      if (m.score >= 85) strong++;
      else if (m.score >= 70) decent++;
      const fresherOk = me == null || me <= 1;
      if (fresherOk && m.score >= 70) applicable++;
      return { title: j.title, company: j.companyName || j.companySlug, minExp: me, score: m.score };
    });
    scored.sort((a, b) => b.score - a.score);

    console.log(`── ${label} ${"─".repeat(Math.max(0, 44 - label.length))}`);
    console.log(`   in-field India inventory : ${inFieldTotal}   (scored window: ${jobs.length})`);
    console.log(`   eligibility  : ${eligible} fresher(0-1) | ${unknown} unknown | ${needsExp} needs-exp(2+)`);
    console.log(`   match score  : ${strong} strong(85+) | ${decent} decent(70-84) | ${jobs.length - strong - decent} weak(<70)`);
    console.log(`   ★ APPLICABLE (fresher-eligible AND score>=70): ${applicable}  (${((100 * applicable) / Math.max(1, jobs.length)).toFixed(0)}% of window)`);
    console.log(`   top 5 they'd see:`);
    for (const s of scored.slice(0, 5)) {
      const exp = s.minExp == null ? "exp:?" : `exp:${s.minExp}`;
      console.log(`      ${String(s.score).padStart(2)}  ${exp.padEnd(6)}  ${String(s.title).slice(0, 50)}  @ ${String(s.company).slice(0, 22)}`);
    }
    console.log("");
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("audit failed:", e.message);
  process.exit(1);
});
