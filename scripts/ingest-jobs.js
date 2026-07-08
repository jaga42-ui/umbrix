require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { evaluate: evaluateScam } = require('./scamFilter');

// Basic Job Schema since we're running outside Next.js compile context
const JobSchema = new mongoose.Schema(
  {
    companySlug: { type: String, required: true, index: true },
    title: { type: String, required: true },
    location: { type: String, required: true },
    descriptionHtml: { type: String, required: true },
    tags: { type: [String], default: [] },
    applyUrl: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Closed'], default: 'Active' },
  },
  { timestamps: true }
);

const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

async function ingestJobs() {
  if (!process.env.MONGODB_URI) {
    if (process.env.GITHUB_ACTIONS === "true") {
      // In CI, a missing secret is a misconfiguration, not an intentional
      // dry-run — fail loud instead of silently no-oping with a green check.
      throw new Error(
        "MONGODB_URI is not set. Add it as a repository secret (Settings > Secrets and variables > Actions) — refusing to run a silent dry-run in CI."
      );
    }
    console.warn("⚠️ MONGODB_URI is not defined. Running in dry-run mode.");
  } else {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");
  }

  const companiesPath = path.join(__dirname, 'companies.json');
  const companies = JSON.parse(fs.readFileSync(companiesPath, 'utf8'));

  for (const slug of companies) {
    console.log(`\nFetching jobs for ${slug}...`);
    try {
      const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
      if (!response.ok) {
        console.error(`❌ Failed to fetch for ${slug}: ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      const jobs = data.jobs || [];
      console.log(`Found ${jobs.length} jobs.`);

      let scamCount = 0;
      const jobDocs = [];

      for (const job of jobs) {
        // Apply the weighted scam filter. Log why anything is dropped so every
        // block is auditable — the trust moat depends on being able to explain it.
        const content = job.content || '';
        const verdict = evaluateScam({
          title: job.title,
          content,
          applyUrl: job.absolute_url,
        });
        if (verdict.isScam) {
          scamCount++;
          console.log(
            `   🚫 Blocked "${job.title}" (score ${verdict.score}): ${verdict.reasons.join('; ')}`
          );
          continue;
        }

        // Standardize tags (departments/offices in Greenhouse)
        const tags = [];
        if (job.departments && job.departments.length > 0) {
          const dept = job.departments[0].name;
          if (dept && dept !== "No Department") {
            tags.push(dept);
          }
        }

        // Extract key technical skills & keywords for improved discovery/filtering
        const skillKeywords = [
          "React", "TypeScript", "Next.js", "Node.js", "Python", "Rust", 
          "Go", "Figma", "UI/UX", "Product Design", "GraphQL", "PostgreSQL", 
          "Docker", "Kubernetes", "AWS", "Machine Learning", "AI", "C++", 
          "Java", "Ruby", "Swift", "Kotlin", "Frontend", "Backend", "Fullstack"
        ];
        const lowerTitle = job.title.toLowerCase();
        const lowerContent = content.toLowerCase();

        skillKeywords.forEach((keyword) => {
          if (
            lowerTitle.includes(keyword.toLowerCase()) || 
            lowerContent.includes(keyword.toLowerCase())
          ) {
            if (!tags.includes(keyword)) {
              tags.push(keyword);
            }
          }
        });

        jobDocs.push({
          companySlug: slug,
          title: job.title,
          location: job.location?.name || 'Remote',
          descriptionHtml: content,
          tags: tags,
          applyUrl: job.absolute_url,
          status: 'Active'
        });
      }

      if (process.env.MONGODB_URI && jobDocs.length > 0) {
        // One round-trip per company instead of one per job — upsert on
        // applyUrl to avoid duplicates, same as before.
        await Job.bulkWrite(
          jobDocs.map((jobDoc) => ({
            updateOne: {
              filter: { applyUrl: jobDoc.applyUrl },
              update: { $set: jobDoc },
              upsert: true,
            },
          }))
        );
      }

      console.log(`✅ Processed ${jobDocs.length} valid jobs. Blocked ${scamCount} potential scams.`);
    } catch (error) {
      console.error(`❌ Error processing ${slug}:`, error.message);
    }
  }

  if (process.env.MONGODB_URI) {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  } else {
    console.log("\n✅ Dry run completed.");
  }
}

ingestJobs().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
