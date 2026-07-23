import mongoose, { Document, Model, Schema } from "mongoose";
import { ANALYTICS_EVENTS } from "@/lib/analyticsEvents";

/**
 * An append-only product-analytics event. First-party (stored in our own Mongo)
 * so retention cohorts and funnels can be computed directly with aggregation —
 * no third-party dependency, and the data stays ours.
 *
 * `anonId` is the durable key: it's present for guests too and is attached to
 * every authed event alongside `userId`, so a guest's pre-login events can be
 * stitched to their account post-hoc via the shared anonId.
 */
export interface IAnalyticsEvent extends Document {
  event: string;
  /** Stable client-generated anonymous id (localStorage). Present for guests. */
  anonId: string;
  /** Verified Firebase uid when the request carried a valid token. */
  userId?: string;
  /** Whether `userId` was cryptographically verified (vs. absent/guest). */
  enforced: boolean;
  /** Per-tab session id (sessionStorage) — bounds a "session" for funnels. */
  sessionId?: string;
  /** Page path the event fired on. */
  path?: string;
  /** Small bag of sanitized primitive props (e.g. jobId, score, field). */
  props?: Record<string, unknown>;
  createdAt: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    event: { type: String, required: true, enum: ANALYTICS_EVENTS },
    anonId: { type: String, required: true },
    userId: { type: String },
    enforced: { type: Boolean, default: false },
    sessionId: { type: String },
    path: { type: String },
    props: { type: Schema.Types.Mixed },
  },
  // Events are immutable — only createdAt matters, never updatedAt.
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Retention cohorts by stable anon id (guests + stitched to userId post-login).
AnalyticsEventSchema.index({ anonId: 1, createdAt: 1 });
// Retention / attribution by verified user.
AnalyticsEventSchema.index({ userId: 1, createdAt: 1 });
// Funnel / per-event time series (newest first).
AnalyticsEventSchema.index({ event: 1, createdAt: -1 });

export const AnalyticsEvent: Model<IAnalyticsEvent> =
  mongoose.models.AnalyticsEvent ||
  mongoose.model<IAnalyticsEvent>("AnalyticsEvent", AnalyticsEventSchema, "analytics_events");
