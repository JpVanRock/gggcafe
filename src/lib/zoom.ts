import "server-only";

// Zoom, for video calls inside the site (user, 2026-11-12; setup in docs/features/video-calls.md).
// Two apps in the club's own Zoom account, with their keys in Vercel's server-only environment
// variables (never NEXT_PUBLIC_, never in the repo):
//   ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET  a Server-to-Server OAuth app: books, reads
//     and deletes meetings, and gets the host's key so the person who booked a call can start it
//   ZOOM_SDK_KEY, ZOOM_SDK_SECRET  a General app with the Meeting SDK turned on: signs each person in
//   ZOOM_HOST_EMAIL  the licensed Zoom user every call is booked under (one call at a time)
// Until all six are set, scheduling and joining say Zoom isn't connected yet.
import { meetingSdkSignature } from "@/lib/zoom-signature";

const API = "https://api.zoom.us/v2";
const KEYS = ["ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_SDK_KEY", "ZOOM_SDK_SECRET", "ZOOM_HOST_EMAIL"] as const;

/** A Zoom key from Vercel, without the space or line break a paste can bring along (user, 2026-11-14). */
const key = (name: (typeof KEYS)[number]) => (process.env[name] ?? "").trim();

export function zoomConfigured(): boolean {
  return KEYS.every((name) => Boolean(key(name)));
}

export const ZOOM_NOT_CONNECTED = "Video calls aren't connected to Zoom yet. A site admin adds the Zoom keys in Vercel first.";

class ZoomError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export type ZoomResult<T> = { ok: true; value: T } | { ok: false; error: string };

async function attempt<T>(work: () => Promise<T>): Promise<ZoomResult<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (e) {
    console.error("Zoom:", e);
    return { ok: false, error: e instanceof ZoomError ? e.message : "Couldn't reach Zoom. Try again in a minute." };
  }
}

// One access token for the account, reused until a minute before it runs out (they last an hour).
let token: { value: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${key("ZOOM_CLIENT_ID")}:${key("ZOOM_CLIENT_SECRET")}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(key("ZOOM_ACCOUNT_ID"))}`,
    { method: "POST", headers: { Authorization: `Basic ${basic}` }, cache: "no-store" },
  );
  const body = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; reason?: string } | null;
  if (!res.ok || !body?.access_token) {
    const reason = body?.reason ?? String(res.status);
    // "unsupported grant type": the Client ID and Secret are the Meeting SDK app's, not the Server-to-Server app's
    const hint = /grant/i.test(reason)
      ? "ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET must be the Server-to-Server OAuth app's, not the Meeting SDK app's."
      : "Check ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET in Vercel, and that the Server-to-Server app is activated.";
    throw new ZoomError(`Zoom didn't accept the app keys (${reason}). ${hint}`);
  }
  token = { value: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function zoom<T>(path: string, init: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok || body === null) throw new ZoomError(`Zoom said no: ${body?.message ?? `error ${res.status}`}.`, res.status);
  return body;
}

const hostUser = () => encodeURIComponent(key("ZOOM_HOST_EMAIL"));

/**
 * Books a meeting under the host account. Waiting room on, nobody in before the host, everyone
 * muted on entry, never recorded. The topic names no one: the site keeps who it's with.
 */
export function createZoomMeeting({ startsAt, minutes }: { startsAt: string; minutes: number }) {
  return attempt(async () => {
    const meeting = await zoom<{ id: number }>(`/users/${hostUser()}/meetings`, {
      method: "POST",
      body: {
        topic: "GGG.Cafe video call",
        type: 2,
        start_time: new Date(startsAt).toISOString().replace(/\.\d{3}Z$/, "Z"),
        duration: minutes,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          waiting_room: true,
          mute_upon_entry: true,
          auto_recording: "none",
          approval_type: 2,
          meeting_authentication: false,
          private_meeting: true,
        },
      },
    });
    return String(meeting.id);
  });
}

/** Deletes a meeting; one that's already gone counts as deleted (the job worker retries otherwise). */
export function deleteZoomMeeting(meetingId: string) {
  return attempt(async () => {
    try {
      await zoom<void>(`/meetings/${encodeURIComponent(meetingId)}`, { method: "DELETE" });
    } catch (e) {
      if (e instanceof ZoomError && e.status === 404) return;
      throw e;
    }
  });
}

export type JoinDetails = {
  signature: string;
  meetingNumber: string;
  password: string;
  /** the host's key to start the meeting (host only) */
  zak: string | null;
  /** the same call in the Zoom app, if the page can't run it */
  appUrl: string | null;
};

/** What one person needs to join a meeting: a signature, its passcode, and for the host the key to start it. */
export function zoomJoinDetails(meetingId: string, asHost: boolean) {
  return attempt(async (): Promise<JoinDetails> => {
    const meeting = await zoom<{ password?: string; join_url?: string; start_url?: string }>(`/meetings/${encodeURIComponent(meetingId)}`);
    let zak: string | null = null;
    if (asHost) {
      const fromToken = await zoom<{ token?: string }>(`/users/${hostUser()}/token?type=zak`).catch(() => null);
      zak = fromToken?.token ?? (meeting.start_url ? new URL(meeting.start_url).searchParams.get("zak") : null);
      if (!zak) throw new ZoomError("Zoom didn't send the host's key. Check the Server-to-Server app's scopes.");
    }
    return {
      signature: meetingSdkSignature({
        sdkKey: key("ZOOM_SDK_KEY"),
        sdkSecret: key("ZOOM_SDK_SECRET"),
        meetingNumber: meetingId,
        role: asHost ? 1 : 0,
      }),
      meetingNumber: meetingId,
      password: meeting.password ?? "",
      zak,
      appUrl: (asHost ? meeting.start_url : meeting.join_url) ?? null,
    };
  });
}
