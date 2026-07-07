require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

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

const SCAM_KEYWORDS = ['processing fee', 'security deposit', 'wire transfer', 'upfront payment'];

function isScam(descriptionHtml) {
  const lowerDesc = descriptionHtml.toLowerCase();
  return SCAM_KEYWORDS.some((keyword) => lowerDesc.includes(keyword));
}

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

      let processedCount = 0;
      let scamCount = 0;

      for (const job of jobs) {
        // Apply scam filter
        const content = job.content || '';
        if (isScam(content)) {
          scamCount++;
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

        const jobDoc = {
          companySlug: slug,
          title: job.title,
          location: job.location?.name || 'Remote',
          descriptionHtml: content,
          tags: tags,
          applyUrl: job.absolute_url,
          status: 'Active'
        };

        if (process.env.MONGODB_URI) {
          // Upsert based on applyUrl to avoid duplicates
          await Job.findOneAndUpdate(
            { applyUrl: jobDoc.applyUrl },
            { $set: jobDoc },
            { upsert: true, new: true }
          );
        }
        processedCount++;
      }

      console.log(`✅ Processed ${processedCount} valid jobs. Blocked ${scamCount} potential scams.`);
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
