import mongoose, { Schema, Document } from "mongoose";

export interface IExperience {
  role: string;
  company: string;
  duration?: string;
  description?: string;
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
  createdAt: Date;
  updatedAt: Date;
}

const ExperienceSchema = new Schema<IExperience>({
  role: { type: String, required: true },
  company: { type: String, required: true },
  duration: { type: String },
  description: { type: String },
});

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
  },
  { timestamps: true }
);

// Prevent compiling model multiple times in development hot reloading
const UserProfile = mongoose.models.UserProfile || mongoose.model<IUserProfile>("UserProfile", UserProfileSchema);
export default UserProfile;
