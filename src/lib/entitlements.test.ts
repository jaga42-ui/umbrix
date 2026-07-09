import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPremiumSubscription,
  computeEntitlement,
  isActiveTrackerStage,
  exceedsTrackerActiveLimit,
  FREE_TRACKER_ACTIVE_LIMIT,
} from "./entitlements";

const now = new Date("2026-07-09T00:00:00Z");
const future = new Date("2026-08-01T00:00:00Z");
const past = new Date("2026-06-01T00:00:00Z");

test("isPremiumSubscription: only premium plan with an access-granting status", () => {
  assert.equal(isPremiumSubscription(null, now), false);
  assert.equal(isPremiumSubscription({ plan: "free", status: "active" }, now), false);
  assert.equal(isPremiumSubscription({ plan: "premium", status: "active" }, now), true);
  assert.equal(isPremiumSubscription({ plan: "premium", status: "trialing" }, now), true);
  assert.equal(isPremiumSubscription({ plan: "premium", status: "past_due" }, now), false);
  assert.equal(isPremiumSubscription({ plan: "premium", status: "canceled" }, now), false);
});

test("isPremiumSubscription: a lapsed period degrades to free even if status says active", () => {
  assert.equal(isPremiumSubscription({ plan: "premium", status: "active", currentPeriodEnd: future }, now), true);
  assert.equal(isPremiumSubscription({ plan: "premium", status: "active", currentPeriodEnd: past }, now), false);
});

test("computeEntitlement: free vs premium shape and limits", () => {
  const free = computeEntitlement(null, now);
  assert.equal(free.isPremium, false);
  assert.equal(free.limits.trackerActiveApplications, FREE_TRACKER_ACTIVE_LIMIT);

  const prem = computeEntitlement({ plan: "premium", status: "active", currentPeriodEnd: future, cancelAtPeriodEnd: true }, now);
  assert.equal(prem.isPremium, true);
  assert.equal(prem.plan, "premium");
  assert.equal(prem.limits.trackerActiveApplications, null); // unlimited
  assert.equal(prem.cancelAtPeriodEnd, true);
  assert.equal(typeof prem.currentPeriodEnd, "string");
});

test("tracker cap helpers", () => {
  assert.equal(isActiveTrackerStage("Saved"), true);
  assert.equal(isActiveTrackerStage("Rejected"), false);
  assert.equal(exceedsTrackerActiveLimit(9, 10), false);
  assert.equal(exceedsTrackerActiveLimit(10, 10), true);
  assert.equal(exceedsTrackerActiveLimit(9999, null), false); // premium, unlimited
});
