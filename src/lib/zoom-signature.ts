// The Meeting SDK's join signature (docs/features/video-calls.md): a short JWT signed with the
// Meeting SDK app's secret, made on the server for one person joining one meeting. Kept apart
// from src/lib/zoom.ts (server-only) so the unit tests can check it.
import { createHmac } from "node:crypto";

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/**
 * role 1 = the host (starts the meeting, with the host's Zoom key), 0 = everyone else.
 * Valid for two hours from `now` (seconds), backdated 30 seconds for clock drift.
 */
export function meetingSdkSignature({
  sdkKey,
  sdkSecret,
  meetingNumber,
  role,
  now = Math.floor(Date.now() / 1000),
}: {
  sdkKey: string;
  sdkSecret: string;
  meetingNumber: string;
  role: 0 | 1;
  now?: number;
}): string {
  const iat = now - 30;
  const exp = iat + 2 * 60 * 60;
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ appKey: sdkKey, sdkKey, mn: meetingNumber, role, iat, exp, tokenExp: exp }));
  const signature = createHmac("sha256", sdkSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}
