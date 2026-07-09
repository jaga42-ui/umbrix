import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Application } from "@/models/Application";
import { resolveUserId } from "@/lib/serverAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getEntitlement } from "@/lib/entitlements.server";
import { isActiveTrackerStage, exceedsTrackerActiveLimit } from "@/lib/entitlements";
import {
  ValidationError,
  reqString,
  optString,
  optDate,
  reqEnum,
} from "@/lib/validation";

const STAGES = ["Saved", "Applied", "Interview", "Rejected"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await resolveUserId(request, searchParams.get("userId"));
    if (auth.errorResponse) return auth.errorResponse;
    const userId = auth.userId;

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    try {
      const db = await connectToDatabase();
      if (!db) {
        return NextResponse.json({ success: true, applications: [], isDemo: true });
      }

      const apps = await Application.find({ userId }).sort({ order: 1 });
      return NextResponse.json({ success: true, applications: apps, isDemo: false });
    } catch (dbError: any) {
      console.warn("Tracker GET failed, falling back to demo mode:", dbError);
      return NextResponse.json({ success: true, applications: [], isDemo: true });
    }
  } catch (error: any) {
    console.error("Error in GET /api/tracker:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const auth = await resolveUserId(request, body.userId);
    if (auth.errorResponse) return auth.errorResponse;
    const userId = auth.userId;

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const rl = await checkRateLimit("write", userId);
    if (!rl.ok) return rl.response;

    let fields;
    try {
      fields = {
        title: reqString(body.title, "title", 200),
        company: reqString(body.company, "company", 160),
        location: reqString(body.location, "location", 160),
        stage: body.stage === undefined ? ("Saved" as const) : reqEnum(body.stage, "stage", STAGES),
        applyUrl: optString(body.applyUrl, "applyUrl", 2000),
        notes: optString(body.notes, "notes", 5000),
        jobId: optString(body.jobId, "jobId", 100),
        reminderAt: optDate(body.reminderAt, "reminderAt"),
      };
    } catch (e) {
      if (e instanceof ValidationError) {
        return NextResponse.json({ success: false, error: e.message }, { status: 400 });
      }
      throw e;
    }

    try {
      const db = await connectToDatabase();
      if (!db) {
        return NextResponse.json({ success: true, isDemo: true });
      }

      // Free-tier cap: block a new *active* application (Saved/Applied/Interview)
      // once the user is at their limit. Premium (limit === null) is unlimited;
      // Rejected additions never count. Only enforced for real, authed users.
      if (auth.enforced && isActiveTrackerStage(fields.stage)) {
        const { limits, plan } = await getEntitlement(userId);
        const limit = limits.trackerActiveApplications;
        const activeCount = await Application.countDocuments({
          userId,
          stage: { $ne: "Rejected" },
        });
        if (exceedsTrackerActiveLimit(activeCount, limit)) {
          return NextResponse.json(
            {
              success: false,
              code: "LIMIT_REACHED",
              error: `Your free plan tracks up to ${limit} active applications. Upgrade to Premium for unlimited tracking.`,
              limit,
              plan,
            },
            { status: 403 }
          );
        }
      }

      // Determine current order count to put it at the bottom of the column
      const count = await Application.countDocuments({ userId, stage: fields.stage });

      const newApp = new Application({
        userId,
        title: fields.title,
        company: fields.company,
        location: fields.location,
        stage: fields.stage,
        order: count,
        applyUrl: fields.applyUrl,
        notes: fields.notes || "",
        jobId: fields.jobId,
        reminderAt: fields.reminderAt ?? null,
      });

      await newApp.save();
      return NextResponse.json({ success: true, application: newApp, isDemo: false });
    } catch (dbError: any) {
      console.warn("Tracker POST failed, falling back to demo mode:", dbError);
      return NextResponse.json({ success: true, isDemo: true });
    }
  } catch (error: any) {
    console.error("Error in POST /api/tracker:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, stage, order, title, company, location, notes, applyUrl, reminderAt } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Application ID is required" }, { status: 400 });
    }

    const auth = await resolveUserId(request, null);
    if (auth.errorResponse) return auth.errorResponse;

    const rl = await checkRateLimit("write", auth.userId ?? id);
    if (!rl.ok) return rl.response;

    const updateFields: any = {};
    try {
      if (stage !== undefined) updateFields.stage = reqEnum(stage, "stage", STAGES);
      if (order !== undefined) {
        if (typeof order !== "number" || !Number.isFinite(order) || order < 0) {
          throw new ValidationError("order must be a non-negative number");
        }
        updateFields.order = order;
      }
      if (title !== undefined) updateFields.title = reqString(title, "title", 200);
      if (company !== undefined) updateFields.company = reqString(company, "company", 160);
      if (location !== undefined) updateFields.location = reqString(location, "location", 160);
      if (notes !== undefined) updateFields.notes = optString(notes, "notes", 5000) ?? "";
      if (applyUrl !== undefined) updateFields.applyUrl = optString(applyUrl, "applyUrl", 2000);
      // optDate returns null for an explicit clear, which we persist as-is.
      if (reminderAt !== undefined) updateFields.reminderAt = optDate(reminderAt, "reminderAt");
    } catch (e) {
      if (e instanceof ValidationError) {
        return NextResponse.json({ success: false, error: e.message }, { status: 400 });
      }
      throw e;
    }

    try {
      const db = await connectToDatabase();
      if (!db) {
        return NextResponse.json({ success: true, isDemo: true });
      }

      // When auth is enforced, scope by owner so a user can only edit their own cards.
      const filter = auth.enforced ? { _id: id, userId: auth.userId } : { _id: id };
      const updatedApp = await Application.findOneAndUpdate(
        filter,
        { $set: updateFields },
        { new: true }
      );

      if (!updatedApp) {
        return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, application: updatedApp, isDemo: false });
    } catch (dbError: any) {
      console.warn("Tracker PUT failed, falling back to demo mode:", dbError);
      return NextResponse.json({ success: true, isDemo: true });
    }
  } catch (error: any) {
    console.error("Error in PUT /api/tracker:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const auth = await resolveUserId(request, null);
    if (auth.errorResponse) return auth.errorResponse;

    try {
      const db = await connectToDatabase();
      if (!db) {
        return NextResponse.json({ success: true, isDemo: true });
      }

      // When auth is enforced, scope by owner so a user can only delete their own cards.
      const filter = auth.enforced ? { _id: id, userId: auth.userId } : { _id: id };
      const deletedApp = await Application.findOneAndDelete(filter);
      if (!deletedApp) {
        return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, isDemo: false });
    } catch (dbError: any) {
      console.warn("Tracker DELETE failed, falling back to demo mode:", dbError);
      return NextResponse.json({ success: true, isDemo: true });
    }
  } catch (error: any) {
    console.error("Error in DELETE /api/tracker:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
