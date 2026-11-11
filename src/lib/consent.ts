// Verified parental consent for players under 13 (docs/features/legal.md, migration
// 20261111235221_parental_consent). No imports, so it runs in unit tests and client code.

/** The private bucket for signed forms; a parent uploads only into her own folder. */
export const CONSENT_BUCKET = "consent-forms";
/** The database's limit for an uploaded form (10 MB). */
export const CONSENT_MAX_BYTES = 10 * 1024 * 1024;

export type ConsentMethod = "signed_form" | "video_call";
export type ConsentStatus = "pending" | "verified" | "declined" | "withdrawn";
export const RELATIONSHIPS = ["parent", "guardian"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];
export const RELATIONSHIP_LABEL: Record<Relationship, string> = { parent: "Parent", guardian: "Legal guardian" };

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** Where a parent's signed form goes: `<her user id>/<milliseconds>.<ext>`, the shape the database checks. Null for other file types. */
export function consentFormPath(userId: string, now: number, contentType: string): string | null {
  const ext = EXT[contentType];
  return ext ? `${userId}/${now}.${ext}` : null;
}

/** What the family page shows for a daughter: nothing needed, ask her coach for a birth date, give consent, waiting, or done. */
export function consentStep(row: { birth_date: string | null; under_13: boolean; status: string | null } | undefined) {
  if (!row || !row.birth_date) return "birth-date" as const;
  if (!row.under_13) return "not-needed" as const;
  if (row.status === "verified") return "verified" as const;
  if (row.status === "pending") return "pending" as const;
  return "needed" as const;
}

/** Her age in whole years on `today` (both YYYY-MM-DD). */
export function ageOn(birthDate: string, today: string) {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
