import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IApplication extends Document {
  userId: string;
  title: string;
  company: string;
  location: string;
  stage: 'Saved' | 'Applied' | 'Interview' | 'Rejected';
  order: number;
  applyUrl?: string;
  notes?: string;
  jobId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    company: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    stage: {
      type: String,
      enum: ['Saved', 'Applied', 'Interview', 'Rejected'],
      default: 'Saved',
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    applyUrl: {
      type: String,
    },
    notes: {
      type: String,
      default: '',
    },
    jobId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for the common query: a user's board sorted by column + order.
ApplicationSchema.index({ userId: 1, stage: 1, order: 1 });

export const Application: Model<IApplication> =
  mongoose.models.Application || mongoose.model<IApplication>('Application', ApplicationSchema);
