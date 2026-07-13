import mongoose, { Schema, Document } from "mongoose";
import { randomBytes } from "crypto";

export interface IExperience {
  role: string;
  company: string;
  duration?: string;
  description?: string;
}

/** Daily match-alert email preferences (see MATCH_ALERTS_PLAN.md). */
export interface IEmailAlerts {
  /** Opt-in state. Default on; flipped off by the one-click unsubscribe link. */
  enabled: boolean;
  /** Unguessable token embedded in the unsubscribe URL. */
  unsubscribeToken: string;
  /** Cadence — daily for now; room to add "weekly" later. */
  cadence: "daily";
  /** Last successful digest send; dedupe window + "new since" cursor. */
  lastSentAt?: Date;
}

export interface IUserProfile extends Document {
  userId: string;
  name: string;
  email?: string;
  title?: string;
  summary?: string;
  skills: string[];
  experience: IExperience[];
  education: string[];
  rawText?: string;
  emailAlerts: IEmailAlerts;
  createdAt: Date;
  updatedAt: Date;
}

const ExperienceSchema = new Schema<IExperience>({
  role: { type: String, required: true },
  company: { type: String, required: true },
  duration: { type: String },
  description: { type: String },
});

const EmailAlertsSchema = new Schema<IEmailAlerts>(
  {
    enabled: { type: Boolean, default: true },
    unsubscribeToken: {
      type: String,
      default: () => randomBytes(24).toString("hex"),
      index: true,
    },
    cadence: { type: String, enum: ["daily"], default: "daily" },
    lastSentAt: { type: Date },
  },
  { _id: false }
);

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String },
    title: { type: String },
    summary: { type: String },
    skills: { type: [String], default: [] },
    experience: { type: [ExperienceSchema], default: [] },
    education: { type: [String], default: [] },
    rawText: { type: String },
    emailAlerts: { type: EmailAlertsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Prevent compiling model multiple times in development hot reloading
const UserProfile = mongoose.models.UserProfile || mongoose.model<IUserProfile>("UserProfile", UserProfileSchema);
export default UserProfile;
