/**
 * User-facing freshness labels.
 *
 * The feed previously rendered "Posted 3d ago" from `createdAt` — the moment
 * UMBRIX first *discovered* a posting, which is neither when the employer
 * published it nor when we last confirmed it is still open. Measured against
 * production: 78% of active postings displayed a date that understated their
 * real freshness by 7+ days, and 38% by 30+ days, while every one of them had
 * been confirmed live on its source within 48 hours. A card saying "Posted 2mo
 * ago" about a job verified this morning is a trust defect, not a cosmetic one.
 *
 * The rule here is that a label may only claim what we actually know:
 *
 *   postedAt   the source told us when it was published  -> "Posted 2h ago"
 *   lastSeenAt an ingest run confirmed it is still listed -> "Verified today"
 *   createdAt  only when we know nothing else             -> "Listed 3d ago"
 *
 * "Verified" is used deliberately and literally: an ingest run re-fetched the
 * employer's board and the posting was still on it. That is a real check, which
 * is why it may be shown. Nothing here ever asserts a publication date we were
 * not given.
 *
 * Thresholds come from `@umbrix/freshness` so the label a user reads and the
 * state the pipeline stores can never drift apart.
 */

import { FRESHNESS_THRESHOLDS } from "@umbrix/freshness";

export type FreshnessTone = "fresh" | "normal" | "stale";

export interface FreshnessLabel {
  /** Short text for the card, e.g. "Verified today". */
  text: string;
  /** Drives styling — stale listings are muted rather than hidden. */
  tone: FreshnessTone;
  /** Longer explanation for a title attribute. */
  detail: string;
}

export interface FreshnessInput {
  /** When the source says the job was published. Rare — most sources omit it. */
  postedAt?: string | Date | null;
  /** When an ingest run last confirmed the posting is still on its source. */
  lastSeenAt?: string | Date | null;
  /** When UMBRIX first ingested it. A discovery date, not a publication date. */
  createdAt?: string | Date | null;
}

function toTime(value?: string | Date | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** "today" / "yesterday" / "3d ago" / "2mo ago" — never a future date. */
function ago(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(ms / 86_400_000);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Build the freshness label for a posting.
 *
 * @param input - Whichever timestamps the posting actually carries.
 * @param now - Injectable clock so the output is testable.
 */
export function freshnessLabel(input: FreshnessInput, now: number = Date.now()): FreshnessLabel | null {
  const posted = toTime(input.postedAt);
  const seen = toTime(input.lastSeenAt);
  const created = toTime(input.createdAt);

  // A confirmation older than the stale threshold is the honest headline
  // regardless of when the job was published: we no longer know it is open.
  if (seen !== null) {
    const unseenDays = (now - seen) / 86_400_000;
    if (unseenDays > FRESHNESS_THRESHOLDS.staleDays) {
      return {
        text: `Not confirmed in ${Math.round(unseenDays)}d`,
        tone: "stale",
        detail: "This listing has not been seen on the employer's site recently and may be closed.",
      };
    }
  }

  // The source gave a real publication date — the strongest thing we can say.
  if (posted !== null && posted <= now) {
    const elapsed = now - posted;
    return {
      text: `Posted ${ago(elapsed)}`,
      tone: elapsed <= FRESHNESS_THRESHOLDS.freshDays * 86_400_000 ? "fresh" : "normal",
      detail: "Publication date reported by the employer's job board.",
    };
  }

  // No publication date, but we re-checked the employer's board and it is
  // still listed. That is a genuine verification, so it can be stated as one.
  if (seen !== null) {
    const elapsed = now - seen;
    const days = Math.floor(elapsed / 86_400_000);
    return {
      text: days <= 0 ? "Verified today" : `Verified ${ago(elapsed)}`,
      tone: elapsed <= FRESHNESS_THRESHOLDS.freshDays * 86_400_000 ? "fresh" : "normal",
      detail: "We re-checked the employer's job board and this role was still listed.",
    };
  }

  // Nothing but our own discovery date. Say exactly that — "listed", not
  // "posted", because we do not know when the employer published it.
  if (created !== null) {
    return {
      text: `Listed ${ago(now - created)}`,
      tone: "normal",
      detail: "When this role was first added to Umbrix. The employer's publication date is unknown.",
    };
  }

  return null;
}
