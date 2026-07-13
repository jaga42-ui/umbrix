import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import UserProfile from "@/models/UserProfile";
import { selectDigestJobs, type DigestCandidate } from "@/lib/digest";
import { renderDigestEmail } from "@/lib/email/digestTemplate";
import { sendEmail } from "@/lib/email/client";
import { jobFieldFromSlug, type MatchProfile } from "@/lib/matchScore";

// Look back a little over a day so the daily run always covers the latest ingest
// with margin; per-user we further trim to "since your last digest".
const WINDOW_HOURS = 26;
// Don't re-send within this gap even if the route is hit twice in a day.
const RESEND_GAP_HOURS = 20;
// Bound the scored candidate set per run.
const CANDIDATE_LIMIT = 3000;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://umbrix.vercel.app";

/**
 * Daily match-digest cron. Triggered by Vercel Cron (Authorization: Bearer
 * CRON_SECRET). Supports ?dryRun=1 (select + render, no send) and ?testTo=<uid>
 * (process only that user; a real send that doesn't stamp lastSentAt, so you can
 * re-test). See MATCH_ALERTS_PLAN.md.
 */
export async function GET(request: Request) {
  // --- Auth -----------------------------------------------------------------
  const secret = process.env.CRON_SECRET;
  const authed = request.headers.get("authorization") === `Bearer ${secret}`;
  if (secret) {
    if (!authed) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const testTo = url.searchParams.get("testTo") || undefined;

  try {
    const db = await connectToDatabase();
    if (!db) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 503 });

    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_HOURS * 3600_000);

    // 1. Fetch the recent, eligible candidate pool once and reuse across users.
    const rawJobs = await Opportunity.find({
      status: "Active",
      isIndia: true,
      createdAt: { $gt: windowStart },
    })
      .select("companySlug companyName title location tags applyUrl minExperience createdAt")
      .sort({ createdAt: -1 })
      .limit(CANDIDATE_LIMIT)
      .lean();

    const candidates: (DigestCandidate & { createdAt: Date })[] = rawJobs.map((j: any) => ({
      id: j._id.toString(),
      title: j.title,
      tags: j.tags || [],
      minExperience: j.minExperience ?? null,
      companyName: j.companyName,
      companySlug: j.companySlug,
      field: jobFieldFromSlug(j.companySlug),
      location: j.location,
      applyUrl: j.applyUrl,
      createdAt: j.createdAt,
    }));

    // 2. Opted-in users with an email + at least one skill. (`enabled !== false`
    //    also opts in existing users who predate the emailAlerts field.)
    const userQuery: Record<string, unknown> = testTo
      ? { userId: testTo }
      : {
          email: { $exists: true, $nin: [null, ""] },
          "skills.0": { $exists: true },
          "emailAlerts.enabled": { $ne: false },
        };
    const profiles = await UserProfile.find(userQuery);

    let sent = 0;
    let skippedNoMatch = 0;
    let skippedRecent = 0;
    let skippedNoEmail = 0;
    let failed = 0;
    const previews: Array<{ to: string; subject: string; jobs: number }> = [];

    for (const profile of profiles) {
      if (!profile.email) {
        skippedNoEmail++;
        continue;
      }

      // Lazily backfill an unsubscribe token for pre-existing users.
      if (!profile.emailAlerts?.unsubscribeToken) {
        profile.emailAlerts = {
          ...(profile.emailAlerts?.toObject?.() ?? profile.emailAlerts ?? {}),
          enabled: profile.emailAlerts?.enabled ?? true,
          cadence: "daily",
          unsubscribeToken: randomBytes(24).toString("hex"),
        } as any;
        await profile.save();
      }

      const lastSentAt: Date | undefined = profile.emailAlerts?.lastSentAt;
      if (!testTo && lastSentAt && now.getTime() - new Date(lastSentAt).getTime() < RESEND_GAP_HOURS * 3600_000) {
        skippedRecent++;
        continue;
      }

      // Only roles newer than the user's last digest (bounded by the fetch window).
      const cutoff = lastSentAt ? new Date(lastSentAt) : windowStart;
      const fresh = candidates.filter((c) => c.createdAt > cutoff);

      const matchProfile: MatchProfile = {
        skills: profile.skills || [],
        title: profile.title,
        experience: profile.experience,
        targetFields: profile.targetFields || [],
      };
      const jobs = selectDigestJobs(matchProfile, fresh);

      if (jobs.length === 0) {
        skippedNoMatch++;
        continue;
      }

      const unsubscribeUrl = `${SITE_URL}/api/alerts/unsubscribe?token=${profile.emailAlerts.unsubscribeToken}`;
      const { subject, html, text } = renderDigestEmail({
        name: profile.name,
        jobs,
        feedUrl: `${SITE_URL}/feed`,
        unsubscribeUrl,
      });

      if (dryRun) {
        previews.push({ to: profile.email, subject, jobs: jobs.length });
        continue;
      }

      const result = await sendEmail({
        to: profile.email,
        subject,
        html,
        text,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      if (result.ok) {
        sent++;
        // testTo is for repeated testing — don't stamp so it can re-send.
        if (!testTo) {
          profile.emailAlerts.lastSentAt = now;
          await profile.save();
        }
      } else if (result.skipped) {
        // No API key configured — surface it as a preview rather than a failure.
        previews.push({ to: profile.email, subject, jobs: jobs.length });
      } else {
        failed++;
        console.error(`digest send failed for ${profile.email}: ${result.error}`);
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      testTo: testTo ?? null,
      candidates: candidates.length,
      users: profiles.length,
      sent,
      failed,
      skippedNoMatch,
      skippedRecent,
      skippedNoEmail,
      ...(previews.length ? { previews } : {}),
    });
  } catch (error) {
    console.error("match-digest cron error:", error);
    return NextResponse.json({ success: false, error: "Digest run failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;
