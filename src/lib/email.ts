import "server-only";

// Email through Resend's HTTP API (https://resend.com), used to share practice
// plans with the coaching staff. Needs two server-only environment variables
// (Vercel → Settings → Environment Variables; never NEXT_PUBLIC_):
//   RESEND_API_KEY  the API key from Resend
//   EMAIL_FROM      a sender on a domain verified in Resend, e.g. "GGG.Cafe <plans@yourdomain.com>"
// Until both are set, sharing falls back to opening the coach's own email app.
// Each send is logged and kept in the log drain (user, 2026-11-14): how many recipients and whether it
// went, never the addresses, subject or body.
import { logAndKeep } from "@/lib/log-drain";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type Attachment = { filename: string; content: Buffer };

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  attachments = [],
}: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  attachments?: Attachment[];
}): Promise<{ error: string | null }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { error: "Email isn't set up yet." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
      }),
    });
    if (!res.ok) {
      await logAndKeep("warn", "email.failed", { status: res.status, message: (await res.text()).slice(0, 300) });
      return { error: "The email service turned the message down. Try again, or print the plan instead." };
    }
    await logAndKeep("info", "email.sent", { recipients: to.length, attachments: attachments.length });
    return { error: null };
  } catch (e) {
    await logAndKeep("warn", "email.failed", { message: e instanceof Error ? e.message : String(e) });
    return { error: "Couldn't reach the email service. Try again in a minute." };
  }
}

/** Escape text for HTML email bodies. */
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
