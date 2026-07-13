import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import TailoredResume from "@/models/TailoredResume";
import { resolveUserId } from "@/lib/serverAuth";
import { renderResumeDocx, resumeFileName } from "@/lib/resumeDocx";

/**
 * Download a previously-tailored résumé as an ATS-safe .docx. Renders on the fly
 * from the stored structured JSON (no regeneration), scoped to the owner.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolveUserId(request);
  if (auth.errorResponse) return auth.errorResponse;
  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const db = await connectToDatabase();
    if (!db) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 503 });

    let doc: any = null;
    try {
      doc = await TailoredResume.findById(id).lean<any>();
    } catch {
      doc = null; // malformed id → treat as not found
    }
    // Owner-scoped: never leak another user's résumé.
    if (!doc || doc.userId !== userId) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const buffer = await renderResumeDocx(doc.resume);
    const filename = resumeFileName(doc.resume?.contact?.name || "resume", doc.company, doc.jobTitle);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("resume download error:", error);
    return NextResponse.json({ success: false, error: "Download failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
