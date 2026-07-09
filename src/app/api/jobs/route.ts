import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Job } from "@/models/Job";
import UserProfile from "@/models/UserProfile";
import { resolveUserId } from "@/lib/serverAuth";
import { calculateMatch, rankByMatch, type MatchProfile } from "@/lib/matchScore";

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
        const match = calculateMatch(matchProfile, job);
        return {
          ...job,
          matchScore: match.score,
          matchingSkills: match.matchingSkills,
          missingSkills: match.missingSkills,
          matchSummary: match.matchSummary,
          matchExplanation: match.matchExplanation,
        };
      });

      return NextResponse.json({
        success: true,
        jobs: rankByMatch(formattedMockJobs),
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

      // Database is connected: build Mongoose query
      const query: any = { status: "Active" };

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { companySlug: { $regex: search, $options: "i" } },
          { descriptionHtml: { $regex: search, $options: "i" } },
        ];
      }

      if (location) {
        if (location.toLowerCase() === "remote") {
          query.location = { $regex: "remote", $options: "i" };
        } else {
          query.location = { $regex: location, $options: "i" };
        }
      }

      if (tag) {
        query.tags = { $regex: new RegExp(`^${tag}$`, "i") };
      }

      const jobs = await Job.find(query).sort({ createdAt: -1 });

      // Format jobs with computed match summaries and scores, then rank by fit.
      const formattedJobs = jobs.map((job) => {
        const companyCapitalized = job.companySlug.charAt(0).toUpperCase() + job.companySlug.slice(1);
        const match = calculateMatch(matchProfile, job);

        return {
          _id: job._id.toString(),
          title: job.title,
          companySlug: job.companySlug,
          companyName: companyCapitalized,
          location: job.location,
          tags: job.tags,
          applyUrl: job.applyUrl,
          descriptionHtml: job.descriptionHtml,
          matchScore: match.score,
          matchingSkills: match.matchingSkills,
          missingSkills: match.missingSkills,
          matchSummary: match.matchSummary,
          matchExplanation: match.matchExplanation,
          createdAt: job.createdAt,
        };
      });

      return NextResponse.json({
        success: true,
        jobs: rankByMatch(formattedJobs),
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

