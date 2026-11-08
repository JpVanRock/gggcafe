"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInEmail } from "@/lib/player-logins";

export type SignInState = { error: string | null; email: string };

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email (or username) and password.", email };
  }

  const supabase = await createClient();
  // A player whose parent made her login signs in with a username instead of an email.
  const username = !email.includes("@");
  const { error } = await supabase.auth.signInWithPassword({ email: signInEmail(email), password });

  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? username
          ? "That username and password don't match."
          : "That email and password don't match."
        : error.code === "email_not_confirmed"
          ? "Your email isn't confirmed yet. Open the confirmation link we emailed you (check spam too)."
          : error.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : "Couldn't sign in right now. Try again in a moment.";
    return { error: message, email };
  }

  // Must stay outside any try/catch: redirect() works by throwing.
  redirect("/dashboard");
}
