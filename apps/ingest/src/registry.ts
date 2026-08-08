/**
 * The source registry.
 *
 * Reads `scripts/companies.json`, which the current pipeline already uses, so
 * both systems run from one list and cannot drift while they coexist. Every
 * key beyond `slug`/`ats` is passed through untouched as connector config —
 * that pass-through is what keeps company-specific knowledge out of the
 * framework: a connector declares what config it reads, the registry just
 * carries it.
 */

import { createRequire } from 'node:module';
import type { RegistryEntry } from './pool';

const require = createRequire(import.meta.url);

interface RawEntry {
  slug: string;
  ats: string;
  [key: string]: unknown;
}

export function loadRegistry(): RegistryEntry[] {
  const raw = require('../../../scripts/companies.json') as RawEntry[];
  return raw.map(({ slug, ats, ...config }) => ({ slug, source: ats, config }));
}

export interface RegistryFilter {
  /** Only this connector id. */
  source?: string;
  /** Only connectors in this scheduling tier. */
  tier?: number;
  /** Only this registry slug. */
  slug?: string;
  /** Cap the number of entries — for smoke runs. */
  limit?: number;
}

export function filterRegistry(
  entries: RegistryEntry[],
  filter: RegistryFilter,
  tierOf: (source: string) => number | undefined
): RegistryEntry[] {
  let out = entries;
  if (filter.source) out = out.filter((e) => e.source === filter.source);
  if (filter.slug) out = out.filter((e) => e.slug === filter.slug);
  if (filter.tier !== undefined) out = out.filter((e) => tierOf(e.source) === filter.tier);
  // Entries whose connector is not registered are dropped, not fatal — the old
  // and new systems share one registry, so the new one legitimately does not
  // implement every source yet.
  out = out.filter((e) => tierOf(e.source) !== undefined);
  if (filter.limit !== undefined) out = out.slice(0, filter.limit);
  return out;
}
