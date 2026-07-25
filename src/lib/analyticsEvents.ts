/**
 * The canonical set of product-analytics event names. Shared by the client
 * tracker (src/lib/analytics.ts) and the server ingest route + model, so the two
 * can never drift. Pure module (no mongoose / no browser APIs) — safe to import
 * from anywhere.
 *
 * Keep this list small and funnel-focused. Each event should answer a retention
 * or conversion question, not just log activity:
 *   - session_start → DAU + D1/D7 retention (the north star)
 *   - feed_view     → did they reach the core value surface
 *   - apply_click   → the primary conversion (did a job move them to apply)
 *   - save_job      → intent signal below apply
 *   - resume_upload → activation (personalization unlocked)
 *   - signup        → guest → account conversion
 */
export const ANALYTICS_EVENTS = [
  "session_start",
  "feed_view",
  "apply_click",
  "save_job",
  "resume_upload",
  "signup",
  // Skill-gap affiliate: which gaps get clicked (demand), and which actually go
  // to a mapped course (conversion).
  "gap_nudge_click",
  "gap_course_view",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Whether an arbitrary value is a known event name (used for server-side validation). */
export function isAnalyticsEvent(value: unknown): value is AnalyticsEventName {
  return typeof value === "string" && (ANALYTICS_EVENTS as readonly string[]).includes(value);
}
