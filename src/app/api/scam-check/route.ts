import { NextResponse } from "next/server";
import { evaluateScam } from "@/lib/scamFilter";
import { reqString, ValidationError } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// A pasted job post / WhatsApp message / offer letter. Capped so a single
// request can't ship a huge payload into the regex engine.
const MAX_TEXT = 8000;

// First URL in the pasted text — passed as the "apply link" so the filter's
// untrusted-host check (bit.ly / t.me / wa.me …) fires on pasted messages too.
const URL_RE = /https?:\/\/[^\s<>"')]+/i;

export async function POST(request: Request) {
  try {
    // Public, unauthenticated endpoint → rate-limit by client IP.
    const limit = await checkRateLimit("scamCheck", getClientIp(request));
    if (!limit.ok) return limit.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    let text: string;
    try {
      text = reqString((body as { text?: unknown })?.text, "text", MAX_TEXT);
    } catch (e) {
      if (e instanceof ValidationError) {
        return NextResponse.json({ success: false, error: e.message }, { status: 400 });
      }
      throw e;
    }

    const applyUrl = (text.match(URL_RE) || [])[0];
    const verdict = evaluateScam({ content: text, applyUrl });

    // Tiered, deliberately honest verdict. "clean" means *no signals detected*,
    // which is NOT a safety guarantee — the client copy must say so.
    const level = verdict.score >= 3 ? "scam" : verdict.score >= 1 ? "caution" : "clean";

    return NextResponse.json({
      success: true,
      level,
      score: verdict.score,
      reasons: verdict.reasons,
    });
  } catch (error) {
    console.error("scam-check error:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
