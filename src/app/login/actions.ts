"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: string | null; email: string };

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? "That email and password don't match."
        : error.code === "email_not_confirmed"
          ? "This account hasn't been confirmed yet. Ask an admin to confirm it."
          : error.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : "Couldn't sign in right now. Try again in a moment.";
    return { error: message, email };
  }

  // Must stay outside any try/catch: redirect() works by throwing.
  redirect("/dashboard");
}
