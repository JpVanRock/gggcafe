import { log } from "@/lib/log";
// Helpers for reading <form> submissions in server actions.

export type FormState = {
  error: string | null;
  /** set after a successful save that stays on the page */
  saved?: boolean;
  /** which fields the error is about, by their form `name` (the form marks them and focuses the first) */
  fields?: Record<string, string>;
};

export const initialFormState: FormState = { error: null };

/** A check on one field failed: the message, tied to the field named `field` in the form. */
export const invalid = (field: string, error: string): FormState => ({ error, fields: { [field]: error } });

/** Trimmed text, or null when blank. */
export function text(fd: FormData, name: string): string | null {
  const value = fd.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** One of the allowed values, or null when blank/unknown. */
export function oneOf<T extends string>(fd: FormData, name: string, allowed: readonly T[]): T | null {
  return inList(text(fd, name), allowed);
}

/** `value` when it's one of `allowed` (typed as that list), else null. */
export function inList<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** All checked values for a checkbox group, filtered to the allowed values. */
export function allOf<T extends string>(fd: FormData, name: string, allowed: readonly T[]): T[] {
  return fd
    .getAll(name)
    .filter((v): v is T => typeof v === "string" && (allowed as readonly string[]).includes(v));
}

/** Whole number in range; null when blank; "invalid" when not a number or out of range. */
export function wholeNumber(
  fd: FormData,
  name: string,
  min: number,
  max: number,
): number | null | "invalid" {
  const value = text(fd, name);
  if (value === null) return null;
  if (!/^\d+$/.test(value)) return "invalid";
  const n = Number(value);
  return n >= min && n <= max ? n : "invalid";
}

/** yyyy-mm-dd from a date input, or null. */
export function isoDate(fd: FormData, name: string): string | null {
  const value = text(fd, name);
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function checkbox(fd: FormData, name: string): boolean {
  return fd.get(name) === "on";
}

/** Turn a Postgres/PostgREST error into something a coach can act on. */
export function friendlyDbError(
  error: { code?: string; message?: string },
  duplicateMessage = "That already exists.",
): string {
  switch (error.code) {
    case "23505":
      return duplicateMessage;
    case "42501":
      return "You don't have permission to change this. Ask an admin to make you a coach.";
    case "23514":
      // a check constraint: a number out of range, or text over a column's limit (migration 20261121132502)
      return "One of the values is too long or out of range. Shorten it or check the numbers, then try again.";
    case "23503":
      return "Something this refers to no longer exists. Reload the page and try again.";
    case "P0010":
      // a lifecycle guard (src/lib/lifecycles.ts, migration 20261116030522): it moved on meanwhile
      return "This changed since the page loaded, so nothing was saved. Reload to see where it stands.";
    case "P0009":
      // a rate limit in the database (migration 20261113041701)
      return "That's a lot in a short time. Wait a few minutes and try again.";
    default:
      log("error", "db.error", { code: error.code, message: error.message });
      return "Something went wrong saving that. Try again.";
  }
}
