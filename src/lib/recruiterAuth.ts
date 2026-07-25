import "server-only";
import { NextResponse } from "next/server";
import { resolveUserId } from "./serverAuth";
import { connectToDatabase } from "./mongodb";
import { RecruiterAccount, type IRecruiterAccount } from "@/models/RecruiterAccount";

/**
 * Resolve the caller as a recruiter. Returns either a ready-to-send error
 * response, or the verified uid plus their RecruiterAccount (null when the user
 * is signed in but not onboarded as a recruiter — the caller returns 403 with
 * the uid so the page can show a "share this id with us" state).
 */
export async function getRecruiter(
  req: Request
): Promise<{ errorResponse: NextResponse } | { userId: string; account: IRecruiterAccount | null }> {
  const auth = await resolveUserId(req, null);
  if (auth.errorResponse) return { errorResponse: auth.errorResponse };
  const userId = auth.userId;
  if (!userId) {
    return {
      errorResponse: NextResponse.json({ success: false, error: "Sign in required", code: "NO_AUTH" }, { status: 401 }),
    };
  }
  try {
    const db = await connectToDatabase();
    if (!db) {
      return { errorResponse: NextResponse.json({ success: false, error: "Database unavailable" }, { status: 503 }) };
    }
    const account = await RecruiterAccount.findOne({ userId });
    return { userId, account };
  } catch {
    return { errorResponse: NextResponse.json({ success: false, error: "Recruiter lookup failed" }, { status: 500 }) };
  }
}

/** Coarse education level for anonymized cards — never the institution. */
export function educationLevel(education: string[] = []): string {
  const t = education.join(" ").toLowerCase();
  if (/\b(m\.?tech|m\.?e\b|mba|mca|m\.?sc|master|post[\s-]?grad|ph\.?d)\b/.test(t)) return "Master's / PG";
  if (/\b(b\.?tech|b\.?e\b|b\.?com|b\.?sc|bca|bba|bachelor|under[\s-]?grad)\b/.test(t)) return "Bachelor's";
  if (/\bdiploma\b/.test(t)) return "Diploma";
  return education.length ? "Graduate" : "Not specified";
}
