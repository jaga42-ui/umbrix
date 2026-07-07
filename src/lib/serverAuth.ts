import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "./verifyFirebaseToken";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

/**
 * Server-side auth is enforced whenever a real Firebase project is configured.
 * In pure demo mode (no/placeholder Firebase config) it stays off so the app
 * keeps working with localStorage + mock data exactly as before.
 */
export function isServerAuthEnabled(): boolean {
  return (
    !!projectId &&
    projectId !== "placeholder-project-id" &&
    !projectId.startsWith("placeholder")
  );
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export interface ResolvedAuth {
  /** The trusted user id to scope this request to (verified uid when enforced). */
  userId?: string;
  /** Pre-built 401 response to return immediately when auth fails. */
  errorResponse?: NextResponse;
  /** Whether identity was cryptographically verified (vs. legacy demo fallback). */
  enforced: boolean;
}

/**
 * Resolves the caller's identity.
 *
 * When server auth is enabled, the `Authorization: Bearer <idToken>` header is
 * verified and the resulting uid is returned — any client-supplied userId is
 * ignored. When it is disabled (demo mode), the provided `fallbackUserId` is
 * trusted, preserving the original behavior.
 */
export async function resolveUserId(
  req: Request,
  fallbackUserId?: string | null
): Promise<ResolvedAuth> {
  if (!isServerAuthEnabled()) {
    return { userId: fallbackUserId ?? undefined, enforced: false };
  }

  const token = getBearerToken(req);
  if (!token) {
    return {
      enforced: true,
      errorResponse: NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  const uid = await verifyFirebaseIdToken(token, projectId!);
  if (!uid) {
    return {
      enforced: true,
      errorResponse: NextResponse.json(
        { success: false, error: "Invalid or expired session" },
        { status: 401 }
      ),
    };
  }

  return { userId: uid, enforced: true };
}
