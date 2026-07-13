import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import UserProfile from "@/models/UserProfile";
import TailoredResume from "@/models/TailoredResume";
import { resolveUserId } from "@/lib/serverAuth";
import { getEntitlement } from "@/lib/entitlements.server";
import { checkRateLimit } from "@/lib/rateLimit";
import { tailorResume, tailoringConfigured, activeModelId } from "@/lib/resumeTailor";
import { reqString, optString, ValidationError } from "@/lib/validation";

function stripHtml(s: string): string {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function startOfMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Generate a résumé tailored to one job. Auth-scoped, quota-limited (free tier =
 * N/month, premium = unlimited), and rate-limited. Stores the structured result
 * so re-download never re-generates. See RESUME_TAILORING_PLAN.md.
 */
export async function POST(request: Request) {
  const auth = await resolveUserId(request);
  if (auth.errorResponse) return auth.errorResponse;
  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  if (!tailoringConfigured) {
    return NextResponse.json(
      { success: false, error: "AI résumé tailoring isn't enabled yet." },
      { status: 503 }
    );
  }

  const rl = await checkRateLimit("tailor", userId);
  if (!rl.ok) return rl.response;

  // Two ways to specify the target job: a `jobId` (feed-saved cards → full job
  // description for best tailoring) OR raw `title`+`company` (manually-added
  // tracker cards that aren't linked to a feed job).
  let jobId: string | undefined;
  let manualTitle: string | undefined;
  let manualCompany: string | undefined;
  let manualDescription: string | undefined;
  try {
    const body = await request.json();
    jobId = optString(body?.jobId, "jobId", 100);
    if (!jobId) {
      manualTitle = reqString(body?.title, "title", 200);
      manualCompany = reqString(body?.company, "company", 200);
      manualDescription = optString(body?.description, "description", 8000);
    }
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  try {
    const db = await connectToDatabase();
    if (!db) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 503 });

    const profile = await UserProfile.findOne({ userId }).lean<any>();
    const hasResume =
      profile && ((profile.skills?.length ?? 0) > 0 || (profile.experience?.length ?? 0) > 0 || profile.rawText);
    if (!hasResume) {
      return NextResponse.json(
        { success: false, error: "Upload your résumé first so we can tailor it.", code: "NO_RESUME" },
        { status: 400 }
      );
    }

    // Monthly quota (free tier). Premium (limit === null) is unlimited.
    const entitlement = await getEntitlement(userId);
    const limit = entitlement.limits.resumeTailorsPerMonth;
    let used = 0;
    if (limit !== null) {
      used = await TailoredResume.countDocuments({ userId, createdAt: { $gte: startOfMonth() } });
      if (used >= limit) {
        return NextResponse.json(
          {
            success: false,
            error: `You've used all ${limit} free tailored résumés this month. Upgrade for unlimited.`,
            code: "QUOTA_REACHED",
            limit,
            used,
          },
          { status: 403 }
        );
      }
    }

    // Resolve the target job from either the linked Opportunity or raw fields.
    let jobTitle: string;
    let company: string;
    let description = "";
    let tags: string[] = [];
    let minExperience: number | null = null;
    if (jobId) {
      let job: any = null;
      try {
        job = await Opportunity.findById(jobId)
          .select("title companyName companySlug descriptionHtml tags minExperience")
          .lean<any>();
      } catch {
        job = null; // malformed id
      }
      if (!job) {
        return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
      }
      jobTitle = job.title;
      company = job.companyName || job.companySlug;
      description = stripHtml(job.descriptionHtml);
      tags = job.tags || [];
      minExperience = job.minExperience ?? null;
    } else {
      jobTitle = manualTitle!;
      company = manualCompany!;
      description = manualDescription || "";
    }

    const resume = await tailorResume(
      {
        name: profile.name,
        email: profile.email,
        title: profile.title,
        summary: profile.summary,
        skills: profile.skills || [],
        experience: profile.experience || [],
        education: profile.education || [],
        rawText: profile.rawText,
      },
      { title: jobTitle, company, description, tags, minExperience }
    );

    const saved = await TailoredResume.create({
      userId,
      jobId,
      jobTitle,
      company,
      resume,
      modelId: activeModelId(),
    });

    return NextResponse.json({
      success: true,
      id: saved._id.toString(),
      resume,
      remaining: limit === null ? null : Math.max(0, limit - used - 1),
    });
  } catch (error) {
    console.error("resume tailor error:", error);
    return NextResponse.json(
      { success: false, error: "Couldn't tailor your résumé right now. Please try again." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
