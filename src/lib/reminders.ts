/**
 * Reminder status for tracker applications. Pure and dependency-free so it can
 * be unit-tested and used on client and server. Works at day granularity — a
 * follow-up date is "overdue" only once its calendar day has passed.
 */

export type ReminderStatus = "none" | "overdue" | "soon" | "upcoming";

/** A reminder within this many days (inclusive) counts as "soon". */
export const REMINDER_SOON_DAYS = 3;

/** Whole-day number for a date, using its UTC calendar day. */
function utcDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000);
}

/**
 * Classify a reminder relative to `now`:
 *   - "none"     — no/invalid date
 *   - "overdue"  — the day has already passed
 *   - "soon"     — today through the next REMINDER_SOON_DAYS days
 *   - "upcoming" — further out
 */
export function reminderStatus(
  reminderAt?: string | Date | null,
  now: Date = new Date()
): ReminderStatus {
  if (!reminderAt) return "none";
  const d = new Date(reminderAt);
  if (Number.isNaN(d.getTime())) return "none";
  const diffDays = utcDayNumber(d) - utcDayNumber(now);
  if (diffDays < 0) return "overdue";
  if (diffDays <= REMINDER_SOON_DAYS) return "soon";
  return "upcoming";
}

/** Short, locale-friendly label for a reminder date, e.g. "Jul 15". */
export function formatReminderDate(reminderAt: string | Date): string {
  const d = new Date(reminderAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
