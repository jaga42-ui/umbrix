import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * An Opportunity is the generalized unit UMBRIX surfaces: today jobs and
 * internships, later hackathons and competitions. It supersedes the old `Job`
 * model. The Mongo collection stays **"jobs"** (pinned below) so the existing
 * ~12k documents and their indexes are reused with no data migration.
 */

export const OPPORTUNITY_TYPES = ['job', 'internship', 'hackathon', 'competition'] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export interface IOpportunity extends Document {
  /** The company slug this posting belongs to, from its ATS board. */
  companySlug: string;
  /** Display name of the hiring company, derived from the ATS. */
  companyName?: string;
  title: string;
  location: string;
  descriptionHtml: string;
  tags: string[];
  applyUrl: string;
  status: 'Active' | 'Closed';
  /** What kind of opportunity this is. Defaults to "job" for back-compat. */
  type: OpportunityType;

  // --- Fresher eligibility (optional; populated by extraction, WIP) ----------
  /** Graduating batch years eligible, e.g. [2025, 2026]. */
  batchYears: number[];
  /** Eligible branches / streams, e.g. ["CSE", "IT", "ECE"]. */
  branches: string[];
  /** Minimum years of experience required (0 = open to freshers). */
  minExperience?: number;
  /** Minimum CGPA / percentage cutoff, if stated. */
  cgpaCutoff?: number;
  /** Employment type where relevant: "full-time" | "part-time" | "contract" | "internship". */
  roleType?: string;
  /** Whether the role is in / open to India (drives the location filter). */
  isIndia?: boolean;

  /** Last time an ingest run confirmed this posting is still live on the ATS. */
  lastSeenAt?: Date;
  /** When the opportunity was reconciled to Closed (fell off its ATS feed). */
  closedAt?: Date;

  // --- Eligibility extraction provenance -------------------------------------
  /** How eligibility was last derived: "regex" (ingest) or "llm" (enrichment pass). */
  eligibilitySource?: string;
  /** When the LLM eligibility pass last processed this posting (dedup guard). */
  eligibilityLLMAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const OpportunitySchema = new Schema<IOpportunity>(
  {
    companySlug: { type: String, required: true, index: true },
    companyName: { type: String },
    title: { type: String, required: true },
    location: { type: String, required: true },
    descriptionHtml: { type: String, required: true },
    tags: { type: [String], default: [] },
    applyUrl: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Closed'], default: 'Active', index: true },
    type: {
      type: String,
      enum: OPPORTUNITY_TYPES,
      default: 'job',
      index: true,
    },

    // Eligibility (optional scaffolding; extraction + matching land next).
    batchYears: { type: [Number], default: [] },
    branches: { type: [String], default: [] },
    minExperience: { type: Number },
    cgpaCutoff: { type: Number },
    roleType: { type: String },
    isIndia: { type: Boolean },

    lastSeenAt: { type: Date },
    closedAt: { type: Date },
    eligibilitySource: { type: String },
    eligibilityLLMAt: { type: Date },
  },
  { timestamps: true }
);

// Feed hot path: active opportunities for a company, freshest seen first.
OpportunitySchema.index({ status: 1, lastSeenAt: -1 });
// Feed candidate query: newest active first, bounded by limit.
OpportunitySchema.index({ status: 1, createdAt: -1 });
// Default feed query: India + active, newest first. The most-hit query in the
// app — covering isIndia here lets the index satisfy the filter AND the sort,
// so the candidate window fetches ~limit docs instead of ~3x (India is ~a third
// of active postings) by scanning {status, createdAt} and filtering in memory.
OpportunitySchema.index({ status: 1, isIndia: 1, createdAt: -1 });
// Feed by type (jobs vs internships) once the toggle lands.
OpportunitySchema.index({ status: 1, type: 1, createdAt: -1 });
// LLM eligibility backfill: active postings still missing minExperience that the
// LLM pass hasn't processed yet (eligibilityLLMAt unset).
OpportunitySchema.index({ status: 1, minExperience: 1, eligibilityLLMAt: 1 });

// Third arg pins the collection to "jobs" — the model is renamed, the data is not.
export const Opportunity: Model<IOpportunity> =
  mongoose.models.Opportunity ||
  mongoose.model<IOpportunity>('Opportunity', OpportunitySchema, 'jobs');
