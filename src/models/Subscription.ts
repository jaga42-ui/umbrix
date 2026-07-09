import mongoose, { Document, Model, Schema } from "mongoose";
import type { PlanTier, SubscriptionStatus } from "@/lib/entitlements";

/**
 * Provider-agnostic subscription record, one per user (Firebase uid). A concrete
 * payment provider (Stripe, Paddle, …) writes the `provider*` fields and keeps
 * `plan` / `status` / `currentPeriodEnd` in sync via its webhooks; the app only
 * ever reads these through `computeEntitlement()`.
 */
export interface ISubscription extends Document {
  userId: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  /** Which provider owns this record, e.g. "stripe" | "paddle". */
  provider?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  interval?: "month" | "year";
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    plan: { type: String, enum: ["free", "premium"], default: "free" },
    status: {
      type: String,
      enum: ["none", "active", "trialing", "past_due", "canceled", "incomplete"],
      default: "none",
    },
    provider: { type: String },
    providerCustomerId: { type: String, index: true },
    providerSubscriptionId: { type: String, index: true },
    interval: { type: String, enum: ["month", "year"] },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
