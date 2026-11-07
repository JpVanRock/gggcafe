"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type RegisterState = {
  error: string | null;
  /** set when Supabase sent a confirmation email instead of signing her in */
  checkEmail?: boolean;
  values: { name: string; email: string; code: string; child: string };
};

/**
 * Parent sign-up: creates the account, her parent profile, and the request to
 * join the team (approved later by a coach). If the project requires email
 * confirmation, she confirms first and finishes on /family.
 */
export async function registerParent(_prev: RegisterState, fd: FormData): Promise<RegisterState> {
  const values = {
    name: String(fd.get("name") ?? "").trim(),
    email: String(fd.get("email") ?? "").trim(),
    code: String(fd.get("code") ?? "").trim(),
    child: String(fd.get("child") ?? "").trim(),
  };
  const password = String(fd.get("password") ?? "");
  const fail = (error: string): RegisterState => ({ error, values });

  if (!values.name || values.name.length > 80) return fail("Enter your name.");
  if (!/^\S+@\S+\.\S+$/.test(values.email)) return fail("Enter a valid email address.");
  if (password.length < 8) return fail("Use a password of at least 8 characters.");
  if (password !== String(fd.get("confirm") ?? "")) return fail("The two passwords don't match.");
  if (!values.code) return fail("Enter the team code from your coach.");
  if (!values.child || values.child.length > 80) return fail("Enter your daughter's first and last name.");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "gggcafe.vercel.app";
  const origin = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password,
    options: { data: { display_name: values.name }, emailRedirectTo: `${origin}/auth/confirm?next=/family` },
  });
  if (error) {
    if (error.code === "user_already_exists") return fail("There's already an account with that email. Sign in instead.");
    if (error.code === "weak_password") return fail("Pick a stronger password (mix letters and numbers).");
    if (error.code === "signup_disabled") return fail("Sign-up is closed right now. Ask your coach.");
    if (error.status === 429) return fail("Too many sign-ups right now. Wait a few minutes and try again.");
    console.error("Parent sign-up failed:", error);
    return fail("Couldn't create the account. Try again in a moment.");
  }
  // Supabase hides whether an email is taken: a known email comes back with no identities.
  if (data.user && data.user.identities?.length === 0) return fail("There's already an account with that email. Sign in instead.");
  if (!data.session) return { error: null, checkEmail: true, values };

  await supabase.from("parent_accounts").insert({ display_name: values.name });
  const { error: linkError } = await supabase.rpc("request_parent_link", { p_code: values.code, p_child_name: values.child });
  redirect(linkError ? "/family?code=invalid" : "/family");
}
