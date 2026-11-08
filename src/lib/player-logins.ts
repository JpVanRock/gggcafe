// Username logins a parent creates for a daughter without an email address
// (user, 2026-11-08). Supabase Auth signs in by email, so a username maps to a
// placeholder address under a domain that can never receive mail (.invalid).
// Keep PLAYER_LOGIN_DOMAIN in step with private.player_login_email() in the
// 20261108210100_account_types migration. No imports (unit-tested).

export const PLAYER_LOGIN_DOMAIN = "player.gggcafe.invalid";

/** 3-30 characters: lowercase letters, numbers, dots, dashes, underscores; starts with a letter or number. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidUsername(input: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(input));
}

/** What Supabase gets for a sign-in name: an email as typed, or a username's placeholder address. */
export function signInEmail(input: string): string {
  const value = input.trim();
  return value.includes("@") ? value : `${normalizeUsername(value)}@${PLAYER_LOGIN_DOMAIN}`;
}

export function isPlayerLoginEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${PLAYER_LOGIN_DOMAIN}`));
}

/** The username behind a placeholder address, or null for a real email. */
export function usernameFromEmail(email: string | null | undefined): string | null {
  return email && isPlayerLoginEmail(email) ? email.slice(0, email.indexOf("@")) : null;
}

/** A starting suggestion from her name and number, e.g. "averylopez7". */
export function suggestUsername(name: string, jersey?: string | null): string {
  // accents to plain letters (Zoë -> zoe), then letters and numbers only
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
  const suggestion = `${base}${jersey && /^\d{1,2}$/.test(jersey) ? jersey : ""}`;
  return USERNAME_PATTERN.test(suggestion) ? suggestion : "";
}
