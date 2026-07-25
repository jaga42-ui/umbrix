/**
 * Manually onboard a recruiter/employer customer (no self-serve signup yet).
 * The recruiter first signs in with Google on the site and copies their account
 * id (shown on /recruiter/search when they have no account) — that's the uid.
 *
 * Usage:
 *   node scripts/admin/create-recruiter-account.js \
 *     --uid=<firebase-uid> --company="Acme Corp" --email=hr@acme.com \
 *     [--plan=payg|seat] [--credits=50] [--days=30]
 *
 * - payg: sets the credit balance to --credits (each unlock spends one).
 * - seat: activates a monthly seat for --days (default 30) — unlimited unlocks.
 * Re-running updates the existing account (idempotent by uid).
 */
require("dotenv").config({ path: ".env.local" });
const mongoose = require("mongoose");

function arg(name, def) {
  const p = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(p));
  return found ? found.slice(p.length) : def;
}

async function main() {
  const uid = arg("uid");
  const company = arg("company");
  const email = arg("email");
  const plan = arg("plan", "payg");
  const credits = Number(arg("credits", "0"));
  const days = Number(arg("days", "30"));

  if (!uid || !company || !email || !["payg", "seat"].includes(plan)) {
    console.error(
      'Usage: node scripts/admin/create-recruiter-account.js --uid=<firebase-uid> --company="Acme" --email=hr@acme.com [--plan=payg|seat] [--credits=50] [--days=30]'
    );
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI not set");

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const coll = mongoose.connection.db.collection("recruiteraccounts");

  const now = new Date();
  const set = { company, email, plan, active: true, updatedAt: now };
  const setOnInsert = { userId: uid, createdAt: now };
  if (plan === "payg") {
    set.creditsBalance = credits; // sets (not adds) the balance
  } else {
    set.seatExpiresAt = new Date(now.getTime() + days * 86400000);
    setOnInsert.creditsBalance = 0;
  }

  const res = await coll.updateOne({ userId: uid }, { $set: set, $setOnInsert: setOnInsert }, { upsert: true });
  const acct = await coll.findOne({ userId: uid });

  console.log(res.upsertedCount ? "\n✅ Created recruiter account:" : "\n✅ Updated recruiter account:");
  console.log(JSON.stringify(acct, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("failed:", e.message);
  process.exit(1);
});
