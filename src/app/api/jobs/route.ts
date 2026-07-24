import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import UserProfile from "@/models/UserProfile";
import { resolveUserId } from "@/lib/serverAuth";
import { calculateMatch, rankByMatch, jobFieldFromSlug, type MatchProfile } from "@/lib/matchScore";
import { safeRegexTerm } from "@/lib/validation";

// Max jobs returned to the feed. Ranked by match, so this is "your best N".
// Bounds the payload as the ingested job set grows across ATS sources.
const FEED_MAX = 120;

// Most-recent active postings scored per request for users with a resume.
// Bounds CPU/DB work to O(window) instead of O(all active jobs). Tunable.
const CANDIDATE_LIMIT = 2000;

// A robust set of mock jobs to fall back to when MongoDB is offline
const MOCK_JOBS = [
  {
    _id: "mock-1",
    title: "Senior Frontend Engineer",
    companySlug: "stripe",
    companyName: "Stripe",
    location: "Remote (US/Canada)",
    tags: ["React", "TypeScript", "Next.js", "Engineering"],
    applyUrl: "https://stripe.com/jobs",
    descriptionHtml: "<p>We are looking for a Senior Frontend Engineer to build beautiful, developer-focused dashboards. You will work with React, TypeScript, and Next.js to deliver high-performance user experiences.</p>",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "mock-2",
    title: "Product Engineer",
    companySlug: "linear",
    companyName: "Linear",
    location: "San Francisco, CA",
    tags: ["TypeScript", "React", "Node.js", "Design"],
    applyUrl: "https://linear.app/careers",
    descriptionHtml: "<p>Linear is looking for a Product Engineer with a passion for software craft. You will be responsible for building fast, responsive features across our web client and backend systems.</p>",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "mock-3",
    title: "Staff Software Engineer",
    companySlug: "vercel",
    companyName: "Vercel",
    location: "Remote",
    tags: ["Next.js", "Edge Computing", "Rust", "Engineering"],
    applyUrl: "https://vercel.com/careers",
    descriptionHtml: "<p>Join the team that builds Next.js. You will work on optimizing edge networks, middleware, and rendering runtimes to shape the future of the web.</p>",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "mock-4",
    title: "Fullstack Developer",
    companySlug: "discord",
    companyName: "Discord",
    location: "San Francisco, CA",
    tags: ["React", "Node.js", "WebRTC", "Engineering"],
    applyUrl: "https://discord.com/careers",
    descriptionHtml: "<p>Help build the communication service of the internet. As a Fullstack Developer at Discord, you will build real-time interactive voice and video features.</p>",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "mock-5",
    title: "Product Designer",
    companySlug: "figma",
    companyName: "Figma",
    location: "Remote",
    tags: ["UI/UX", "Product Design", "Figma", "Design"],
    applyUrl: "https://figma.com/careers",
    descriptionHtml: "<p>Shape the next generation of creative tools. Work with engineers and product managers to prototype and design new multiplayer collaboration interfaces.</p>",
    createdAt: new Date().toISOString(),
  }
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const location = searchParams.get("location");
    const tag = searchParams.get("tag");
    // Default the feed to India roles (the audience); client can opt out.
    const indiaOnly = searchParams.get("india") !== "0";
    // "Fresher-eligible only": roles with a known minExperience of 0–1 years —
    // the eligibility-first differentiation, using the field that's actually
    // populated (batch/branch/CGPA are extracted but near-empty in practice).
    const fresherOnly = searchParams.get("fresher") === "1";

    const auth = await resolveUserId(request, searchParams.get("userId") || "demo-user-123");
    if (auth.errorResponse) return auth.errorResponse;
    const userId = auth.userId!;

    // 1. Build the match profile used to personalize ranking.
    const matchProfile: MatchProfile = { skills: [] };
    const guestSkillsHeader = request.headers.get("x-guest-skills");
    const guestTitleHeader = request.headers.get("x-guest-title");

    // The guest-* headers are client-supplied and untrusted, so they are only
    // honored in demo mode. When auth is enforced, the profile comes from the DB.
    if (!auth.enforced && guestSkillsHeader) {
      try {
        matchProfile.skills = JSON.parse(guestSkillsHeader);
      } catch (e) {
        console.error("Failed to parse guest skills header", e);
      }
      if (guestTitleHeader) matchProfile.title = guestTitleHeader;
    } else {
      try {
        const db = await connectToDatabase();
        if (db) {
          const profile = await UserProfile.findOne({ userId });
          if (profile) {
            matchProfile.skills = profile.skills || [];
            matchProfile.title = profile.title;
            matchProfile.experience = profile.experience;
            matchProfile.targetFields = profile.targetFields || [];
          }
        }
      } catch (e) {
        console.error("Failed to fetch UserProfile in jobs API", e);
      }
    }
    const hasSkills = matchProfile.skills.length > 0;

    // Helper for offline fallback
    const getMockJobsFallback = () => {
      let filteredJobs = [...MOCK_JOBS];

      if (search) {
        const searchLower = search.toLowerCase();
        filteredJobs = filteredJobs.filter(
          (job) =>
            job.title.toLowerCase().includes(searchLower) ||
            job.companySlug.toLowerCase().includes(searchLower) ||
            job.descriptionHtml.toLowerCase().includes(searchLower)
        );
      }

      if (location) {
        const locLower = location.toLowerCase();
        if (locLower === "remote") {
          filteredJobs = filteredJobs.filter((job) =>
            job.location.toLowerCase().includes("remote")
          );
        } else {
          filteredJobs = filteredJobs.filter((job) =>
            job.location.toLowerCase().includes(locLower)
          );
        }
      }

      if (tag) {
        filteredJobs = filteredJobs.filter((job) =>
          job.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
        );
      }

      const formattedMockJobs = filteredJobs.map((job) => {
        const match = calculateMatch(matchProfile, { ...job, field: jobFieldFromSlug(job.companySlug) });
        return {
          ...job,
          matchScore: match.score,
          matchingSkills: match.matchingSkills,
          missingSkills: match.missingSkills,
          matchSummary: match.matchSummary,
          matchExplanation: match.matchExplanation,
        };
      });

      const rankedMock = rankByMatch(formattedMockJobs);
      return NextResponse.json({
        success: true,
        jobs: rankedMock,
        total: rankedMock.length,
        isDemo: true,
        hasSkills,
      });
    };

    try {
      const db = await connectToDatabase();
      if (!db) {
        console.log("Database connection not established, falling back to mock jobs.");
        return getMockJobsFallback();
      }

      // Database is connected: build Mongoose query. All user-supplied terms are
      // escaped + length-capped before entering a $regex to avoid regex
      // injection / ReDoS.
      const query: any = { status: "Active" };
      if (indiaOnly) query.isIndia = true;
      // Known 0–1 years only. Excludes unknown (null) so we never claim a role is
      // fresher-friendly without evidence — matches the JobCard "Fresher-friendly" badge.
      if (fresherOnly) query.minExperience = { $ne: null, $lte: 1 };

      const searchTerm = safeRegexTerm(search);
      if (searchTerm) {
        query.$or = [
          { title: { $regex: searchTerm, $options: "i" } },
          { companySlug: { $regex: searchTerm, $options: "i" } },
          { descriptionHtml: { $regex: searchTerm, $options: "i" } },
        ];
      }

      // Scope the candidate pool to the user's field(s) so the scored window isn't
      // starved of in-field jobs by the newest-N cut (which otherwise fills with
      // whatever was ingested most recently). Skipped when the user is actively
      // searching — a search should look across every field. "it" = the Adzuna IT
      // shard plus every ATS board (which are software/product boards).
      const targetFields = matchProfile.targetFields || [];
      if (!query.$or && targetFields.length > 0) {
        const conds: any[] = [];
        const adzunaSlugs = targetFields.filter((f) => f !== "it").map((f) => `adzuna-in-${f}`);
        if (adzunaSlugs.length) conds.push({ companySlug: { $in: adzunaSlugs } });
        if (targetFields.includes("it")) {
          conds.push({ companySlug: "adzuna-in-it" });
          conds.push({ companySlug: { $not: /^adzuna-in-/ } });
        }
        if (conds.length) query.$or = conds;
      }

      const locationTerm = safeRegexTerm(location);
      if (locationTerm) {
        query.location = { $regex: locationTerm, $options: "i" };
      }

      const tagTerm = safeRegexTerm(tag);
      if (tagTerm) {
        query.tags = { $regex: `^${tagTerm}$`, $options: "i" };
      }

      // Bound the work per request. We never load descriptionHtml (large, and
      // only a minor scoring signal) and never hydrate full Mongoose docs.
      //
      // Candidate window: for users with no resume the ranking IS recency, so
      // the newest FEED_MAX is exactly the answer — no need to scan the whole
      // collection. For users with skills we score a generous window of the most
      // recent CANDIDATE_LIMIT active postings (a deliberate freshness-biased
      // trade-off so cost stays O(window), not O(all active jobs)).
      const candidateLimit = hasSkills ? CANDIDATE_LIMIT : FEED_MAX;
      const jobs = await Opportunity.find(query)
        .select("companySlug companyName title location tags applyUrl createdAt minExperience type")
        .sort({ createdAt: -1 })
        .limit(candidateLimit)
        .lean();

      // If we didn't fill the candidate window we already have every match, so
      // skip the extra count. Only pay for countDocuments when the window is
      // full and there may be more.
      const total =
        jobs.length < candidateLimit ? jobs.length : await Opportunity.countDocuments(query);

      // Format jobs with computed match summaries and scores, then rank by fit.
      // descriptionHtml is used only for server-side scoring, not by the card, so
      // it is deliberately omitted from the response to keep the payload small.
      const formattedJobs = jobs.map((job) => {
        const companyCapitalized = job.companySlug.charAt(0).toUpperCase() + job.companySlug.slice(1);
        const match = calculateMatch(matchProfile, { ...job, field: jobFieldFromSlug(job.companySlug) });

        return {
          _id: job._id.toString(),
          title: job.title,
          companySlug: job.companySlug,
          companyName: job.companyName || companyCapitalized,
          location: job.location,
          tags: job.tags,
          applyUrl: job.applyUrl,
          minExperience: job.minExperience,
          type: job.type,
          matchScore: match.score,
          matchingSkills: match.matchingSkills,
          missingSkills: match.missingSkills,
          matchSummary: match.matchSummary,
          matchExplanation: match.matchExplanation,
          createdAt: job.createdAt,
        };
      });

      // Rank by fit, then return the best FEED_MAX to bound the payload. `total`
      // lets the client show "N of M" and hint that filters reveal the rest.
      // `total` is the true count of matching active jobs (not just the scored
      // window), so the UI can honestly say how many roles the filters match.
      const ranked = rankByMatch(formattedJobs);
      return NextResponse.json({
        success: true,
        jobs: ranked.slice(0, FEED_MAX),
        total,
        isDemo: false,
        hasSkills,
      });
    } catch (dbError) {
      console.warn("Database query failed, falling back to mock jobs:", dbError);
      return getMockJobsFallback();
    }
  } catch (error: any) {
    console.error("Critical error in GET /api/jobs:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
export const dynamic = "force-dynamic";

