// Server-only module: imports the DB layer and must never be pulled into a
// client bundle. Consumed by API route handlers (and future tracker gating).
import { connectToDatabase } from "@/lib/mongodb";
import { Subscription } from "@/models/Subscription";
import {
  computeEntitlement,
  FREE_ENTITLEMENT,
  type Entitlement,
} from "@/lib/entitlements";

/**
 * Resolve a user's current entitlement from the database. Read-only and
 * side-effect free: a user with no subscription record (the common case)
 * resolves to the plain free tier without a write. Any DB failure fails safe
 * to free rather than throwing — never accidentally grant premium.
 */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  try {
    const db = await connectToDatabase();
    if (!db) return FREE_ENTITLEMENT;
    const sub = await Subscription.findOne({ userId }).lean();
    return computeEntitlement(sub);
  } catch (e) {
    console.error("Failed to resolve entitlement, defaulting to free:", e);
    return FREE_ENTITLEMENT;
  }
}
