import { authedFetch } from "./authedFetch";
import { type AnalyticsEventName } from "./analyticsEvents";

/**
 * Lightweight first-party analytics client. Buffers events and flushes them
 * batched to /api/events, attaching the signed-in user's token (via authedFetch)
 * so events attribute to a real uid when possible. A stable `anonId` is always
 * sent, so guest events and pre-login events can be stitched to the account later.
 *
 * All functions are no-ops on the server (guarded on `window`).
 */

const ANON_KEY = "umbrix_anon_id";
const SESSION_KEY = "umbrix_session_id";
const FLUSH_DELAY_MS = 4000;
const MAX_BATCH = 25;

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older browsers.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Stable per-device anonymous id (survives across sessions). */
function getAnonId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

/** Per-tab session id; `isNew` is true the first time it's created this session. */
function getSessionId(): { id: string; isNew: boolean } {
  if (typeof window === "undefined") return { id: "", isNew: false };
  let id = sessionStorage.getItem(SESSION_KEY);
  const isNew = !id;
  if (!id) {
    id = uuid();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return { id, isNew };
}

interface QueuedEvent {
  event: AnalyticsEventName;
  anonId: string;
  sessionId: string;
  path?: string;
  props?: Record<string, unknown>;
}

let buffer: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

/** Flush the buffer via authedFetch (keeps auth attribution). Best-effort. */
async function flush(): Promise<void> {
  if (typeof window === "undefined") return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, MAX_BATCH);
  try {
    await authedFetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    // Drop on failure rather than growing the buffer unbounded — analytics is
    // never worth degrading the user's experience or memory.
  }
}

/**
 * Last-resort flush on page unload. sendBeacon can't set the Authorization
 * header, so these land as guest events — but the anonId still ties them to the
 * user, so no data is orphaned.
 */
function beaconFlush(): void {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, MAX_BATCH);
  try {
    const blob = new Blob([JSON.stringify({ events: batch })], { type: "application/json" });
    navigator.sendBeacon("/api/events", blob);
  } catch {
    /* best-effort */
  }
}

/**
 * Record a product event. Fire-and-forget: buffered and flushed in batches, with
 * the conversion event (apply_click) flushed promptly so it isn't lost on a fast
 * tab-away to the employer's site.
 */
export function track(event: AnalyticsEventName, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  buffer.push({
    event,
    anonId: getAnonId(),
    sessionId: getSessionId().id,
    path: window.location.pathname,
    props,
  });
  if (event === "apply_click" || buffer.length >= 10) {
    void flush();
  } else {
    scheduleFlush();
  }
}

let initialized = false;

/**
 * Initialize analytics once per page load: ensure the anon/session ids exist,
 * emit `session_start` on a fresh session (powers DAU + retention), and wire the
 * unload/visibility flushers. Safe to call multiple times.
 */
export function initAnalytics(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  getAnonId();
  const { isNew } = getSessionId();
  if (isNew) track("session_start");
  window.addEventListener("pagehide", beaconFlush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}
