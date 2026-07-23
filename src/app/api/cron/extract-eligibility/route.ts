import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import { extractEligibilityBatch } from "@/lib/eligibilityExtractLLM";
import { activeModelId, llmConfigured } from "@/lib/llmProvider";

/**
 * LLM eligibility-extraction cron. Enriches Active postings that still have an
 * unknown minExperience (which regex couldn't extract) by reading the JD. Runs a
 * bounded batch per invocation so it stays within the function time limit and
 * the provider's free-tier request quota; the daily backlog drains over a few
 * days, then it just keeps pace with new unknowns.
 *
 * Triggered by Vercel Cron (Authorization: Bearer CRON_SECRET). Query params:
 *   ?dryRun=1        — extract + return results, write nothing (precision gate)
 *   ?limit=<n>       — jobs to process this run (default 60, max 300)
 *   ?batch=<n>       — JDs per LLM call (default 8, max 15)
 *
 * Provenance: every processed job is stamped eligibilitySource="llm" +
 * eligibilityLLMAt=now (even when the JD states nothing), so it is never
 * reprocessed. Only postings with substantive JD text are fetched.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = request.headers.get("authorization") === `Bearer ${secret}`;
  if (secret) {
    if (!authed) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 60, 1), 300);
  const batchSize = Math.min(Math.max(Number(url.searchParams.get("batch")) || 6, 1), 15);

  if (!llmConfigured()) {
    return NextResponse.json(
      { success: false, error: "No LLM provider configured (set GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY)" },
      { status: 503 }
    );
  }

  try {
    const db = await connectToDatabase();
    if (!db) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 503 });

    // Addressable = Active, unknown minExperience, not yet LLM-processed, with
    // substantive JD text (the $expr excludes empty-content sources the LLM
    // can't help). The {status, minExperience, eligibilityLLMAt} index narrows
    // first; $expr filters the small remainder.
    const jobs = await Opportunity.find({
      status: "Active",
      minExperience: null,
      eligibilityLLMAt: { $exists: false },
      $expr: { $gt: [{ $strLenCP: { $ifNull: ["$descriptionHtml", ""] } }, 200] },
    })
      .select("title descriptionHtml")
      .limit(limit)
      .lean();

    if (jobs.length === 0) {
      return NextResponse.json({ success: true, dryRun, provider: activeModelId(), fetched: 0, message: "No addressable jobs remaining." });
    }

    const now = new Date();
    const ops: any[] = [];
    const previews: any[] = [];
    let llmBatches = 0;
    let filledMinExp = 0;
    let withBatchYears = 0;
    let withCgpa = 0;

    for (let i = 0; i < jobs.length; i += batchSize) {
      const slice = jobs.slice(i, i + batchSize).map((j: any) => ({
        id: j._id.toString(),
        title: j.title || "",
        content: j.descriptionHtml || "",
      }));

      const results = await extractEligibilityBatch(slice);
      llmBatches++;

      for (const item of slice) {
        const e = results.get(item.id); // may be undefined if the model omitted it
        const set: Record<string, unknown> = { eligibilitySource: "llm", eligibilityLLMAt: now };
        if (e) {
          if (e.minExperience !== undefined) {
            set.minExperience = e.minExperience;
            filledMinExp++;
          }
          if (e.batchYears.length) {
            set.batchYears = e.batchYears;
            withBatchYears++;
          }
          if (e.branches.length) set.branches = e.branches;
          if (e.cgpaCutoff !== undefined) {
            set.cgpaCutoff = e.cgpaCutoff;
            withCgpa++;
          }
        }
        if (dryRun) {
          previews.push({
            title: item.title.slice(0, 60),
            minExperience: e?.minExperience ?? null,
            batchYears: e?.batchYears ?? [],
            branches: e?.branches ?? [],
            cgpaCutoff: e?.cgpaCutoff ?? null,
          });
        } else {
          ops.push({ updateOne: { filter: { _id: item.id }, update: { $set: set } } });
        }
      }
    }

    if (!dryRun && ops.length) {
      await Opportunity.bulkWrite(ops, { ordered: false });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      provider: activeModelId(),
      fetched: jobs.length,
      llmBatches,
      filledMinExp,
      withBatchYears,
      withCgpa,
      ...(dryRun ? { previews } : {}),
    });
  } catch (error) {
    console.error("extract-eligibility cron error:", error);
    return NextResponse.json({ success: false, error: "Eligibility extraction run failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;
