"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlayerLoginEmail, signInEmail } from "@/lib/player-logins";

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
  const { data, error } = await supabase.auth.signInWithPassword({ email: signInEmail(email), password });

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

  // Straight to each account's home (user, 2026-11-16: "Login does not take you to the family menu"):
  // parents to the family menu, mentors to theirs, players to theirs. Staff, coach sign-ups and anyone
  // else go to /dashboard, which sends each account home too.
  const role = (data.user?.user_metadata as { role?: string } | undefined)?.role;
  const { data: staff } = data.user
    ? await supabase.from("staff").select("user_id").eq("user_id", data.user.id).maybeSingle()
    : { data: null };
  const home = staff
    ? "/dashboard"
    : role === "parent"
      ? "/family"
      : role === "mentor"
        ? "/mentor"
        : role === "player" || isPlayerLoginEmail(data.user?.email)
          ? "/me"
          : "/dashboard";
  // Must stay outside any try/catch: redirect() works by throwing.
  redirect(home);
}
