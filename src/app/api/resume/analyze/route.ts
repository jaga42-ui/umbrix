import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import UserProfile from "@/models/UserProfile";
import { resolveUserId } from "@/lib/serverAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { analyzeResume } from "@/lib/resumeAnalyzer";
import { analyzeSkillGap } from "@/lib/skillGap";
import { fieldSlugConds } from "@/lib/seoFields";
import { fresherEligibleConditions } from "@/lib/fresherFilter";

/**
 * How many live listings to sample for the market comparison. Large enough that
 * skill frequencies are stable, bounded so one request cannot scan the whole
 * collection. Only `tags` is loaded — the rest of a document is irrelevant here.
 */
const MARKET_SAMPLE = 3000;

/**
 * Analyse the signed-in user's résumé.
 *
 * Two halves, deliberately different in kind:
 *
 *  - **Structure** (`analyzeResume`) is deterministic and instant — no model
 *    call, so this route is fast and free to run, and the same résumé always
 *    scores the same. That predictability is the point: a score that drifts
 *    between runs is not a score.
 *  - **Market fit** (`analyzeSkillGap`) is computed against live inventory, so
 *    "SQL appears in 340 roles you'd otherwise qualify for" is a count of real
 *    open listings rather than generic keyword advice.
 *
 * Read-only. Nothing here writes to the profile.
 */
export async function POST(request: Request) {
  const auth = await resolveUserId(request);
  if (auth.errorResponse) return auth.errorResponse;
  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Sign in to analyse your résumé", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  // The analysis itself is cheap, but the market query is not free — rate limit
  // so a loop cannot turn one account into a scan of the collection.
  const rl = await checkRateLimit("resumeAnalyze", userId);
  if (!rl.ok) return rl.response;

  try {
    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable", code: "DB_UNAVAILABLE" },
        { status: 503 }
      );
    }

    const profile = await UserProfile.findOne({ userId })
      .select("resumeText skills experience education email targetFields")
      .lean();

    // Ownership is implicit: the profile is fetched by the authenticated userId,
    // so a user can only ever analyse their own résumé.
    if (!profile?.resumeText) {
      return NextResponse.json(
        {
          success: false,
          error: "Upload your résumé first — we'll analyse it in a few seconds.",
          code: "NO_RESUME",
        },
        { status: 400 }
      );
    }

    const skills: string[] = Array.isArray(profile.skills) ? profile.skills : [];

    const analysis = analyzeResume({
      text: profile.resumeText,
      skills,
      experience: Array.isArray(profile.experience) ? profile.experience : [],
      education: Array.isArray(profile.education) ? profile.education : [],
      email: profile.email,
    });

    // Compare against the slice of the market this candidate is actually
    // eligible for — their fields, fresher-eligible, India. Comparing against
    // every listing would surface senior skills they cannot use yet.
    const fields: string[] = Array.isArray(profile.targetFields) ? profile.targetFields : [];
    const fieldConds = fields.flatMap((f) => fieldSlugConds(f));
    const marketQuery: Record<string, unknown> = {
      status: "Active",
      isIndia: true,
      // $and, because fresher-eligibility contributes its own $or and a
      // document can only carry one. This filter is what makes the comment
      // above true: with the old `$not: { $gte: 2 }` alone, senior roles with
      // an unstated experience level leaked into the sample and the skill gap
      // recommended exactly the senior skills it set out to exclude.
      $and: [
        ...fresherEligibleConditions(),
        ...(fieldConds.length > 0 ? [{ $or: fieldConds }] : []),
      ],
    };

    const marketJobs = await Opportunity.find(marketQuery)
      .select("tags")
      .limit(MARKET_SAMPLE)
      .lean();

    const skillGap = analyzeSkillGap(skills, marketJobs);

    return NextResponse.json({ success: true, analysis, skillGap });
  } catch (error) {
    // Never leak internals to the client; the message may contain query shape.
    console.error("resume analyze failed", error);
    return NextResponse.json(
      { success: false, error: "Could not analyse your résumé", code: "ANALYZE_FAILED" },
      { status: 500 }
    );
  }
}
