/**
 * The internal Job shape every connector produces and every pipeline stage
 * consumes.
 *
 * This is deliberately NOT the persisted document shape. The live collection
 * ("jobs", 72,405 documents) is described by `src/models/Opportunity.ts` and
 * carries names from an earlier design — `descriptionHtml`, `companySlug`. A
 * connector should not have to know those names, and the persisted schema
 * should not constrain what a pipeline stage can reason about. The single
 * translation between the two lives in the storage layer
 * (`packages/core/src/persistence.ts`), so renaming either side is one edit.
 */

/** Opportunity kinds Umbrix surfaces. Mirrors OPPORTUNITY_TYPES. */
export const JOB_TYPES = ['job', 'internship', 'hackathon', 'competition'] as const;
export type JobType = (typeof JOB_TYPES)[number];

/**
 * Normalized category. Every connector must map its source's raw category to
 * one of these — see `@umbrix/normalizer`. CLAUDE.md specifies this list; it
 * had never been implemented, so `department` currently reaches the database as
 * raw source text.
 */
export const JOB_CATEGORIES = [
  'it', 'engineering', 'finance', 'marketing', 'sales',
  'hr', 'customer-service', 'logistics', 'healthcare',
  'teaching', 'hospitality', 'admin', 'consultancy',
  'creative', 'manufacturing', 'retail', 'graduate',
  'government', 'internship', 'scholarship', 'general',
] as const;
export type JobCategory = (typeof JOB_CATEGORIES)[number];

/** Work arrangement, where the posting states it. */
export type WorkMode = 'onsite' | 'remote' | 'hybrid';

/** Eligibility a posting states explicitly. Absent fields mean "not stated". */
export interface Eligibility {
  /** Graduating batch years, e.g. [2025, 2026]. */
  batchYears?: number[];
  /** Eligible branches / streams, e.g. ["CSE", "ECE"]. */
  branches?: string[];
  /** Minimum years of experience. 0 means explicitly open to freshers. */
  minExperience?: number;
  /** Minimum CGPA on a 10-point scale. */
  cgpaCutoff?: number;
  /**
   * How this was derived. "source" outranks "regex": a connector that knows
   * from a structured field (e.g. an internship-only endpoint) is asserting,
   * not guessing, and must not be overwritten by a weaker inference.
   */
  source?: 'source' | 'regex' | 'llm';
}

/**
 * A job after normalization, before persistence.
 *
 * `sourceId` + `sourceJobId` together identify the posting at its origin and
 * are the strongest dedup signal available — far better than `applyUrl`, which
 * aggregators vary per listing (one source was measured re-listing 34% of roles
 * under distinct URLs, defeating the upsert key entirely).
 */
export interface NormalizedJob {
  /** Connector that produced this, e.g. "greenhouse". */
  sourceId: string;
  /** Stable id at the source, when it exposes one. */
  sourceJobId?: string;
  /**
   * Grouping key for reconciliation — a company board slug, or an aggregator
   * shard like "adzuna-in-sales". Maps to `companySlug` on the document.
   */
  groupSlug: string;

  title: string;
  companyName?: string;
  location: string;
  /** Description as delivered by the source. May contain HTML. */
  description: string;
  applyUrl: string;

  /**
   * Normalized category. First-class rather than parsed out of `groupSlug` —
   * `matchScore.ts:53 jobFieldFromSlug()` derives a field by string-matching
   * the "<source>-in-<field>" convention, and that coupling has already caused
   * one production defect.
   */
  category: JobCategory;
  type: JobType;
  workMode?: WorkMode;
  tags: string[];

  isIndia: boolean;
  eligibility: Eligibility;

  /** When the source says the job was posted, if it says. */
  postedAt?: Date;
  /** When the source last reported a change, if it reports one. */
  sourceUpdatedAt?: Date;
}

/** A NormalizedJob plus everything the pipeline derived about it. */
export interface EnrichedJob extends NormalizedJob {
  /** Stable identity used for cross-source dedup. See `@umbrix/dedupe`. */
  identityKey: string;
  scam?: { verdict: 'safe' | 'suspicious' | 'blocked'; score: number; reasons: string[] };
  freshness?: { state: string; score: number; reasons: string[] };
}
