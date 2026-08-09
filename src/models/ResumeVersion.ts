import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * A saved résumé version.
 *
 * Stores the *decisions* — which evidence appears, in which sections, in what
 * order — not the evidence itself. The bullets live once in the career profile,
 * so correcting a typo fixes every version at once while each version keeps its
 * own selection and ordering.
 *
 * Sections are a real subdocument array rather than a serialized blob, so a
 * version can be queried ("which versions still show this project?") and
 * migrated field-by-field later.
 */

export interface IResumeSection {
  id: string;
  kind: string;
  heading: string;
  visible: boolean;
  /** Ids into the user's career evidence. Not the evidence itself. */
  itemIds: string[];
}

export interface IResumeVersion extends Document {
  /** Firebase uid. Every query is scoped by this — a version is private. */
  userId: string;
  name: string;
  templateId: string;
  sections: IResumeSection[];
  /** The version this was branched from, for provenance. */
  derivedFrom?: string;
  /** The candidate's primary résumé. Exactly one per user. */
  isMaster: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ResumeSectionSchema = new Schema<IResumeSection>(
  {
    id: { type: String, required: true },
    kind: { type: String, required: true },
    heading: { type: String, required: true },
    visible: { type: Boolean, default: true },
    itemIds: { type: [String], default: [] },
  },
  { _id: false }
);

const ResumeVersionSchema = new Schema<IResumeVersion>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    templateId: { type: String, default: "classic" },
    sections: { type: [ResumeSectionSchema], default: [] },
    derivedFrom: { type: String },
    isMaster: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// The list view: a user's versions, most recently edited first.
ResumeVersionSchema.index({ userId: 1, updatedAt: -1 });
// A user may not have two versions with the same name — the picker would be
// ambiguous, and "which résumé did I send them?" is the question this feature
// exists to answer.
ResumeVersionSchema.index({ userId: 1, name: 1 }, { unique: true });

export const ResumeVersion: Model<IResumeVersion> =
  mongoose.models.ResumeVersion ||
  mongoose.model<IResumeVersion>("ResumeVersion", ResumeVersionSchema);

export default ResumeVersion;
