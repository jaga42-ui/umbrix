import mongoose, { Schema, Document } from "mongoose";
import type { StructuredResume } from "@/lib/resumeTailor";

/**
 * A résumé the AI tailored to one specific job. We store the structured JSON (not
 * a file) so re-download regenerates the .docx deterministically for free, the
 * user gets a history, and LLM spend is bounded (no re-generation on re-download).
 */
export interface ITailoredResume extends Document {
  userId: string;
  jobId?: string;
  jobTitle: string;
  company: string;
  resume: StructuredResume;
  modelId: string;
  createdAt: Date;
  updatedAt: Date;
}

const TailoredResumeSchema = new Schema<ITailoredResume>(
  {
    userId: { type: String, required: true, index: true },
    jobId: { type: String },
    jobTitle: { type: String, required: true },
    company: { type: String, required: true },
    // Generated structured résumé — shape validated by the Zod schema at write time.
    resume: { type: Schema.Types.Mixed, required: true },
    modelId: { type: String, required: true },
  },
  { timestamps: true }
);

// Quota counting (per user, per month) + history, newest first.
TailoredResumeSchema.index({ userId: 1, createdAt: -1 });

const TailoredResume =
  mongoose.models.TailoredResume ||
  mongoose.model<ITailoredResume>("TailoredResume", TailoredResumeSchema);
export default TailoredResume;
