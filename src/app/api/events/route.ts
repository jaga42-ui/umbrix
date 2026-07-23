import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { AnalyticsEvent } from "@/models/AnalyticsEvent";
import { resolveUserId } from "@/lib/serverAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isAnalyticsEvent } from "@/lib/analyticsEvents";

// Analytics ingest is intentionally OPEN (unlike other routes): it must capture
// unauthenticated visitors — the top of the funnel — so it never blocks guests.
// Identity is attributed opportunistically when a valid token is present.

const MAX_BATCH = 25;

/** Keep only primitive props, capped in count and length, so a client can't bloat a doc. */
function sanitizeProps(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= 20 || k.length > 40) continue;
    if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else continue;
    n++;
  }
  return Object.keys(out).length ? out : undefined;
}

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body", code: "BAD_JSON" }, { status: 400 });
    }

    const rawEvents = Array.isArray(body?.events) ? body.events : null;
    if (!rawEvents || rawEvents.length === 0) {
      return NextResponse.json(
        { success: false, error: "events must be a non-empty array", code: "NO_EVENTS" },
        { status: 400 }
      );
    }

    // Attribute to a verified uid when a valid token is present, but NEVER block:
    // resolveUserId's errorResponse (missing/invalid token, or demo-mode denial)
    // is deliberately ignored here — those requests are simply recorded as guests.
    const auth = await resolveUserId(request, null);
    const userId = auth.errorResponse ? undefined : auth.userId;
    const enforced = Boolean(userId) && auth.enforced;

    // anonId is the durable key (present for guests). Rate-limit by the best
    // identifier we have so one client can't flood the store.
    const firstAnon =
      typeof rawEvents[0]?.anonId === "string" ? rawEvents[0].anonId.slice(0, 64) : undefined;
    const identifier = userId || firstAnon || getClientIp(request);
    const rl = await checkRateLimit("events", identifier);
    if (!rl.ok) return rl.response;

    const docs: Record<string, unknown>[] = [];
    for (const e of rawEvents.slice(0, MAX_BATCH)) {
      if (!e || typeof e !== "object" || !isAnalyticsEvent(e.event)) continue;
      const anonId = typeof e.anonId === "string" ? e.anonId.trim().slice(0, 64) : "";
      if (!anonId) continue;
      docs.push({
        event: e.event,
        anonId,
        userId,
        enforced,
        sessionId: typeof e.sessionId === "string" ? e.sessionId.slice(0, 64) : undefined,
        path: typeof e.path === "string" ? e.path.slice(0, 200) : undefined,
        props: sanitizeProps(e.props),
      });
    }

    if (docs.length === 0) {
      return NextResponse.json(
        { success: false, error: "no valid events in batch", code: "NO_VALID_EVENTS" },
        { status: 400 }
      );
    }

    try {
      const db = await connectToDatabase();
      if (!db) {
        // Offline/demo: accept silently so the client never errors or retries.
        return NextResponse.json({ success: true, accepted: 0, isDemo: true });
      }
      // ordered:false → one bad doc never drops the rest of the batch.
      await AnalyticsEvent.insertMany(docs, { ordered: false });
      return NextResponse.json({ success: true, accepted: docs.length });
    } catch (dbError) {
      // Best-effort: an analytics write failure must never surface to the user.
      console.warn("Analytics insert failed:", dbError);
      return NextResponse.json({ success: true, accepted: 0, isDemo: true });
    }
  } catch (error: any) {
    console.error("Error in POST /api/events:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record events", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
