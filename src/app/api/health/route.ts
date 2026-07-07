import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * Lightweight health/readiness probe for uptime monitors and deploy checks.
 * Reports overall status plus database reachability. Always returns 200 so a
 * transient DB blip (the app degrades to demo mode) doesn't page you — inspect
 * the `database` field for degraded state.
 */
export async function GET() {
  let database: "connected" | "unavailable" = "unavailable";

  try {
    const db = await connectToDatabase();
    if (db) database = "connected";
  } catch {
    database = "unavailable";
  }

  return NextResponse.json({
    status: "ok",
    database,
    timestamp: new Date().toISOString(),
  });
}

export const dynamic = "force-dynamic";
