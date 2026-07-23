"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

/**
 * Mounts once at the app root to boot analytics on every page load — records the
 * session (DAU/retention) and wires the unload flushers. Renders nothing.
 */
export function AnalyticsInit() {
  useEffect(() => {
    initAnalytics();
  }, []);
  return null;
}
