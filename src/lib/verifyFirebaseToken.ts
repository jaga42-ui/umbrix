import { decodeProtectedHeader, importX509, jwtVerify } from "jose";

// Google's public x509 certificates used to sign Firebase ID tokens.
// Verifying against these requires only the (public) Firebase project ID —
// no service-account private key is needed.
const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

interface CertCache {
  keys: Record<string, string>;
  expiresAt: number;
}

let certCache: CertCache | null = null;

async function getSigningCerts(): Promise<Record<string, string>> {
  if (certCache && certCache.expiresAt > Date.now()) {
    return certCache.keys;
  }

  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase signing certificates (HTTP ${res.status})`);
  }

  const keys = (await res.json()) as Record<string, string>;

  // Respect Google's Cache-Control max-age so we don't refetch on every request.
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  certCache = { keys, expiresAt: Date.now() + maxAgeSeconds * 1000 };
  return keys;
}

/**
 * Verifies a Firebase ID token (RS256 JWT) against Google's public certs.
 * Returns the authenticated user's uid (the token `sub` claim), or null if
 * the token is missing, malformed, expired, or fails signature/claim checks.
 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string
): Promise<string | null> {
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== "RS256" || !header.kid) {
      return null;
    }

    const certs = await getSigningCerts();
    const cert = certs[header.kid];
    if (!cert) {
      return null;
    }

    const publicKey = await importX509(cert, "RS256");

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    // `sub` is the Firebase uid. jwtVerify already enforces exp/nbf.
    if (!payload.sub || typeof payload.sub !== "string") {
      return null;
    }

    // Firebase requires auth_time to be in the past.
    if (typeof payload.auth_time === "number" && payload.auth_time > Date.now() / 1000) {
      return null;
    }

    return payload.sub;
  } catch {
    // Any parse/network/verification error → treat as unauthenticated.
    return null;
  }
}
