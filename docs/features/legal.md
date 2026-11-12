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
  4, 16, 17, 18 and 20, the boxed notice (`TERMS_NOTICE`) and the agreement page's summary cite the
  arbitration section (20), and the release cites the indemnity (18): `tests/unit/legal.test.ts` fails if
  the sections move.

## Pages and UI (standard patterns)
- `/terms` and `/privacy`: public (people read them before signing up), effective date, contents
  list, numbered sections. The release, warranty disclaimer and liability limits are bold with a
  pink rule (conspicuous). "← Back to GGG.Cafe": the installed app has no back button.
- Footer on every page (`SiteFooter` in `components/brand.tsx`): the GGG.CAFE wordmark at the right, then
  the short disclaimer, links to both documents and the © line across the full page width (user, 2026-11-12). Small (`text-xs`) and quiet but full-contrast `text-muted`.
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

## Audit and rewrite (user, 2026-11-11; version 2026-11-11, everyone agrees again)
The user asked for an audit against four outside sports-site and app terms and privacy policies, used only as
a checklist of topics (nothing copied; all wording is ours). Added to the Terms: electronic signature and
organization authority; no screening of users and no promised results; one account per person; broader
User Content promises, retained team records, de-identified data and feedback; adult-to-minor conduct
rule and child-safety reporting (NCMEC); no scraping, reverse engineering or AI training; an express license
to use the Service; paid features (auto-renewal, cancellation, 30 days' notice of price changes,
non-refundable, app-store and organization purchases, failed payments); copyright notices, counter-notices and
repeat infringers (DMCA); electronic communications and legal notices; stronger warranty disclaimer and
liability limits (user/third-party conduct, unauthorized access, every legal theory, basis of the bargain);
indemnity defense control; termination effects; and, by the user's choice, binding individual arbitration
(FAA, AAA Consumer Rules, talk-first 60 days, small-claims and IP carve-outs, video hearings, fee relief,
class and jury waiver, batching of 25+ coordinated filings, 30-day opt-out by email, court fallback,
public-injunction carve-out, one-year limit), governing law and courts with a jury waiver, a right to reject
later arbitration changes, force majeure, no agency or third-party beneficiaries, U.S.-only and export rules.
A boxed notice at the top of the Terms points to the arbitration section (`LegalDocument`'s `notice`).
Added to the Privacy notice: sources, purposes (no AI training, no automated decisions), sharing outside the
team (legal, safety, NCMEC, consent, business transfer; no sale or sharing for ads), named providers
(Supabase, Vercel, Resend, a payment processor), cookies with Do Not Track and Global Privacy Control, a COPPA
notice to parents (what's collected from children, how it's used and shared, parent rights, consent method),
a written retention schedule (annual review; inactive players deleted or de-identified after 24 months;
children's information within 30 days of a parent's request; accounts within 30 days; backups ~30 days),
a HIPAA note for medical cards, rights for everyone (access, correction, deletion, withdrawal; identity checks;
45-day answers; appeals; non-discrimination; California direct-marketing disclosure), U.S. storage, other
websites, and parent consent before materially different use of children's information.

Operational promises this creates (keep them true): someone reviews accounts once a year and deletes or
de-identifies inactive players (24 months, no active team); deletion requests are handled within 30 days;
arbitration opt-out emails are kept with the account; copyright notices get a response.

Open for the user and the attorney:
- Mailing address and phone number (user, 2026-11-11: email only for now, with a daily reminder): COPPA's
  notice and the copyright-notice process both expect them.
- Register a DMCA designated agent with the U.S. Copyright Office (copyright.gov, small fee) for the
  copyright safe harbor; the Terms name the contact email.
- COPPA's 2025 rule changes also expect a written information security program.
- Parental consent method (fixed, user 2026-11-11): verifiable parental consent by a signed consent form returned as a
  photo or scan, or a video call with our staff, both checked by a GGG.Cafe admin before an under-13 player can sign in
  (details in player-accounts.md). For the attorney: confirm both methods and the form's notice (`CONSENT_NOTICE`).
- Whether arbitration binds minors and how a minor's right to cancel a contract affects the Terms.
