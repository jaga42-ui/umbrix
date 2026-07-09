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

/**
 * Whether the app is running in its live production environment. On Vercel this
 * is only the Production deployment (previews/dev may keep demo mode for
 * stakeholder demos); elsewhere it falls back to NODE_ENV. Used to guarantee
 * demo mode (unauthenticated access) can never run in production.
 */
export function isProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production";
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
    // Fail closed: demo mode grants unauthenticated access, which must never
    // happen in production. If auth is unconfigured in prod that is a
    // deployment misconfiguration — deny rather than expose every user's data.
    if (isProductionRuntime()) {
      console.error(
        "Server auth is not configured in production (missing NEXT_PUBLIC_FIREBASE_PROJECT_ID). Refusing unauthenticated access."
      );
      return {
        enforced: true,
        errorResponse: NextResponse.json(
          { success: false, error: "Server authentication is not configured" },
          { status: 503 }
        ),
      };
    }
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
