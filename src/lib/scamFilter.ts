// Typed wrapper around the canonical scam heuristics in `scripts/scamFilter.js`.
// That module is CommonJS because the ingest pipeline runs outside the Next build
// (plain `node scripts/ingest-jobs.js`), so it stays the single source of truth
// and both the ingest and this app consume it. `allowJs` + `esModuleInterop`
// (tsconfig) make this cross-boundary import type-check and bundle cleanly.
import scamFilter from "../../scripts/scamFilter.js";

export interface ScamVerdict {
  /** True when the weighted score meets the scam threshold. */
  isScam: boolean;
  /** Weighted heuristic score (higher = more scam signals). */
  score: number;
  /** Human-readable reasons each signal fired — powers the "why" in the UI. */
  reasons: string[];
}

export interface ScamInput {
  title?: string;
  content?: string;
  applyUrl?: string;
}

const impl = scamFilter as unknown as {
  evaluate: (input: ScamInput) => ScamVerdict;
  THRESHOLD: number;
};

/** Score arbitrary pasted text (job post / message / offer) for scam signals. */
export function evaluateScam(input: ScamInput): ScamVerdict {
  return impl.evaluate(input);
}

/** Score at or above which a posting is treated as a scam. */
export const SCAM_THRESHOLD = impl.THRESHOLD;
