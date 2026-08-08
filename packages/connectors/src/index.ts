/**
 * Connector registry.
 *
 * Adding a source is: write the module, add one line here. Nothing in the
 * pipeline, the runner, or the SEO layer needs to change — which is the
 * property the current design lacks, where a new source meant touching the
 * orchestrator, the workflow, and a hardcoded regex in `seoFields.ts`.
 */

import type { Connector } from '@umbrix/core';
import { greenhouseConnector } from './greenhouse.js';
import { leverConnector } from './lever.js';
import { adzunaConnector } from './adzuna.js';
import { workdayConnector } from './workday.js';

export * from './http.js';
export * from './validation.js';
export { greenhouseConnector, leverConnector, adzunaConnector, workdayConnector };

/** Every connector, keyed by id. */
export const CONNECTORS: Record<string, Connector<any>> = Object.fromEntries(
  [greenhouseConnector, leverConnector, adzunaConnector, workdayConnector].map((c) => [c.id, c])
);

export function getConnector(id: string): Connector<any> | undefined {
  return CONNECTORS[id];
}

/** Connector ids belonging to a scheduling tier. */
export function connectorsForTier(tier: number): Connector<any>[] {
  return Object.values(CONNECTORS).filter((c) => c.tier === tier);
}
