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
  documents one tap away in a new tab. Players don't sign up (user, 2026-11-16): a parent makes
  each player's login. The action refuses without the box and puts `terms_version` in the new
  account's metadata.
- Contextual notes (`components/legal.tsx`): `SafetyNote` ("Train smart.") on Performance Training
  (player), Dugout Drills, Practice plans (list and each plan) and Training (coach); a line in the
  new-routine form; the printed practice plan's footer. The Drill Library shows it without the "Terms, section 4" link
  (user, 2026-11-12; `termsLink={false}`). `RewardsNote` on the Leaderboard and the
  Trophy Room (`SectionShell` takes a `notice`); the Trophy Room's leaves off the "Terms, section 7" link (user,
  2026-11-16; `termsLink={false}`). New workout or reward pages get the same notes.

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
- Parental consent method: since 2026-11-16 the parent accepts online (see "Consent by clicking Accept" below). Before,
  user 2026-11-11: a signed consent form returned as a photo or scan, or a video call with our staff, both checked by a
  GGG.Cafe admin. For the attorney: the click method, and the notice (`CONSENT_NOTICE`).
- Whether arbitration binds minors and how a minor's right to cancel a contract affects the Terms.

## Voice memos (user, 2026-11-12; version 2026-11-12, everyone agrees again)
My Journal lets players record voice memos (docs/features/player-dashboard.md). The Privacy notice now lists
journal entries "typed, or voice memos she records" under player information and in the children's section,
and voice memos with photos and logos under private storage. A recording of a child's voice is personal
information under COPPA, so the user chose to have everyone agree again. Existing signed parental consents
stay on file with the version they were given under; whether parents of players under 13 should sign a new
consent form for this change is for the attorney to confirm.

## Video calls (user, 2026-11-12; version 2026-11-13, everyone agrees again)
Zoom joins the service providers (docs/features/video-calls.md). The Privacy notice says what we keep about a call
(who, when, how long, what about), that it runs on Zoom while it happens and isn't recorded, and, in the children's
section and the parental consent notice, that her parents are invited to every call. Shipped late on 2026-11-12
Eastern, after that day's version, so it took the next date.

## Group video calls (user, 2026-11-14; version 2026-11-14, everyone agrees again)
Mentors and head coaches can book one call with several players from one team (docs/features/video-calls.md). On a
group call the invited players and their parents can see and hear each other, so the Privacy notice now says a call can
be with a group (section 1), that group-call families see and hear each other during the call while the site lists
each family only its own daughter's invitation (section 4), and the children's section and the parental consent
notice say the same. Because that's a new way other families see a child, the version moved to 2026-11-14 and
everyone agrees again. Signed parental consents stay on file under the version they were given; whether parents of
players under 13 should sign again for group calls is for the attorney (the review page's video-call question).

## Consent by clicking Accept (user, 2026-11-16; version 2026-11-16, everyone agrees again)
"Please remove the physical consent sign form process. They should be able to click accept to provide consent. The
database can record the IP address and timestamp with email they registered with as proof. Remove the Can't print
section as well." Before building it, the user was told that a click to accept with IP, time and email likely isn't one
of COPPA's recognized methods of verifiable parental consent when a child's information is shared with others in the
service (signed form, video call, card transaction, ID check), and that with the parent code anyone holding the code can
become a girl's parent with no one checking; the user chose the click method anyway, over holding it for the legal review
or a card check. Now: on Logins & Teams the parent reads `CONSENT_NOTICE`, enters their full name and relationship,
ticks `CONSENT_STATEMENT` and presses Accept (`acceptParentalConsent` → `accept_parental_consent`, migration
20261117020138): status `verified` at once, method `online`, with `consent_email`, `consent_ip`, `consent_user_agent` and
the time. The printable form (`/family/consent/[playerId]/pdf`), the upload and the "Can't print it? Ask for a video
call" option are gone; requests still waiting from before are replaced when the parent accepts, or an admin can still
check them on the Roster tab. The Terms ("Agreeing") and the Privacy notice's children's section describe the new method
and the record kept, so the version moved to 2026-11-16 and everyone agrees again. For the attorney: whether this method
is enough, or which verifiable method to add back.
