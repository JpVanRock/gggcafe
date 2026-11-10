# Legal: Terms of Service, Privacy & Security, disclaimers

User's request (2026-11-09): disclaimers at the bottom of every page, a Terms of Service that registered users
agree to, training at the user's own risk (players add their own routines), rewards for fun only, and
cybersecurity/data-protection language, presented with standard UI for legal text on the site and the phone app.

The documents are drafts written for GGG.Cafe in plain English. They are not legal advice and no document
makes anyone immune from a lawsuit: have a licensed attorney in the governing state review them, especially
the release for minors, the under-13 consent and the dispute terms.

## Where the words live
- `src/lib/legal.ts`: one source for everything: `TERMS_SECTIONS`, `PRIVACY_SECTIONS`, the footer
  disclaimer, the checkbox label, the short version on the agreement page, `TERMS_VERSION` and
  `LEGAL` (governing state, county, contact). Section ids are page anchors (`/terms#risk`).
- The notes say "Terms, section 4" (risk) and "section 7" (rewards), the intro cites sections
  4, 13, 14 and 17, and the release cites the indemnity (15): `tests/unit/legal.test.ts` fails if the
  sections move.

## Pages and UI (standard patterns)
- `/terms` and `/privacy`: public (people read them before signing up), effective date, contents
  list, numbered sections. The release, warranty disclaimer and liability limits are bold with a
  pink rule (conspicuous). "← Back to GGG.Cafe": the installed app has no back button.
- Footer on every page (`SiteFooter` in `components/brand.tsx`): the short disclaimer, links to
  both documents, © line. Small (`text-xs`) and quiet but full-contrast `text-muted`.
- Clickwrap at sign-up (`/register`): an unchecked, required box (`AgreementCheckbox`) with both
  documents one tap away in a new tab; players also confirm they're 13 or older (younger players
  get a parent-made login). The action refuses without them and puts `terms_version` in the new
  account's metadata.
- Contextual notes (`components/legal.tsx`): `SafetyNote` ("Train smart.") on Performance Training
  (player), Dugout Drills, Practice plans (list and each plan) and Training (coach); a line in the
  new-routine form; the printed practice plan's footer. `RewardsNote` on the Leaderboard and the
  Trophy Room (`SectionShell` takes a `notice`). New workout or reward pages get the same notes.

## Agreeing, and asking again
- `public.terms_acceptances` (migration 20261109160000): one row per account and version, stamped
  by the database (`user_id` default `auth.uid()`, `accepted_at` default `now()`; only `version`
  is insertable), no updates or deletes, own rows readable, admins read all. Not `apply_staff_rls`:
  every account type records its own. A trigger on `auth.users` records sign-up agreements from
  the metadata (`private.record_signup_terms`). `tests/db/terms.test.sql`.
- `src/proxy.ts` sends a signed-in page load to `/terms/accept?next=…` when the account's
  `user_metadata.terms_version` isn't `TERMS_VERSION` (`needsTermsAgreement`; posts pass, and the
  documents, sign-in pages and home stay open). That covers accounts made before the Terms and
  player logins a parent made. Agreeing inserts the row, sets the metadata and refreshes the
  session, then continues to `next` (`safeNext`: same-site paths only). "Sign out" if they don't
  agree.
- New version: change the text, set `TERMS_VERSION` and `EFFECTIVE_DATE` to the new date;
  everyone is asked again on their next page load.

## Who, where and how to reach us (user, 2026-11-09)
`LEGAL` in `src/lib/legal.ts`: GGG.Cafe is owned and operated by GMI Digital LLC (the party to the Terms and the
copyright holder in the footer, `COPYRIGHT`); Pennsylvania law; lawsuits in the Court of Common Pleas of
Northampton County or the U.S. District Court for the Eastern District of Pennsylvania; contact
info@gmidigital.io (shown publicly on both documents). The unit test fails if a `[BRACKETED]` blank comes back.

Drafting choices for Pennsylvania (for the attorney to confirm): the release excludes gross negligence,
recklessness and intentional misconduct; if a parent can't release a minor's own claims, the parent still
releases their own (such as medical expenses) and the indemnity still applies.

Open for the attorney: the children's privacy rule (COPPA) expects the notice to list the operator's
mailing address and phone number; only the email is published now.
