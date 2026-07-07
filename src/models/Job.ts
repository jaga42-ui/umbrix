import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IJob extends Document {
  companySlug: string;
  title: string;
  location: string;
  descriptionHtml: string;
  tags: string[];
  applyUrl: string;
  status: 'Active' | 'Closed';
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
    },
  },
  {
    timestamps: true,
  }
);

export const Job: Model<IJob> =
  mongoose.models.Job || mongoose.model<IJob>('Job', JobSchema);
