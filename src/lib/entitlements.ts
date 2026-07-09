/**
 * Entitlements — the single source of truth for "what is this user allowed to do".
 *
 * This module is intentionally PURE (no DB, no network, no mongoose import) so
 * it can be unit-tested in isolation and reused on client and server. The
 * DB-backed lookup lives in `entitlements.server.ts`; concrete payment
 * providers live behind `billing/types.ts`. Nothing here knows about Stripe,
 * Paddle, or any specific vendor — a provider only ever writes the fields on the
 * Subscription record that these functions read.
 */

export type PlanTier = "free" | "premium";

export type SubscriptionStatus =
  | "none"        // no subscription on record
  | "active"      // paid and current
  | "trialing"    // in a trial that still grants access
  | "past_due"    // payment failed, grace/dunning — no premium access
  | "canceled"    // ended
  | "incomplete"; // checkout started but never completed

/** The minimal shape the access rules read. Any provider maps onto this. */
export interface SubscriptionLike {
  plan?: PlanTier;
  status?: SubscriptionStatus;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean;
}

/** Free-tier limit for active tracker applications (null elsewhere == unlimited). */
export const FREE_TRACKER_ACTIVE_LIMIT = 10;

/** Statuses that grant premium access while the paid period is still valid. */
const ACCESS_GRANTING_STATUSES: SubscriptionStatus[] = ["active", "trialing"];

/**
 * Whether a subscription currently grants premium access. Access requires the
 * premium plan, an access-granting status, AND (if we know the period end) that
 * the paid period has not lapsed — so a lapsed record degrades to free even if a
 * webhook hasn't flipped its status yet. `now` is injectable for testing.
 */
export function isPremiumSubscription(
  sub: SubscriptionLike | null | undefined,
  now: Date = new Date()
): boolean {
  if (!sub || sub.plan !== "premium") return false;
  if (!sub.status || !ACCESS_GRANTING_STATUSES.includes(sub.status)) return false;
  if (sub.currentPeriodEnd) {
    const end = new Date(sub.currentPeriodEnd);
    if (!Number.isNaN(end.getTime()) && end.getTime() < now.getTime()) return false;
  }
  return true;
}

/** Resolved, serializable entitlement returned to callers and the client. */
export interface Entitlement {
  /** Effective plan (a lapsed premium record resolves to "free"). */
  plan: PlanTier;
  isPremium: boolean;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: {
    /** Max active tracker applications; null == unlimited. */
    trackerActiveApplications: number | null;
  };
}

/** The entitlement of a user with no subscription record — plain free tier. */
export const FREE_ENTITLEMENT: Entitlement = {
  plan: "free",
  isPremium: false,
  status: "none",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  limits: { trackerActiveApplications: FREE_TRACKER_ACTIVE_LIMIT },
};

/** Derive a full, serializable Entitlement from a subscription-like record. */
export function computeEntitlement(
  sub: SubscriptionLike | null | undefined,
  now: Date = new Date()
): Entitlement {
  const premium = isPremiumSubscription(sub, now);
  return {
    plan: premium ? "premium" : "free",
    isPremium: premium,
    status: sub?.status ?? "none",
    currentPeriodEnd: sub?.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd).toISOString()
      : null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    limits: {
      trackerActiveApplications: premium ? null : FREE_TRACKER_ACTIVE_LIMIT,
    },
  };
}
