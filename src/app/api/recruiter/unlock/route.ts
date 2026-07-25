import { NextResponse } from "next/server";
import UserProfile from "@/models/UserProfile";
import { CandidateUnlock } from "@/models/CandidateUnlock";
import { RecruiterAccount, canUnlock } from "@/models/RecruiterAccount";
import { getRecruiter } from "@/lib/recruiterAuth";

export const dynamic = "force-dynamic";

/** Full candidate details revealed after an unlock. */
function reveal(p: any) {
  return {
    id: String(p._id),
    name: p.name,
    email: p.email || null,
    phone: null, // not collected yet
    title: p.title || null,
    summary: p.summary || null,
    skills: p.skills || [],
    experience: p.experience || [],
    education: p.education || [],
    resumeText: p.rawText || null,
  };
}

/**
 * Reveal a candidate's PII to a recruiter. Idempotent per (recruiter, candidate)
 * — re-opening an already-unlocked candidate is free. Otherwise it spends one
 * credit (payg) or uses the active monthly seat, and logs the unlock for audit
 * and manual invoicing.
 */
export async function POST(request: Request) {
  const r = await getRecruiter(request);
  if ("errorResponse" in r) return r.errorResponse;
  if (!r.account) {
    return NextResponse.json({ success: false, code: "NOT_RECRUITER", userId: r.userId }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON", code: "BAD_JSON" }, { status: 400 });
  }
  const candidateId = typeof body?.candidateId === "string" ? body.candidateId : "";
  if (!candidateId) {
    return NextResponse.json({ success: false, error: "candidateId is required", code: "NO_CANDIDATE" }, { status: 400 });
  }

  let candidate: any;
  try {
    candidate = await UserProfile.findById(candidateId).lean();
  } catch {
    candidate = null;
  }
  if (!candidate || !candidate.visibleToRecruiters) {
    // Opted out or gone — never reveal.
    return NextResponse.json(
      { success: false, error: "This candidate is no longer available.", code: "UNAVAILABLE" },
      { status: 404 }
    );
  }

  // Already unlocked → free re-open.
  const already = await CandidateUnlock.findOne({ recruiterUserId: r.userId, candidateUserId: candidateId });
  if (already) {
    return NextResponse.json({ success: true, alreadyUnlocked: true, candidate: reveal(candidate) });
  }

  if (!canUnlock(r.account)) {
    return NextResponse.json(
      { success: false, code: "NO_CREDITS", error: "No credits left (or your seat has expired). Contact the Umbrix team to top up." },
      { status: 402 }
    );
  }

  let method: "credit" | "seat" = "seat";
  if (r.account.plan === "payg") {
    // Atomic conditional decrement guards against a race / concurrent unlocks.
    const dec = await RecruiterAccount.findOneAndUpdate(
      { userId: r.userId, creditsBalance: { $gte: 1 } },
      { $inc: { creditsBalance: -1 } },
      { new: true }
    );
    if (!dec) {
      return NextResponse.json({ success: false, code: "NO_CREDITS", error: "No credits left." }, { status: 402 });
    }
    method = "credit";
  }

  try {
    await CandidateUnlock.create({ recruiterUserId: r.userId, candidateUserId: candidateId, method });
  } catch {
    // Duplicate key — unlocked concurrently. Refund the credit we just spent.
    if (method === "credit") {
      await RecruiterAccount.updateOne({ userId: r.userId }, { $inc: { creditsBalance: 1 } });
    }
  }

  const fresh = await RecruiterAccount.findOne({ userId: r.userId }).select("creditsBalance").lean();
  return NextResponse.json({
    success: true,
    candidate: reveal(candidate),
    creditsBalance: (fresh as any)?.creditsBalance ?? r.account.creditsBalance,
  });
}
