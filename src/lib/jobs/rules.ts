// The job worker's pure parts (docs/architecture/jobs.md): which jobs exist, what they carry, and
// the emails they send. No imports, so the unit tests can check them.

// email.error_alert (user, 2026-11-14): a new error, or one back after it was resolved, emails the admins
export const JOB_KINDS = ["email.video_call", "zoom.delete_meeting", "email.error_alert"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export function isJobKind(value: unknown): value is JobKind {
  return JOB_KINDS.some((k) => k === value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A job's payload, checked: what the handler for its kind needs, or null when it's malformed. */
export function jobPayload(
  kind: JobKind,
  payload: unknown,
): { callId: string; event: "booked" | "cancelled" } | { callId: string; meetingId: string } | { fingerprint: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (kind === "email.error_alert") return typeof p.fingerprint === "string" && /^[0-9a-f]{16}$/.test(p.fingerprint) ? { fingerprint: p.fingerprint } : null;
  if (typeof p.call_id !== "string" || !UUID.test(p.call_id)) return null;
  if (kind === "email.video_call") return p.event === "booked" || p.event === "cancelled" ? { callId: p.call_id, event: p.event } : null;
  return typeof p.meeting_id === "string" && /^[0-9]{9,12}$/.test(p.meeting_id) ? { callId: p.call_id, meetingId: p.meeting_id } : null;
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * The email her parents get when a video call is booked or cancelled. `when` is already in the
 * team's time zone ("Tue, Nov 17 · 7:00 PM"); `familyUrl` is the family page on this site.
 */
export function videoCallEmail(call: {
  player: string;
  hostName: string;
  hostKind: string;
  topic: string;
  when: string;
  minutes: number;
  cancelled: boolean;
  familyUrl: string;
}): { subject: string; text: string; html: string } {
  const host = `${call.hostName} (${call.hostKind === "mentor" ? "mentor" : "head coach"})`;
  if (call.cancelled) {
    const subject = `Video call cancelled: ${call.player}, ${call.when}`;
    const lines = [
      `The video call ${host} booked with ${call.player} is cancelled.`,
      `What: ${call.topic}`,
      `When: ${call.when} (${call.minutes} minutes)`,
      `Your family page on GGG.Cafe shows her calls: ${call.familyUrl}`,
    ];
    return { subject, text: lines.join("\n\n"), html: lines.map((l) => `<p>${escape(l)}</p>`).join("") };
  }
  const subject = `Video call booked: ${call.player}, ${call.when}`;
  const lines = [
    `${host} booked a video call with ${call.player}.`,
    `What: ${call.topic}`,
    `When: ${call.when} (${call.minutes} minutes)`,
    "You're invited to every call. Join from your family page on GGG.Cafe: the call opens 10 minutes before it starts. Calls aren't recorded.",
  ];
  return {
    subject,
    text: [...lines, call.familyUrl].join("\n\n"),
    html: `${lines.map((l) => `<p>${escape(l)}</p>`).join("")}<p><a href="${escape(call.familyUrl)}">Open the family page</a></p>`,
  };
}

/**
 * The email the admins get about a new error (or one back after it was resolved), user 2026-11-14. The
 * message is the grouped one from the database: ids and emails already taken out. `healthUrl` is /health.
 */
export function errorAlertEmail(err: { source: string; name: string; message: string; route: string | null; count: number; healthUrl: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `New error on GGG.Cafe: ${err.name}`.slice(0, 120);
  const lines = [
    "Something went wrong on GGG.Cafe that hasn't happened before, or came back after it was marked resolved.",
    `What: ${err.name}: ${err.message}`,
    `Where: ${err.route ?? "no page recorded"} (${err.source})`,
    `Seen ${err.count} time${err.count === 1 ? "" : "s"} so far.`,
    "See it, and mark it resolved, on Site health. You get at most one email a day per error, and 10 a day in all.",
  ];
  return {
    subject,
    text: [...lines, err.healthUrl].join("\n\n"),
    html: `${lines.map((l) => `<p>${escape(l)}</p>`).join("")}<p><a href="${escape(err.healthUrl)}">Open Site health</a></p>`,
  };
}
