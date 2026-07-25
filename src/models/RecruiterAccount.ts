import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * A manually-onboarded recruiter/employer customer. Keyed by the recruiter's
 * Firebase uid (they sign in with Google like everyone else; access is granted
 * by the existence of this record — created via scripts/admin/create-recruiter-
 * account.js). No self-serve signup yet.
 *
 * Two plans:
 *  - "payg" — pay per unlock; each candidate reveal deducts one credit.
 *  - "seat" — a monthly seat; unlimited unlocks while seatExpiresAt is in the future.
 */
export type RecruiterPlan = "payg" | "seat";

export interface IRecruiterAccount extends Document {
  userId: string; // Firebase uid — the access key
  company: string;
  email: string;
  plan: RecruiterPlan;
  creditsBalance: number; // pay-per-unlock credits
  seatExpiresAt?: Date; // active monthly seat until this date
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RecruiterAccountSchema = new Schema<IRecruiterAccount>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    company: { type: String, required: true },
    email: { type: String, required: true },
    plan: { type: String, enum: ["payg", "seat"], default: "payg" },
    creditsBalance: { type: Number, default: 0 },
    seatExpiresAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/** Whether this account may unlock a candidate right now (seat active or credits left). */
export function canUnlock(acct: IRecruiterAccount): boolean {
  if (!acct.active) return false;
  if (acct.plan === "seat") return !!acct.seatExpiresAt && acct.seatExpiresAt.getTime() > Date.now();
  return acct.creditsBalance > 0;
}

export const RecruiterAccount: Model<IRecruiterAccount> =
  mongoose.models.RecruiterAccount ||
  mongoose.model<IRecruiterAccount>("RecruiterAccount", RecruiterAccountSchema);
