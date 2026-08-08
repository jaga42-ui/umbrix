/**
 * The connector contract.
 *
 * Today's adapters export `{ ats, tier, fetch }` and hand back objects the
 * orchestrator reshapes inline. That works but leaves each source untestable in
 * isolation: you cannot check that a connector normalizes correctly without
 * running the whole pipeline against the network.
 *
 * Splitting fetch from normalize is what makes a connector independently
 * testable — `normalize` is pure, so a recorded fixture exercises the real
 * mapping with no network at all.
 */

import type { NormalizedJob } from './job';

/** Per-run inputs a connector needs. One entry from the source registry. */
export interface FetchContext {
  /** The registry entry being fetched — board slug or aggregator shard. */
  slug: string;
  /** Free-form per-entry config (keywords, category, contract type, pages…). */
  config: Record<string, unknown>;
  /**
   * Cooperative cancellation. Long paginating connectors must pass this to
   * fetch() and stop promptly when a run is aborted or a budget is spent.
   */
  signal?: AbortSignal;
  /** Structured logger scoped to this connector and slug. */
  log: Logger;
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

/** Why a posting was rejected. Rejections are data, not exceptions. */
export interface ValidationIssue {
  field: string;
  message: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; issues: ValidationIssue[] };

export interface HealthReport {
  healthy: boolean;
  /** Round-trip time of the probe, milliseconds. */
  latencyMs?: number;
  detail?: string;
}

/**
 * A source connector.
 *
 * `TRaw` is the source's own payload type, so `normalize` is checked against
 * what `fetch` actually returns rather than against `any`.
 */
export interface Connector<TRaw = unknown> {
  /** Stable identifier, e.g. "greenhouse". Must match its filename. */
  readonly id: string;
  /**
   * Scheduling group. Kept from the current design, where it partitions the
   * staggered crons (1 = aggregator APIs, 3 = company ATS boards).
   */
  readonly tier: number;

  /** Pull raw postings. The only stage allowed to touch the network. */
  fetch(ctx: FetchContext): Promise<TRaw[]>;

  /**
   * Map one raw posting to the internal shape. MUST be pure — no network, no
   * clock, no randomness — so fixtures pin it exactly.
   */
  normalize(raw: TRaw, ctx: FetchContext): NormalizedJob;

  /** Reject postings that cannot be trusted downstream. Pure. */
  validate(job: NormalizedJob): ValidationResult;

  /**
   * Cheap liveness probe, independent of a full run. Lets the scheduler and
   * the health dashboard distinguish "source is down" from "source returned
   * nothing" — which the current pipeline cannot tell apart, and which
   * CLAUDE.md calls out as never assuming zero results means zero jobs.
   */
  healthCheck(): Promise<HealthReport>;
}
