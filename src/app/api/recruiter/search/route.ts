import { NextResponse } from "next/server";
import UserProfile from "@/models/UserProfile";
import { CandidateUnlock } from "@/models/CandidateUnlock";
import { canUnlock } from "@/models/RecruiterAccount";
import { getRecruiter, educationLevel } from "@/lib/recruiterAuth";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 60;

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Recruiter candidate search. Returns ONLY anonymized cards (skills, target
 * fields, education level, experience count, match %) — never name/email/phone/
 * résumé. That PII is revealed only by /api/recruiter/unlock. Candidates are
 * included only when they've explicitly opted in (visibleToRecruiters).
 */
export async function GET(request: Request) {
  const r = await getRecruiter(request);
  if ("errorResponse" in r) return r.errorResponse;
  if (!r.account) {
    // Signed in, but not onboarded as a recruiter yet.
    return NextResponse.json(
      { success: false, code: "NOT_RECRUITER", userId: r.userId, error: "You're not set up as a recruiter yet." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const skillTerms = (searchParams.get("skill") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  const field = (searchParams.get("field") || "").trim();
  const fresherOnly = searchParams.get("fresher") === "1";
  const minMatch = Math.min(Math.max(Number(searchParams.get("minMatch")) || 0, 0), 100);

  const query: Record<string, unknown> = {
    visibleToRecruiters: true,
    "skills.0": { $exists: true },
  };
  if (field) query.targetFields = field;
  if (skillTerms.length) {
    query.skills = { $in: skillTerms.map((s) => new RegExp(`^${esc(s)}$`, "i")) };
  }
  if (fresherOnly) {
    // Fresher proxy: at most one prior role on the résumé.
    query.$expr = { $lte: [{ $size: { $ifNull: ["$experience", []] } }, 1] };
  }

  const profiles = await UserProfile.find(query)
    .select("skills targetFields education experience")
    .limit(MAX_RESULTS)
    .lean();

  // Which of these has this recruiter already unlocked (shows as revealed, free to re-open).
  const ids = profiles.map((p: any) => String(p._id));
  const unlocked = new Set(
    (await CandidateUnlock.find({ recruiterUserId: r.userId, candidateUserId: { $in: ids } })
      .select("candidateUserId")
      .lean()
    ).map((u: any) => u.candidateUserId)
  );

  const lowerTerms = skillTerms.map((s) => s.toLowerCase());
  const cards = profiles
    .map((p: any) => {
      const skills: string[] = p.skills || [];
      const matched = lowerTerms.length
        ? lowerTerms.filter((t) => skills.some((s) => s.toLowerCase() === t)).length
        : 0;
      const matchPct = lowerTerms.length ? Math.round((matched / lowerTerms.length) * 100) : null;
      return {
        id: String(p._id),
        skills: skills.slice(0, 12),
        fields: p.targetFields || [],
        educationLevel: educationLevel(p.education),
        experienceCount: Array.isArray(p.experience) ? p.experience.length : 0,
        matchPct,
        unlocked: unlocked.has(String(p._id)),
      };
    })
    .filter((c) => c.matchPct === null || c.matchPct >= minMatch)
    .sort((a, b) => (b.matchPct ?? 0) - (a.matchPct ?? 0));

  return NextResponse.json({
    success: true,
    account: {
      company: r.account.company,
      plan: r.account.plan,
      creditsBalance: r.account.creditsBalance,
      canUnlock: canUnlock(r.account),
    },
    count: cards.length,
    candidates: cards,
  });
}
