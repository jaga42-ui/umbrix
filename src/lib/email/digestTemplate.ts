import type { DigestJob } from "../digest";

/**
 * Renders the daily match-alert digest as email-client-safe HTML (inline styles,
 * table layout) plus a plaintext alternative. Kept dependency-free so it can be
 * unit-tested and previewed without a mail provider.
 */

export interface DigestEmailInput {
  name: string;
  jobs: DigestJob[];
  feedUrl: string;
  unsubscribeUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Palette — a light approximation of the app's ink theme, safe for email clients.
const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const BORDER = "#e6e4df";
const BG = "#faf9f6";
const ACCENT = "#b45309"; // amber-700

const firstName = (name: string) => (name || "there").trim().split(/\s+/)[0] || "there";

export function renderDigestEmail(input: DigestEmailInput): RenderedEmail {
  const { name, jobs, feedUrl, unsubscribeUrl } = input;
  const n = jobs.length;
  const subject = `${n} new role${n === 1 ? "" : "s"} match your profile today`;

  const cards = jobs
    .map(
      (j) => `
      <tr><td style="padding:0 0 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:12px;background:#ffffff;">
          <tr><td style="padding:16px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font:600 16px/1.35 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(
                  j.title
                )}</td>
                <td align="right" style="font:600 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:${ACCENT};white-space:nowrap;padding-left:10px;">${j.score}% match</td>
              </tr>
              <tr><td colspan="2" style="padding-top:4px;font:400 13px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">${escapeHtml(
                j.company
              )} &nbsp;·&nbsp; ${escapeHtml(j.location)}</td></tr>
              <tr><td colspan="2" style="padding-top:8px;font:400 13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(
                j.reason
              )}</td></tr>
              <tr><td colspan="2" style="padding-top:12px;">
                <a href="${escapeHtml(
                  j.applyUrl
                )}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font:600 13px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:9px 16px;border-radius:8px;">Apply →</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${BG};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${n} fresh role${
    n === 1 ? "" : "s"
  } picked for you — no scams, only what you're eligible for.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:4px 4px 18px;font:700 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:3px;color:${INK};">UMBRIX</td></tr>
        <tr><td style="padding:0 4px 4px;font:600 20px/1.3 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">Hi ${escapeHtml(
    firstName(name)
  )}, ${n} new role${n === 1 ? "" : "s"} match your profile today.</td></tr>
        <tr><td style="padding:0 4px 18px;font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">Scam-checked and eligibility-filtered — here are your strongest fresh matches.</td></tr>
        ${cards}
        <tr><td style="padding:8px 4px 0;">
          <a href="${escapeHtml(
            feedUrl
          )}" style="display:inline-block;font:600 14px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${ACCENT};text-decoration:none;">See all matches in your feed →</a>
        </td></tr>
        <tr><td style="padding:22px 4px 0;border-top:1px solid ${BORDER};margin-top:16px;font:400 12px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">
          You're getting this because you signed up for UMBRIX match alerts.
          <a href="${escapeHtml(
            unsubscribeUrl
          )}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>.<br/>
          UMBRIX · Made for India's job seekers.
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;

  const text = [
    `Hi ${firstName(name)}, ${n} new role${n === 1 ? "" : "s"} match your profile today.`,
    `Scam-checked and eligibility-filtered — your strongest fresh matches:`,
    "",
    ...jobs.map(
      (j) => `• ${j.title} — ${j.company} · ${j.location} (${j.score}% match)\n  ${j.reason}\n  Apply: ${j.applyUrl}`
    ),
    "",
    `See all matches in your feed: ${feedUrl}`,
    "",
    `You're getting this because you signed up for UMBRIX match alerts.`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  return { subject, html, text };
}
