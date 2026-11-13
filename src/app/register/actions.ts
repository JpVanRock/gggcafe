"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CODE_TYPES, SIGNUP_TYPES, type SignupType } from "@/lib/account-types";
import { TERMS_VERSION } from "@/lib/legal";
import { requestOrigin } from "@/lib/request-origin";

export type RegisterState = {
  error: string | null;
  /** the field the message is about (the form marks and focuses it) */
  fields?: Record<string, string>;
  /** set when Supabase sent a confirmation email instead of signing her in */
  checkEmail?: boolean;
  /** the team her code matched, for the confirmation message */
  team?: string;
  values: { role: SignupType | ""; name: string; email: string; code: string; child: string; specialty: string; org: string; scope: string };
};

/**
 * Sign-up for every account type. Players, parents and assistant coaches enter their team's
 * code (checked here with signup_team(); signed-out visitors can't list teams). Each one
 * confirms its email first (Supabase Auth "Confirm email" is on), then finishes on its own
 * home page:
 * Head Coach / Assistant Coach: /dashboard sends the request; an admin approves
 * head coaches, a head coach approves assistants (staff_requests).
 * Player: /me shows her team's welcome message (the team is in her account's metadata) and
 * asks her to claim her profile (a coach approves it).
 * Parent: /family sends the request to join the team with its code (a head coach approves
 * it); the form there is filled in with what she typed here.
 * Mentor: asks with the team code for one player (her parents approve) or the whole team (the
 * head coach approves); /mentor sends the request if it couldn't go yet, filled in with what she typed.
 */
export async function registerAccount(_prev: RegisterState, fd: FormData): Promise<RegisterState> {
  const role = SIGNUP_TYPES.find((t) => t === fd.get("role")) ?? null;
  const values: RegisterState["values"] = {
    role: role ?? "",
    name: String(fd.get("name") ?? "").trim(),
    email: String(fd.get("email") ?? "").trim(),
    code: String(fd.get("code") ?? "").trim(),
    child: String(fd.get("child") ?? "").trim(),
    specialty: String(fd.get("specialty") ?? "").trim().slice(0, 60),
    org: String(fd.get("org") ?? "").trim().slice(0, 120),
    scope: fd.get("scope") === "team" ? "team" : fd.get("scope") === "player" ? "player" : "",
  };
  const fail = (error: string, field?: string): RegisterState => ({ error, values, ...(field ? { fields: { [field]: error } } : {}) });
  if (!role) return fail("Choose your account type.", "role");
  const player = role === "player";
  const mentor = role === "mentor";
  const headCoach = role === "head-coach";
  const assistant = role === "assistant-coach";
  const coach = headCoach || assistant;
  const parent = role === "parent";
  const needsCode = CODE_TYPES.includes(role);
  const password = String(fd.get("password") ?? "");

  if (needsCode && !values.code) return fail("Enter the team code from your coach.", "code");
  if (!values.name || values.name.length > 80) return fail("Enter your name.", "name");
  if ((player || mentor || coach) && !/\s/.test(values.name)) return fail("Enter your first and last name.", "name");
  if (parent && (!values.child || values.child.length > 80)) return fail("Enter your daughter's first and last name.", "child");
  if (headCoach && !values.org) return fail("Enter your team or organization.", "org");
  if (coach && values.child.length > 80) return fail("Keep your daughter's name to 80 characters.", "child");
  if (mentor && !values.scope) return fail("Choose one player or the whole team.", "scope");
  if (mentor && values.scope === "player" && (!/\s/.test(values.child) || values.child.length > 80)) return fail("Enter the player's first and last name.", "child");
  if (!/^\S+@\S+\.\S+$/.test(values.email)) return fail("Enter a valid email address.", "email");
  if (password.length < 8) return fail("Use a password of at least 8 characters.", "password");
  if (password !== String(fd.get("confirm") ?? "")) return fail("The two passwords don't match.", "confirm");
  // Children under 13 don't sign themselves up (privacy law): a parent makes their login.
  if (player && fd.get("age13") !== "on") return fail("Players under 13: ask a parent to make your login from the family page.", "age13");
  if (fd.get("agree") !== "on") return fail("Check the box to agree to the Terms of Service and the Privacy & Security Notice.", "agree");

  const supabase = await createClient();
  let team: { id: string; name: string } | null = null;
  if (needsCode) {
    const { data, error } = await supabase.rpc("signup_team", { p_code: values.code });
    if (error) {
      console.error("Team code check failed:", error);
      return fail("Couldn't check the team code. Try again in a moment.");
    }
    team = data?.[0] ?? null;
    if (!team) return fail("That team code doesn't match a team. Check it with your coach.", "code");
  }

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
        ...(mentor ? { team_code: values.code, ...(values.scope === "player" ? { mentor_player: values.child } : {}) } : {}),
        ...(team ? { team: team.id } : {}),
        ...(parent ? { team_code: values.code, child: values.child } : {}),
        ...(headCoach && values.org ? { note: values.org } : {}),
        // a coach who is also a parent: the dashboard suggests her when they claim a daughter
        ...(coach && values.child ? { coach_child: values.child } : {}),
      },
      emailRedirectTo: `${origin}/auth/confirm?next=${player ? "/me" : mentor ? "/mentor" : coach ? "/dashboard" : "/family"}`,
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
  if (!data.session) return { error: null, checkEmail: true, team: team?.name, values };

  // Players: the welcome message and claim form are on /me.
  if (player) redirect(`/me?team=${team!.id}`);
  // Mentors: send the request now (a parent or the head coach approves it); /mentor shows it.
  if (mentor) {
    await supabase.rpc("request_mentor", { p_code: values.code, p_player_name: values.scope === "player" ? values.child : "" });
    redirect("/mentor");
  }
  // Coaches: /dashboard sends the request and says who approves it.
  if (coach) redirect("/dashboard");

  await supabase.from("parent_accounts").insert({ display_name: values.name });
  const { error: linkError } = await supabase.rpc("request_parent_link", { p_code: values.code, p_child_name: values.child });
  redirect(linkError ? "/family?code=invalid" : "/family");
}
