"use client";

import { useSearchParams } from "next/navigation";

/** Shown after a sign-up confirmation link sends her here. */
export function ConfirmNotice() {
  const confirm = useSearchParams().get("confirm");
  if (confirm === "done") {
    return (
      <p role="status" className="rounded-lg border border-neon/60 bg-neon/10 p-3 text-center text-sm">
        Your email is confirmed. Sign in to finish setting up.
      </p>
    );
  }
  if (confirm === "expired") {
    return (
      <p role="status" className="rounded-lg border border-pink/60 bg-pink/10 p-3 text-center text-sm">
        That link expired or was already used. Try signing in. If it says your email isn&apos;t confirmed, sign up again with the
        same email to get a new link.
      </p>
    );
  }
  return null;
}
