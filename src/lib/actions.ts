import "server-only";
// The shell for server actions used as form actions (<ActionForm action={…}>): every
// action says why it didn't run, database errors included, instead of failing silently.
import { unstable_rethrow } from "next/navigation";
import { friendlyDbError, type FormState } from "@/lib/form";

/** The action worked. */
export const done = (): FormState => ({ error: null, saved: true });
/** The action didn't run, and why. */
export const failed = (error: string): FormState => ({ error });
/** For a form that no longer matches the data (a stale page, a tampered field). */
export const STALE = "That didn't go through. Reload the page and try again.";

class DbError extends Error {
  constructor(readonly db: { code?: string; message?: string }) {
    super(db.message ?? "database error");
  }
}

/** A Supabase result, or stop the action with the database's error as a message. */
export function must<T extends { error: { code?: string; message?: string } | null }>(result: T): T {
  if (result.error) throw new DbError(result.error);
  return result;
}

/**
 * Runs an action's work: returns what it returns, or done() when it returns nothing.
 * must() failures and unexpected errors become a message; redirects and notFound pass through.
 */
export async function runAction(work: () => Promise<FormState | void>): Promise<FormState> {
  try {
    return (await work()) ?? done();
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof DbError) return failed(friendlyDbError(e.db));
    console.error("Action failed:", e);
    return failed("Something went wrong. Try again.");
  }
}
