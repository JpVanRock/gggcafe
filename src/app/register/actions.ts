"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SIGNUP_TYPES, type SignupType } from "@/lib/account-types";
import { TERMS_VERSION } from "@/lib/legal";
import { requestOrigin } from "@/lib/request-origin";

export type RegisterState = {
  error: string | null;
  /** the field the message is about (the form marks and focuses it) */
  fields?: Record<string, string>;
  /** set when Supabase sent a confirmation email instead of signing her in */
  checkEmail?: boolean;
  values: { role: SignupType | ""; name: string; email: string; child: string; specialty: string; org: string };
};

/**
 * Sign-up for parents, coaches and mentors: no code here (user, 2026-11-16: "It just needs to be when you are
 * first logged in and joining a team"). Each one confirms its email first (Supabase Auth "Confirm
 * email" is on), then joins a team with a code on its own home page:
 * Head Coach: /dashboard sends the request; an admin approves (staff_requests).
 * Assistant Coach: /dashboard asks for the parent code (the team's one code), then sends the request;
 * a head coach approves.
 * Players don't sign up: a parent makes every player's login on the family page (user, 2026-11-16:
 * "Players will never be given this code").
 * Parent: /family asks for the parent code and the daughter's name: in at once when her name matches
 * the roster (request_parent_link).
 * Mentor: /mentor asks for the parent code and one player (her parents approve) or the whole team (the
 * head coach approves).
 */
export async function registerAccount(_prev: RegisterState, fd: FormData): Promise<RegisterState> {
  const role = SIGNUP_TYPES.find((t) => t === fd.get("role")) ?? null;
  const values: RegisterState["values"] = {
    role: role ?? "",
    name: String(fd.get("name") ?? "").trim(),
    email: String(fd.get("email") ?? "").trim(),
    // a coach who is also a parent: their daughter's name
    child: String(fd.get("child") ?? "").trim(),
    specialty: String(fd.get("specialty") ?? "").trim().slice(0, 60),
    org: String(fd.get("org") ?? "").trim().slice(0, 120),
  };
  const fail = (error: string, field?: string): RegisterState => ({ error, values, ...(field ? { fields: { [field]: error } } : {}) });
  if (!role) return fail("Choose your account type.", "role");
  if (role === "player") return fail("Players don't sign up here. Your parent makes your login from their family page.", "role");
  const mentor = role === "mentor";
  const headCoach = role === "head-coach";
  const assistant = role === "assistant-coach";
  const coach = headCoach || assistant;
  const password = String(fd.get("password") ?? "");

  if (!values.name || values.name.length > 80) return fail("Enter your name.", "name");
  if ((mentor || coach) && !/\s/.test(values.name)) return fail("Enter your first and last name.", "name");
  if (headCoach && !values.org) return fail("Enter your team or organization.", "org");
  if (coach && values.child.length > 80) return fail("Keep your daughter's name to 80 characters.", "child");
  if (!/^\S+@\S+\.\S+$/.test(values.email)) return fail("Enter a valid email address.", "email");
  if (password.length < 8) return fail("Use a password of at least 8 characters.", "password");
  if (password !== String(fd.get("confirm") ?? "")) return fail("The two passwords don't match.", "confirm");
  if (fd.get("agree") !== "on") return fail("Check the box to agree to the Terms of Service and the Privacy & Security Notice.", "agree");

  const supabase = await createClient();
  const origin = await requestOrigin();

  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password,
    options: {
      data: {
        display_name: values.name,
        role: values.role,
        // the Terms version she agreed to; a database trigger records the agreement (terms_acceptances)
        terms_version: TERMS_VERSION,
        ...(mentor && values.specialty ? { specialty: values.specialty } : {}),
        ...(headCoach && values.org ? { note: values.org } : {}),
        // a coach who is also a parent: the dashboard suggests her when they claim a daughter
        ...(coach && values.child ? { coach_child: values.child } : {}),
      },
      emailRedirectTo: `${origin}/auth/confirm?next=${mentor ? "/mentor" : coach ? "/dashboard" : "/family"}`,
    },
  });
  if (error) {
    if (error.code === "user_already_exists") return fail("There's already an account with that email. Sign in instead.", "email");
    if (error.code === "weak_password") return fail("Pick a stronger password (mix letters and numbers).", "password");
    if (error.code === "signup_disabled") return fail("Sign-up is closed right now. Ask your coach.");
    if (error.code === "email_address_invalid") return fail("Check your email address.", "email");
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
  if (data.user && data.user.identities?.length === 0) return fail("There's already an account with that email. Sign in instead.", "email");
  if (!data.session) return { error: null, checkEmail: true, values };
  // signed in at once (only when email confirmation is off): each home page asks for the code
  redirect(mentor ? "/mentor" : coach ? "/dashboard" : "/family");
}
