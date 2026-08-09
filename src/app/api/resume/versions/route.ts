import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import ResumeVersion from "@/models/ResumeVersion";
import { resolveUserId } from "@/lib/serverAuth";
import { getEntitlement } from "@/lib/entitlements.server";
import { checkRateLimit } from "@/lib/rateLimit";
import { reqString, ValidationError } from "@/lib/validation";

/**
 * Saved résumé versions.
 *
 * Every query is scoped by the authenticated `userId`, so a version is private
 * by construction rather than by a check that could be forgotten — there is no
 * code path that reads a version without the owner's id in the filter.
 *
 * Stores the decisions (which evidence, which section, what order), never the
 * evidence itself. That is what lets a typo fix propagate to every version
 * while each keeps its own selection.
 */

/** Bounds a single document so one request cannot store an unbounded blob. */
const MAX_SECTIONS = 20;
const MAX_ITEMS_PER_SECTION = 60;

/** The untrusted shape as it arrives on the wire. */
interface IncomingSection {
  id?: unknown;
  kind?: unknown;
  heading?: unknown;
  visible?: unknown;
  itemIds?: unknown;
}

/** The narrowed shape, after validation, ready to persist. */
interface ParsedSection {
  id: string;
  kind: string;
  heading: string;
  visible: boolean;
  itemIds: string[];
}

/**
 * Validate and narrow the incoming sections.
 *
 * Ids are accepted as opaque strings but capped in length and count: they are
 * references into the caller's own evidence, so the risk is size rather than
 * injection, and Mongoose casts them as strings regardless.
 */
function parseSections(raw: unknown): ParsedSection[] {
  if (!Array.isArray(raw)) throw new ValidationError("sections must be an array");
  if (raw.length > MAX_SECTIONS) throw new ValidationError(`at most ${MAX_SECTIONS} sections`);

  return raw.map((entry, index) => {
    const section = (entry ?? {}) as IncomingSection;
    const itemIds = Array.isArray(section.itemIds) ? section.itemIds : [];
    if (itemIds.length > MAX_ITEMS_PER_SECTION) {
      throw new ValidationError(`section ${index} has too many items`);
    }
    return {
      id: reqString(section.id, "section.id", 60),
      kind: reqString(section.kind, "section.kind", 40),
      heading: reqString(section.heading, "section.heading", 80),
      visible: section.visible !== false,
      itemIds: itemIds.slice(0, MAX_ITEMS_PER_SECTION).map((id) => String(id).slice(0, 60)),
    };
  });
}

/** List the signed-in user's versions. */
export async function GET(request: Request) {
  const auth = await resolveUserId(request);
  if (auth.errorResponse) return auth.errorResponse;
  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to see your résumés", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  try {
    const db = await connectToDatabase();
    if (!db) return NextResponse.json({ error: "Service unavailable", code: "DB_UNAVAILABLE" }, { status: 503 });

    const versions = await ResumeVersion.find({ userId }).sort({ updatedAt: -1 }).lean();
    return NextResponse.json({
      success: true,
      versions: versions.map((v) => ({
        id: String(v._id),
        name: v.name,
        templateId: v.templateId,
        sections: v.sections,
        isMaster: v.isMaster,
        derivedFrom: v.derivedFrom,
        updatedAt: v.updatedAt,
      })),
    });
  } catch (error) {
    console.error("resume versions list failed", error);
    return NextResponse.json({ error: "Could not load your résumés", code: "LIST_FAILED" }, { status: 500 });
  }
}

/**
 * Create or update a version.
 *
 * An `id` updates in place; without one a new version is created, subject to
 * the plan's version limit.
 */
export async function POST(request: Request) {
  const auth = await resolveUserId(request);
  if (auth.errorResponse) return auth.errorResponse;
  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to save", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const rl = await checkRateLimit("write", userId);
  if (!rl.ok) return rl.response;

  try {
    const body = await request.json();
    const name = reqString(body?.name, "name", 80);
    const sections = parseSections(body?.sections);
    const templateId = body?.templateId ? reqString(body.templateId, "templateId", 40) : "classic";
    const id = body?.id ? String(body.id) : null;

    const db = await connectToDatabase();
    if (!db) return NextResponse.json({ error: "Service unavailable", code: "DB_UNAVAILABLE" }, { status: 503 });

    if (id) {
      // Scoped by userId as well as id, so a guessed id cannot reach another
      // user's document.
      const updated = await ResumeVersion.findOneAndUpdate(
        { _id: id, userId },
        { $set: { name, sections, templateId } },
        { new: true }
      ).lean();
      if (!updated) {
        return NextResponse.json({ error: "Résumé not found", code: "NOT_FOUND" }, { status: 404 });
      }
      return NextResponse.json({ success: true, id: String(updated._id), updatedAt: updated.updatedAt });
    }

    const [entitlement, count] = await Promise.all([
      getEntitlement(userId),
      ResumeVersion.countDocuments({ userId }),
    ]);
    const limit = entitlement.limits.resumeVersions;
    if (limit !== null && count >= limit) {
      // A limit message should say what the user gets, not just what they cannot
      // do — and the first résumé keeps every editing and analysis feature.
      return NextResponse.json(
        {
          error: `You can keep ${limit} saved résumé on the free plan. Umbrix Pro keeps a separate version for each kind of role you apply to.`,
          code: "VERSION_LIMIT",
          limit,
        },
        { status: 403 }
      );
    }

    const created = await ResumeVersion.create({
      userId,
      name,
      sections,
      templateId,
      derivedFrom: body?.derivedFrom ? String(body.derivedFrom) : undefined,
      isMaster: count === 0,
    });
    return NextResponse.json({ success: true, id: String(created._id), updatedAt: created.updatedAt });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, code: "INVALID_INPUT" }, { status: 400 });
    }
    // A duplicate name collides on the unique index; that is a user-fixable
    // conflict, not a server fault.
    if (typeof error === "object" && error && (error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: "You already have a résumé with that name.", code: "DUPLICATE_NAME" },
        { status: 409 }
      );
    }
    console.error("resume version save failed", error);
    return NextResponse.json({ error: "Could not save your résumé", code: "SAVE_FAILED" }, { status: 500 });
  }
}

/** Delete a version. The master is protected. */
export async function DELETE(request: Request) {
  const auth = await resolveUserId(request);
  if (auth.errorResponse) return auth.errorResponse;
  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to delete", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required", code: "INVALID_INPUT" }, { status: 400 });

    const db = await connectToDatabase();
    if (!db) return NextResponse.json({ error: "Service unavailable", code: "DB_UNAVAILABLE" }, { status: 503 });

    const version = await ResumeVersion.findOne({ _id: id, userId }).lean();
    if (!version) return NextResponse.json({ error: "Résumé not found", code: "NOT_FOUND" }, { status: 404 });
    if (version.isMaster) {
      return NextResponse.json(
        { error: "This is your main résumé. Rename it or delete a targeted version instead.", code: "MASTER_PROTECTED" },
        { status: 409 }
      );
    }

    await ResumeVersion.deleteOne({ _id: id, userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("resume version delete failed", error);
    return NextResponse.json({ error: "Could not delete", code: "DELETE_FAILED" }, { status: 500 });
  }
}
