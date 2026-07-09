import { NextResponse } from "next/server";
import { resolveUserId } from "@/lib/serverAuth";
import { getEntitlement } from "@/lib/entitlements.server";
import { FREE_ENTITLEMENT } from "@/lib/entitlements";

/**
 * Returns the authenticated user's current entitlement. Used by the client to
 * decide whether to show/enable premium features. Scoped to the verified uid —
 * a client can never ask about another user's plan. In demo mode (auth not
 * enforced) there is no real subscription, so it returns the free tier.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await resolveUserId(request, searchParams.get("userId") || "demo-user-123");
    if (auth.errorResponse) return auth.errorResponse;

    if (!auth.enforced) {
      return NextResponse.json({ success: true, entitlement: FREE_ENTITLEMENT, isDemo: true });
    }

    const entitlement = await getEntitlement(auth.userId!);
    return NextResponse.json({ success: true, entitlement, isDemo: false });
  } catch (error: unknown) {
    // Fail safe to free rather than 500 — a billing hiccup must never brick the app.
    console.error("Error in GET /api/entitlement:", error);
    return NextResponse.json({ success: true, entitlement: FREE_ENTITLEMENT, isDemo: false });
  }
}

export const dynamic = "force-dynamic";
