import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * Append-only audit log of every candidate reveal — who unlocked whom, when, and
 * how it was paid for. Purposes: (1) audit / DPDP accountability, (2) idempotency
 * — a recruiter only pays once per candidate; re-viewing is free, and (3) manual
 * invoicing of pay-per-unlock customers before a payment provider is wired.
 */
export interface ICandidateUnlock extends Document {
  recruiterUserId: string;
  candidateUserId: string;
  method: "credit" | "seat";
  at: Date;
}

const CandidateUnlockSchema = new Schema<ICandidateUnlock>({
  recruiterUserId: { type: String, required: true, index: true },
  candidateUserId: { type: String, required: true, index: true },
  method: { type: String, enum: ["credit", "seat"], required: true },
  at: { type: Date, default: () => new Date() },
});

// One unlock per (recruiter, candidate) — re-viewing an already-unlocked
// candidate never charges again.
CandidateUnlockSchema.index({ recruiterUserId: 1, candidateUserId: 1 }, { unique: true });

export const CandidateUnlock: Model<ICandidateUnlock> =
  mongoose.models.CandidateUnlock ||
  mongoose.model<ICandidateUnlock>("CandidateUnlock", CandidateUnlockSchema);
