import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import UserProfile from "@/models/UserProfile";

/**
 * One-click unsubscribe from match-alert emails. GET is the human link in the
 * footer; POST backs the RFC 8058 `List-Unsubscribe-Post` header (inbox
 * providers fire it without a click). Both flip emailAlerts.enabled to false by
 * the unguessable per-user token — no login required.
 */

async function unsubscribe(token: string | null): Promise<boolean> {
  if (!token) return false;
  const db = await connectToDatabase();
  if (!db) return false;
  const res = await UserProfile.updateOne(
    { "emailAlerts.unsubscribeToken": token },
    { $set: { "emailAlerts.enabled": false } }
  );
  return res.matchedCount > 0;
}

function confirmationPage(ok: boolean): NextResponse {
  const title = ok ? "You're unsubscribed" : "Link not recognized";
  const body = ok
    ? "You won't receive match-alert emails anymore. You can re-enable them anytime from your profile."
    : "This unsubscribe link is invalid or has expired. If you keep getting emails, reply and we'll remove you.";
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/><title>${title} · UMBRIX</title></head>
<body style="margin:0;background:#faf9f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:460px;margin:12vh auto;padding:0 20px;text-align:center;">
  <div style="font:700 15px/1 ui-monospace,Menlo,monospace;letter-spacing:3px;color:#1a1a1a;margin-bottom:24px;">UMBRIX</div>
  <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 10px;">${title}</h1>
  <p style="font-size:14px;line-height:1.6;color:#6b6b6b;margin:0 0 22px;">${body}</p>
  <a href="/feed" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;font:600 13px/1;padding:10px 18px;border-radius:8px;">Back to UMBRIX</a>
</div></body></html>`;
  return new NextResponse(html, {
    status: ok ? 200 : 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const ok = await unsubscribe(token);
  return confirmationPage(ok);
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const ok = await unsubscribe(token);
  return NextResponse.json({ success: ok });
}

export const dynamic = "force-dynamic";
