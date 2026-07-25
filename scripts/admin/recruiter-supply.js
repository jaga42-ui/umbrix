/**
 * Recruiter-marketplace supply readout.
 *
 * Answers the one question that decides whether the recruiter side is worth
 * switching on: how many candidates have opted in to recruiter visibility, and
 * in which fields is that pool dense enough to sell an unlock over.
 *
 * The searchable pool = { visibleToRecruiters: true, has >=1 skill } — that's
 * exactly what /api/recruiter/search queries, so this mirrors what a recruiter
 * would actually see.
 *
 * Usage:
 *   node scripts/admin/recruiter-supply.js
 *
 * Rough rule of thumb: a field is sellable once its opted-in pool is in the
 * low hundreds. Below that, an unlock browses an almost-empty room.
 */
require("dotenv").config({ path: ".env.local" });
const mongoose = require("mongoose");

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI not set");

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const coll = mongoose.connection.db.collection("userprofiles");

  const OPTED_IN = { visibleToRecruiters: true };
  const SEARCHABLE = { visibleToRecruiters: true, "skills.0": { $exists: true } };
  const FRESHER = { $expr: { $lte: [{ $size: { $ifNull: ["$experience", []] } }, 1] } };

  const [total, withSkills, optedIn, searchable, searchableFresher] = await Promise.all([
    coll.countDocuments({}),
    coll.countDocuments({ "skills.0": { $exists: true } }),
    coll.countDocuments(OPTED_IN),
    coll.countDocuments(SEARCHABLE),
    coll.countDocuments({ ...SEARCHABLE, ...FRESHER }),
  ]);

  // Opted-in, searchable candidates broken down by target field.
  const byField = await coll
    .aggregate([
      { $match: SEARCHABLE },
      { $unwind: { path: "$targetFields", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ["$targetFields", "(no field set)"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  console.log("\n=== Recruiter supply ===");
  console.log(`Total profiles ............... ${total}`);
  console.log(`  with >=1 skill ............. ${withSkills}`);
  console.log(`Opted in (visibleToRecruiters) ${optedIn}`);
  console.log(`  SEARCHABLE (opted in + skill) ${searchable}   <- the sellable pool`);
  console.log(`    of which fresher-eligible . ${searchableFresher}`);

  console.log("\n--- Searchable pool by field ---");
  if (byField.length === 0) {
    console.log("(none yet — no opted-in candidates with skills)");
  } else {
    for (const row of byField) {
      const flag = row.count >= 100 ? "  ✅ sellable" : row.count >= 25 ? "  ~ getting there" : "  · too thin";
      console.log(`${String(row._id).padEnd(20)} ${String(row.count).padStart(5)}${flag}`);
    }
  }

  const verdict =
    searchable >= 100
      ? "✅ There is real supply — worth onboarding recruiters."
      : searchable >= 25
      ? "~ Supply is building — a niche field may be sellable; check the by-field rows."
      : "· Supply is too thin to sell recruiter unlocks yet. Focus on candidate opt-ins.";
  console.log(`\n${verdict}\n`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("failed:", e.message);
  process.exit(1);
});
