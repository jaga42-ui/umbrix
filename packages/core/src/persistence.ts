/**
 * The single translation between the internal Job shape and the persisted
 * document.
 *
 * The live collection is "jobs" (72,405 documents, 6 indexes) and its field
 * names come from an earlier design: `companySlug`, `descriptionHtml`. Rather
 * than force every connector and pipeline stage to speak that vocabulary — or
 * migrate 72k documents to rename two fields — the translation is isolated
 * here. Changing either side is one edit to this file.
 *
 * Fields added by this platform (`sourceId`, `sourceJobId`, `category`,
 * `identityKey`, freshness) are all OPTIONAL additions to the schema: no
 * backfill, no index change, no migration. Existing documents simply lack them
 * until their next ingest, and every reader treats them as absent-by-default.
 */

import type { EnrichedJob } from './job';

/** The persisted document shape, matching `src/models/Opportunity.ts`. */
export interface OpportunityDoc {
  companySlug: string;
  companyName?: string;
  title: string;
  location: string;
  descriptionHtml: string;
  tags: string[];
  applyUrl: string;
  status: 'Active' | 'Closed';
  type: string;
  isIndia?: boolean;

  batchYears?: number[];
  branches?: string[];
  minExperience?: number;
  cgpaCutoff?: number;
  roleType?: string;
  eligibilitySource?: string;

  lastSeenAt: Date;

  // --- Added by the ingestion platform (all optional) ----------------------
  sourceId?: string;
  sourceJobId?: string;
  category?: string;
  identityKey?: string;
  postedAt?: Date;
  freshnessState?: string;
  freshnessScore?: number;
}

/**
 * Map an enriched job to its persisted form.
 *
 * `status` is deliberately not derived from freshness here. Closing a listing
 * is a decision about the whole corpus (has this source reported recently at
 * all?), not about one document in isolation, so it belongs to the freshness
 * sweep — see `@umbrix/freshness`.
 */
export function toOpportunityDoc(job: EnrichedJob, now: Date): OpportunityDoc {
  const { eligibility: e } = job;
  const doc: OpportunityDoc = {
    companySlug: job.groupSlug,
    title: job.title,
    location: job.location,
    descriptionHtml: job.description,
    tags: job.tags,
    applyUrl: job.applyUrl,
    status: 'Active',
    type: job.type,
    isIndia: job.isIndia,
    lastSeenAt: now,
    sourceId: job.sourceId,
    category: job.category,
    identityKey: job.identityKey,
  };

  // Only assign optionals when present. Writing `undefined` into a Mongoose
  // `$set` would clobber a value a stronger pass (the LLM eligibility cron)
  // had already derived.
  if (job.companyName) doc.companyName = job.companyName;
  if (job.sourceJobId) doc.sourceJobId = job.sourceJobId;
  if (job.postedAt) doc.postedAt = job.postedAt;
  if (job.workMode) doc.roleType = job.workMode;
  if (e.batchYears?.length) doc.batchYears = e.batchYears;
  if (e.branches?.length) doc.branches = e.branches;
  if (e.minExperience !== undefined) doc.minExperience = e.minExperience;
  if (e.cgpaCutoff !== undefined) doc.cgpaCutoff = e.cgpaCutoff;
  if (e.source) doc.eligibilitySource = e.source;
  if (job.freshness) {
    doc.freshnessState = job.freshness.state;
    doc.freshnessScore = job.freshness.score;
  }

  return doc;
}
