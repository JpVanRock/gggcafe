import "server-only";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/site";

/**
 * This request's origin, such as "https://www.ggg.cafe" or "http://localhost:3000", for links
 * in emails and on pages (sign-up and reset links, shared plans and lineups, the team code).
 * Falls back to the main address when the request names no host.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (!host) return SITE_URL;
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
