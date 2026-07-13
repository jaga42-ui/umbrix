import { Resend } from "resend";

/**
 * Thin Resend wrapper. No-ops gracefully when RESEND_API_KEY is absent so the
 * rest of the app (and local dev) is unaffected until email is provisioned.
 *
 * `EMAIL_FROM` defaults to Resend's test sender, which can only deliver to the
 * account owner's own verified address — enough to build and test the digest.
 * Broad sends require a verified sending domain (see MATCH_ALERTS_PLAN.md §5/§11).
 */

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "UMBRIX <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

/** Whether real sends are possible (a key is configured). */
export const emailConfigured = Boolean(resend);

export interface SendResult {
  ok: boolean;
  id?: string;
  /** True when skipped because no API key is configured (not a real failure). */
  skipped?: boolean;
  error?: string;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}): Promise<SendResult> {
  if (!resend) {
    console.warn("RESEND_API_KEY not set — email send skipped.");
    return { ok: false, skipped: true };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      headers: opts.headers,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
