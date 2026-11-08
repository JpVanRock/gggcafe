"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SIGNUP_TYPES, type SignupType } from "@/lib/account-types";


export type RegisterState = {
  error: string | null;
  /** set when Supabase sent a confirmation email instead of signing her in */
  checkEmail?: boolean;
  values: { role: SignupType; name: string; email: string; code: string; child: string; team: string; specialty: string; org: string };
};

/**
 * Sign-up for every account type. Each one confirms its email first (Supabase
 * Auth "Confirm email" is on), then finishes on its own home page:
 * Head Coach / Assistant Coach: /dashboard sends the request; an admin approves
 * head coaches, a head coach approves assistants (staff_requests).
 * Player: creates the account, then /me shows her team's welcome message and
 * asks her to claim her profile (a coach approves it).
 * Parent: creates the account, her parent profile and the request to join the
 * team with its code (a coach approves it), then /family.
 * Mentor: creates the account, then /mentor waits for an admin to approve her.
 * If the project requires email confirmation, they confirm first and finish there.
 */
export async function registerAccount(_prev: RegisterState, fd: FormData): Promise<RegisterState> {
  const values = {
    role: SIGNUP_TYPES.find((t) => t === fd.get("role")) ?? "player",
    name: String(fd.get("name") ?? "").trim(),
    email: String(fd.get("email") ?? "").trim(),
    code: String(fd.get("code") ?? "").trim(),
    child: String(fd.get("child") ?? "").trim(),
    team: String(fd.get("team") ?? "").trim(),
    specialty: String(fd.get("specialty") ?? "").trim().slice(0, 60),
    org: String(fd.get("org") ?? "").trim().slice(0, 120),
  };
  const player = values.role === "player";
  const mentor = values.role === "mentor";
  const headCoach = values.role === "head-coach";
  const assistant = values.role === "assistant-coach";
  const coach = headCoach || assistant;
  const parent = values.role === "parent";
  const password = String(fd.get("password") ?? "");
  const fail = (error: string): RegisterState => ({ error, values });

  if (!values.name || values.name.length > 80) return fail("Enter your name.");
  if ((player || mentor || coach) && !/\s/.test(values.name)) return fail("Enter your first and last name.");
  if (!/^\S+@\S+\.\S+$/.test(values.email)) return fail("Enter a valid email address.");
  if (password.length < 8) return fail("Use a password of at least 8 characters.");
  if (password !== String(fd.get("confirm") ?? "")) return fail("The two passwords don't match.");
  if ((player || assistant) && !/^[0-9a-f-]{36}$/.test(values.team)) return fail("Choose your team.");
  if (parent && !values.code) return fail("Enter the team code from your coach.");
  if (parent && (!values.child || values.child.length > 80)) return fail("Enter your daughter's first and last name.");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "gggcafe.vercel.app";
  const origin = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password,
    options: {
      data: {
        display_name: values.name,
        role: values.role,
        ...(mentor && values.specialty ? { specialty: values.specialty } : {}),
        ...(assistant ? { team: values.team } : {}),
        ...(headCoach && values.org ? { note: values.org } : {}),
      },
      emailRedirectTo: `${origin}/auth/confirm?next=${player ? "/me" : mentor ? "/mentor" : coach ? "/dashboard" : "/family"}`,
    },
  });
  if (error) {
    if (error.code === "user_already_exists") return fail("There's already an account with that email. Sign in instead.");
    if (error.code === "weak_password") return fail("Pick a stronger password (mix letters and numbers).");
    if (error.code === "signup_disabled") return fail("Sign-up is closed right now. Ask your coach.");
    if (error.code === "email_address_invalid") return fail("Check your email address.");
    // Supabase couldn't send the confirmation email (no email sender set up for the site yet)
    if (error.code === "email_address_not_authorized" || /confirmation email|sending .*email|send .*email/i.test(error.message)) {
      console.error("Sign-up confirmation email failed:", error);
      return fail("We couldn't send your confirmation email, so sign-up can't finish yet. Ask your coach to check the site's email setup.");
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return fail("Too many sign-ups right now. Wait a few minutes and try again.");
    }
    console.error("Sign-up failed:", error);
    return fail("Couldn't create the account. Try again in a moment.");
  }
  // Supabase hides whether an email is taken: a known email comes back with no identities.
  if (data.user && data.user.identities?.length === 0) return fail("There's already an account with that email. Sign in instead.");
  if (!data.session) return { error: null, checkEmail: true, values };

  // Players: the welcome message and claim form are on /me.
  if (player) redirect(`/me?team=${values.team}`);
  // Mentors: an admin approves them; /mentor says so.
  if (mentor) redirect("/mentor");
  // Coaches: /dashboard sends the request and says who approves it.
  if (coach) redirect("/dashboard");

  await supabase.from("parent_accounts").insert({ display_name: values.name });
  const { error: linkError } = await supabase.rpc("request_parent_link", { p_code: values.code, p_child_name: values.child });
  redirect(linkError ? "/family?code=invalid" : "/family");
}
