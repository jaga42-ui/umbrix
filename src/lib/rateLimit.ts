import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Distributed rate limiting backed by Upstash Redis.
 *
 * Activates automatically when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set (provision "Upstash Redis" from the Vercel
 * Marketplace — the integration injects these env vars). When they are absent,
 * every check is allowed so local/demo development is unaffected.
 */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

if (!redis && process.env.NODE_ENV === "production") {
  console.warn(
    "⚠️ Upstash Redis is not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN). Rate limiting is disabled."
  );
}

function makeLimiter(requests: number, window: `${number} ${"s" | "m"}`) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: false,
    prefix: "umbrix/ratelimit",
  });
}

// Tunable limits. Resume upload is CPU-heavy (PDF parsing) so it's stricter.
const limiters = {
  upload: makeLimiter(5, "1 m"),
  write: makeLimiter(30, "1 m"),
} as const;

export type LimiterName = keyof typeof limiters;

/**
 * Enforces a rate limit for `identifier` (a uid or client IP) under the named
 * bucket. Returns `{ ok: true }` to proceed, or `{ ok:false, response }` with a
 * ready-to-return 429. Fails open if Redis is unreachable so a transient outage
 * never blocks legitimate traffic.
 */
export async function checkRateLimit(
  name: LimiterName,
  identifier: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const limiter = limiters[name];
  if (!limiter) return { ok: true };

  try {
    const { success, reset } = await limiter.limit(`${name}:${identifier}`);
    if (success) return { ok: true };

    const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      ),
    };
  } catch (e) {
    console.error("Rate limit check failed (failing open):", e);
    return { ok: true };
  }
}

/** Best-effort client IP for unauthenticated identifiers. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
