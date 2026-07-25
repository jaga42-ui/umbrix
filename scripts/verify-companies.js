/**
 * Verify candidate India-hiring employers against the live ATS APIs before
 * adding them to companies.json. Reuses the real adapter fetchers, so a "hit"
 * here is exactly what the ingest would fetch. Reports total + India job counts;
 * only entries with India jobs are worth adding. Read-only. Run:
 *   node scripts/verify-companies.js
 */
require("dotenv").config({ path: ".env.local" });
const { ATS_FETCHERS, isIndiaLocation } = require("./ingest-jobs");

// Best-guess {slug, ats} for fresher-friendly India employers not already in
// companies.json. Uncertain ones are tried on more than one ATS.
const CANDIDATES = [
  { slug: "inmobi", ats: "greenhouse" }, { slug: "fampay", ats: "lever" },
  { slug: "Swiggy", ats: "smartrecruiters" }, { slug: "Visa", ats: "smartrecruiters" }, // verified rounds 1-2
  // --- Round 3: India-native startups on lever/ashby ---
  { slug: "bharatpe", ats: "lever" }, { slug: "acko", ats: "lever" }, { slug: "shiprocket", ats: "lever" },
  { slug: "netcore", ats: "lever" }, { slug: "exotel", ats: "lever" }, { slug: "leadsquared", ats: "lever" },
  { slug: "smallcase", ats: "lever" }, { slug: "classplus", ats: "lever" }, { slug: "teachmint", ats: "lever" },
  { slug: "testbook", ats: "lever" }, { slug: "scaler", ats: "lever" }, { slug: "khatabook", ats: "lever" },
  { slug: "onsurity", ats: "lever" }, { slug: "plumhq", ats: "lever" }, { slug: "jodo", ats: "lever" },
  { slug: "dukaan", ats: "lever" }, { slug: "vymo", ats: "lever" }, { slug: "locusdotsh", ats: "lever" },
  { slug: "Portkey", ats: "ashby" }, { slug: "Toplyne", ats: "ashby" }, { slug: "InVideo", ats: "ashby" },
  { slug: "Nurix", ats: "ashby" }, { slug: "Hyperbound", ats: "ashby" }, { slug: "Julius", ats: "ashby" },
  { slug: "Myntra", ats: "smartrecruiters" }, { slug: "MakeMyTrip", ats: "smartrecruiters" },
  { slug: "PhonePe", ats: "smartrecruiters" }, { slug: "Flipkart", ats: "smartrecruiters" },
  { slug: "ignore-below", ats: "greenhouse" }, // sentinel; ignored (404)
  // --- IT services / BPO on SmartRecruiters (case-sensitive; biggest fresher hirers) ---
  { slug: "Cognizant", ats: "smartrecruiters" }, { slug: "Capgemini", ats: "smartrecruiters" },
  { slug: "Genpact", ats: "smartrecruiters" }, { slug: "TechMahindra", ats: "smartrecruiters" },
  { slug: "HCLTech", ats: "smartrecruiters" }, { slug: "Concentrix", ats: "smartrecruiters" },
  { slug: "WNS", ats: "smartrecruiters" }, { slug: "Nagarro", ats: "smartrecruiters" },
  { slug: "Mphasis", ats: "smartrecruiters" }, { slug: "LTIMindtree", ats: "smartrecruiters" },
  { slug: "Coforge", ats: "smartrecruiters" }, { slug: "Persistent", ats: "smartrecruiters" },
  { slug: "Birlasoft", ats: "smartrecruiters" }, { slug: "Hexaware", ats: "smartrecruiters" },
  { slug: "Wipro", ats: "smartrecruiters" }, { slug: "Swiggy", ats: "smartrecruiters" },
  { slug: "Zomato", ats: "smartrecruiters" }, { slug: "Byjus", ats: "smartrecruiters" },
  { slug: "Publicis", ats: "smartrecruiters" }, { slug: "Aramark", ats: "smartrecruiters" },
  { slug: "Bosch", ats: "smartrecruiters" }, { slug: "Visa", ats: "smartrecruiters" },
  // --- More product/tech on greenhouse/lever/ashby (refined guesses) ---
  { slug: "sprinklr", ats: "greenhouse" }, { slug: "gojek", ats: "greenhouse" },
  { slug: "grabtaxi", ats: "greenhouse" }, { slug: "airtel", ats: "greenhouse" },
  { slug: "chargebee", ats: "lever" }, { slug: "browserstack", ats: "lever" },
  { slug: "postmanlabs", ats: "greenhouse" }, { slug: "gong", ats: "greenhouse" },
  { slug: "fampay", ats: "lever" }, { slug: "jar", ats: "lever" },
];

async function main() {
  const verified = [];
  for (const c of CANDIDATES) {
    const fetchJobs = ATS_FETCHERS[c.ats];
    try {
      const jobs = await fetchJobs(c.slug, c);
      const india = jobs.filter((j) => isIndiaLocation(j.location)).length;
      const mark = jobs.length > 0 ? (india > 0 ? "✓" : "~") : "·";
      console.log(`${mark} ${c.ats}/${c.slug}: ${jobs.length} jobs, ${india} india`);
      if (jobs.length > 0 && india > 0) verified.push({ ...c, total: jobs.length, india });
    } catch (e) {
      console.log(`✗ ${c.ats}/${c.slug}: ${String(e.message).slice(0, 40)}`);
    }
    await new Promise((r) => setTimeout(r, 350)); // courteous pacing
  }

  console.log(`\n=== VERIFIED (${verified.length}) — has India jobs, ready to add ===`);
  for (const v of verified.sort((a, b) => b.india - a.india)) {
    console.log(`  { "slug": "${v.slug}", "ats": "${v.ats}" },   // ${v.india} india / ${v.total} total`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
