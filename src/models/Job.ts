import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IJob extends Document {
  companySlug: string;
  title: string;
  location: string;
  descriptionHtml: string;
  tags: string[];
  applyUrl: string;
  status: 'Active' | 'Closed';
  /** Last time an ingest run confirmed this posting is still live on the ATS. */
  lastSeenAt?: Date;
  /** When the job was reconciled to Closed (fell off its ATS feed). */
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    companySlug: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    descriptionHtml: {
      type: String,
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    applyUrl: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Closed'],
      default: 'Active',
      index: true,
    },
    lastSeenAt: {
      type: Date,
    },
    closedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// The feed's hot path: active jobs for a company, freshest first.
JobSchema.index({ status: 1, lastSeenAt: -1 });

// Feed candidate query: newest active postings first, bounded by limit.
JobSchema.index({ status: 1, createdAt: -1 });

export const Job: Model<IJob> =
  mongoose.models.Job || mongoose.model<IJob>('Job', JobSchema);
