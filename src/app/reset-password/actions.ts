"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type NewPasswordState = { error: string | null };

const MIN_LENGTH = 8;

/** Sets a new password for the signed-in user (signed in by the reset link). */
export async function setNewPassword(
  _previous: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_LENGTH) return { error: `Use at least ${MIN_LENGTH} characters.` };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return { error: "This reset link has expired. Request a new one from the sign-in page." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const message =
      error.code === "same_password"
        ? "That's your current password. Pick a new one."
        : error.code === "weak_password"
          ? "That password is too easy to guess. Make it longer or mix in numbers and symbols."
          : "Couldn't save the new password. Try again in a moment.";
    return { error: message };
  }

  redirect("/dashboard");
}
