/**
 * Connector registry.
 *
 * Adding a source is: write the module, add one line here. Nothing in the
 * pipeline, the runner, or the SEO layer needs to change — which is the
 * property the current design lacks, where a new source meant touching the
 * orchestrator, the workflow, and a hardcoded regex in `seoFields.ts`.
 */

import type { Connector } from '@umbrix/core';

/**
 * A connector with its raw payload type erased.
 *
 * The registry is heterogeneous — every connector has its own `TRaw` — and
 * TypeScript has no existential types, so there is no sound way to store them
 * in one map without erasure. The escape is contained to this alias: each
 * connector's own `fetch`/`normalize` pair remains typed consistently with
 * itself, and the runner only ever passes a connector's output back into that
 * same connector.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyConnector = Connector<any>;
import { greenhouseConnector } from './greenhouse';
import { leverConnector } from './lever';
import { adzunaConnector } from './adzuna';
import { workdayConnector } from './workday';
import { serpapiConnector } from './serpapi';
import { jsearchConnector } from './jsearch';

export * from './http';
export * from './validation';
export { greenhouseConnector, leverConnector, adzunaConnector, workdayConnector, serpapiConnector, jsearchConnector };

/** Every connector, keyed by id. */
export const CONNECTORS: Record<string, AnyConnector> = Object.fromEntries(
  [greenhouseConnector, leverConnector, adzunaConnector, workdayConnector, serpapiConnector, jsearchConnector].map((c) => [c.id, c])
);

export function getConnector(id: string): AnyConnector | undefined {
  return CONNECTORS[id];
}

/** Connector ids belonging to a scheduling tier. */
export function connectorsForTier(tier: number): AnyConnector[] {
  return Object.values(CONNECTORS).filter((c) => c.tier === tier);
}
