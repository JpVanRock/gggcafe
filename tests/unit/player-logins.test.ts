// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAYER_LOGIN_DOMAIN, isPlayerLoginEmail, isValidUsername, signInEmail, suggestUsername, usernameFromEmail } from "../../src/lib/player-logins.ts";
import { readFileSync } from "node:fs";

test("usernames", () => {
  for (const ok of ["avery7", "Avery.Lopez", "a_b-c", "abc"]) assert.ok(isValidUsername(ok), ok);
  for (const bad of ["ab", "a b", ".avery", "avery!", "a".repeat(31), "avery@x"]) assert.ok(!isValidUsername(bad), bad);
});

test("sign-in names: emails pass through, usernames map to the placeholder address", () => {
  assert.equal(signInEmail(" coach@team.org "), "coach@team.org");
  assert.equal(signInEmail(" Avery7 "), `avery7@${PLAYER_LOGIN_DOMAIN}`);
  assert.ok(PLAYER_LOGIN_DOMAIN.endsWith(".invalid"), "never a real inbox");
  assert.ok(isPlayerLoginEmail(`avery7@${PLAYER_LOGIN_DOMAIN}`));
  assert.ok(!isPlayerLoginEmail("avery@gmail.com"));
  assert.equal(usernameFromEmail(`avery7@${PLAYER_LOGIN_DOMAIN}`), "avery7");
  assert.equal(usernameFromEmail("avery@gmail.com"), null);
});

test("suggestions", () => {
  assert.equal(suggestUsername("Avery Lopez", "7"), "averylopez7");
  assert.equal(suggestUsername("Zoë O'Neil"), "zoeoneil");
  assert.equal(suggestUsername("A"), "");
});

test("the database uses the same domain", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261108210100_account_types.sql", import.meta.url), "utf8");
  assert.ok(sql.includes(`'@${PLAYER_LOGIN_DOMAIN}'`), "private.player_login_email matches PLAYER_LOGIN_DOMAIN");
  assert.ok(sql.includes("'^[a-z0-9][a-z0-9._-]{2,29}$'"), "same username rule");
});
