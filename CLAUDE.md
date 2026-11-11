# GGG.Cafe — Project Context

Softball player-development and game-strategy database with a Next.js site.
Unrelated to investment-os — none of that project's rules, sources or database apply here.

GITHUB:   https://github.com/JpVanRock/gggcafe (public repo — never commit secrets)
DATABASE: Supabase project `vhvjoigbkyuebsduonpf` (US East / Ohio), settings in `.env.local`
SITE:     Next.js 16 App Router + TypeScript + Tailwind, `src/`.
HOSTING:  Vercel team "GGG", project `gggcafe`, https://gggcafe.vercel.app. Every push to main
          deploys to production. Vercel env vars: NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (never the DB password). Optional, server-only, for
          emailing practice plans: RESEND_API_KEY + EMAIL_FROM (see src/lib/email.ts).

@AGENTS.md

## Layout
```
src/app/                 pages (App Router): /, /login and /register are public (sign-up needs a team code); /family is the parents' home,
                         /me the players' home (claims; then her dashboard at /players/[id])
src/app/(staff)/         signed-in area with shared nav: dashboard (own view per role), teams, players
                         (each feature folder has page.tsx, actions.ts, client forms)
src/components/ui.tsx    shared page/form/table building blocks
src/lib/auth.ts          getCurrentUser, requireStaffPage, canEdit, editorCheck, isHeadCoach, headCoachCheck
src/lib/roles.ts         staff roles (Head Coach / Assistant Coach / Admin / Viewer), Dugout tabs per role
src/lib/form.ts          FormData readers + friendlyDbError for server actions
src/lib/softball.ts      positions, bats/throws, formats, row types (must match DB enums)
src/lib/supabase/        server.ts (Server Components/Actions), client.ts (browser),
                         env.ts, database.types.ts (generated from the migrations: npm run db:types)
src/components/main-nav.tsx  top menu: staff get Dashboard/Coaches Dugout (opens Roster)/Teams/Players on every page,
                         including /me and /family; players get "My profile". Every header is <SiteHeader>
                         (site-header.tsx): on phones the links fold behind a Menu button
src/proxy.ts             refreshes the Supabase auth session each request (Next 16 "proxy", formerly middleware)
src/app/terms, privacy   Terms of Service and Privacy & Security (public); /terms/accept asks signed-in users to agree
src/app/manifest.ts      the phone app (installable web app; opens /dashboard, which routes each account home).
                         Icons in public/icons/ (maskable = logo inside the 80% safe zone); iPhone settings are
                         `appleWebApp` in the root layout. No service worker: nothing private is cached on phones
supabase/migrations/     schema, applied in filename order
supabase/seed.sql        fictional sample data — local tests only, never pushed
tests/db/                SQL checks run by npm run db:test
scripts/                 db-test.sh, db-push.sh, db-check.sh, db-types.sh (+ lib/env.sh)
tests/unit/              node --test unit tests (npm run test:unit)
```

## Shared building blocks (use these, don't copy them)
- UI components and the type scale: `docs/features/ui-components.md`. `Field`, `buttonStyles`/`SubmitButton`,
  `Badge`/`badgeClass`, `CountBadge`, `Eyebrow`, `Card`, `EmptyState`, `Loading`, `TableScroll` (`components/ui.tsx`);
  `ConfirmSubmit`/`confirmAction` instead of `window.confirm`. Nothing under 12px (`text-2xs`); pink text is
  `text-link`. `tests/unit/ui-rules.test.ts` enforces these.
- Form fields: `inputClass` is full width. An input that sets its own width uses `fieldClass` + `w-*` (never
  `${inputClass} w-20`: both widths apply and full width wins).
- Dugout pages: `const dugout = await loadDugoutTeam(supabase, teamParam); if (!dugout) return <NoOwnTeam />;` then
  `const { teams, team } = dugout` (`dugout/data.ts`, `dugout/team-picker.tsx`); `<TeamPicker>`; a tab's sub-menu is
  `<PillNav items={teamPages(PAGES, teamId)}>` (`components/pill-nav.tsx`).
- Server actions that append to an ordered list: `nextPosition(supabase, table, column, value)` (`src/lib/db.ts`).
- Every server action reports back. Form actions are `(prev: FormState, fd: FormData) => Promise<FormState>`: wrap the
  body in `runAction(async () => {…})`, return `failed(message)` for a check that fails (`failed(denied)` for
  permission, `failed(STALE)` for a malformed or stale form, `invalid("field", message)` from `src/lib/form.ts` when one
  form field is wrong: the form marks and focuses that field), and wrap writes in `must(await supabase…)` so a database
  error becomes a message (`src/lib/actions.ts`). A form without its own client component uses
  `<ActionForm action={…}>` (`components/action-form.tsx`), which shows the message after its controls. Never
  `return;` silently.
- Player-area server actions live in one file per section in `players/[playerId]/`: `twis-actions` (check-offs,
  activities), `goals-actions` (Harada, SMART, goal method), `mental-actions`, `training-actions` (routines),
  `iq-actions` (practice, level tests, review), `scorebook-actions` (lessons, games), `pop-actions` (movement, hitting
  style), plus the older feature files; shared helpers that aren't actions go in a plain server module
  (`player-achievements.ts`). Softball IQ UI: `iq-quiz-client.tsx` (practice quiz, question bank) and
  `iq-tests-client.tsx` (level tests), shared bits in `iq-shared.ts`.
- Names: `playerName()` in `src/lib/softball.ts`.
- Rosters: `src/lib/roster.ts`. A team's players: `loadRoster(supabase, teamId, { seasonId?, order? })` (active, current
  season by default); the season: `currentSeason()` / `seasonOrCurrent()` (the database's `team_current_season`, the
  same rule as claims and RLS); a player's teams: `activeTeams()` / `activeTeamIds()`. GameDay, practice plans and
  Training extend it. Only management views (Roster tab, team page, intake, budget) query every season themselves.
- The approvals count (top menu + Dugout tabs): `getWaitingCount()` in `src/lib/approvals.ts` (React `cache()`, one
  fetch per request).
- Lists that grow every season (past plans, lineups, games) show the latest `RECENT_LIMIT` (30) with
  `<ShowAllLink>` (`?past=all`, `?lineups=all`, `?games=all`). New lists of that kind do the same.
- Index a foreign key the app filters or joins on (Postgres doesn't index them; see migration 20261109120000).
- Load independent queries together (`Promise.all`); only what needs an earlier result waits for it (see the player
  dashboard, `players/[playerId]/page.tsx`: two rounds).

## Checks (CI: .github/workflows/ci.yml runs all of these on every push)
- `npm run lint`, `npx tsc --noEmit`, `npm run test:unit`, `npm run db:test`, `npm run build`, then
  `npm run test:pages` and `npm run test:a11y`. The page smoke test renders every page and PDF route of the build in sample-data mode
  (`GGG_SAMPLE_DATA=1`: fictional data in `src/lib/supabase/sample/`, signed in as a sample admin; never on Vercel)
  and fails on an error page, a section that errors or 404s, a redirect to sign in, or a server error; it also checks the app manifest
  and its icons. A new dynamic
  route needs a sample value in `scripts/lib/sample-site.mjs` (`fill`) and, if it reads new tables, sample rows in
  `sample/data.ts`. To look at pages with sample data: launch config `site-sample` (port 3159) after a build.
  The accessibility check runs axe-core (WCAG 2.2 A/AA) on every sample page in headless Chrome (`CHROME_PATH`, or the
  runner's google-chrome), then contrast again in Day Game; it fails on critical or serious problems (`scripts/test-a11y.mjs`).
  `npm run screens` saves the key pages at phone and desktop width in both themes to `screens/` (`-- --compare <dir>` marks
  what changed since an earlier run); CI keeps each run's screens as the `screens` artifact.

## Database rules
- Every new table: `select private.apply_staff_rls('public.<table>');` (staff read, coach/admin write).
  Exceptions need their own explicit policies and a reason.
- Every view: `with (security_invoker = true)`, so RLS applies to the caller.
- Security-definer functions go in the `private` schema (not exposed by the API) with `set search_path = ''`, check
  the caller first, and get their public wrapper and grants from `select private.expose('private.fn(args)')`
  (add `array['anon', 'authenticated']` only for signed-out pages). Start one with `npm run db:new:definer <name>`
  (template `supabase/templates/definer-function.sql`). `tests/db/zz_functions.test.sql` fails on a definer function
  in public, one without the search_path, one everyone can run, or anything signed-out visitors can call beyond
  sign-up. A new private helper used by RLS needs `grant execute … to authenticated` (PUBLIC no longer has it).
- Run `npm run db:test` before `npm run db:push`. It checks stat math, RLS on every table,
  security_invoker on every view, and the viewer/coach/admin access rules.
- Never edit an applied migration; add a new one (`npm run db:new <name>`).
- The app is typed from the schema: `src/lib/supabase/database.types.ts` is generated from the migrations by
  `npm run db:types` (`scripts/gen-types.py` over a throwaway local Postgres; no Docker or `supabase login`). Run it
  after adding a migration: `db:test` fails while the types are out of date. Typed JSON columns are listed in
  `scripts/json-types.json`. Keep `.select()` strings literal (one string, not built) so results are typed, and
  don't use `as unknown as`: a plain `as` is checked against the inferred type.
- Never print or commit `.env.local`. The database password lives only there.

## Always (rules from the feature docs that apply to every change)
- No reference to any outside course, program or author anywhere on the site, in code, comments or docs; write
  content in our own words (no quotes from licensed material). The movement booklet is never named.
- Paid content (`src/lib/advanced-book.ts`, `src/lib/leadership-guide.ts`) is imported by server code only.
- Privacy: medical cards only for head coaches/admins and her approved parents; the Leader Badge and certificate only for
  coaches/admins and the player; Pop Report coach notes for coaches only; teammates see each other only through
  definer functions (`team_leaderboard`, `team_yearbook`, `team_squads`); player photos are private (signed URLs); team
  logos are signed-in only (private bucket, `signedLogoUrl()` in `src/lib/team-logos.ts`); signed-out visitors can't list
  teams (sign-up checks one team code with `signup_team()`).
- When a feature or its access changes, update `src/lib/access-faq.ts` and `src/lib/account-types.ts` (admin FAQ).
- Copy for players: direct and confident, for teenage athletes; fastpitch terms (innings, the circle, the dugout).
- Legal (`docs/features/legal.md`, words in `src/lib/legal.ts`): every page has the footer disclaimer; a page with
  workouts, drills or routines shows `SafetyNote`, one with points, badges or awards `RewardsNote`
  (`components/legal.tsx`). Signed-in users must have agreed to the current `TERMS_VERSION` (`src/proxy.ts` sends them
  to /terms/accept); a change people should agree to again bumps it. /terms and /privacy stay public.

## Feature docs (read the one you're changing first; keep it current)
| Area | Doc | What's in it |
|---|---|---|
| Access FAQ | `docs/features/access-faq.md` | Admin FAQ page comparing Standard and Advanced access |
| Account types | `docs/features/account-types.md` | The five sign-ups, assistants, parent-made player logins, /faq/accounts |
| Coaches Dugout | `docs/features/coaches-dugout.md` | Dugout tabs: GameDay, Team Budget, Parents, Calendar, standards/culture, drills, practice plans |
| Culture & team | `docs/features/culture-team.md` | Motto, season goals, pledge, Player Spotlights |
| Dugout Roster tab | `docs/features/dugout-roster.md` | The Roster tab: approvals, roster, player accounts |
| Family & roster | `docs/features/family-roster.md` | Medical card, preseason questionnaire, parent welcome packet |
| G3 Advanced | `docs/features/g3-advanced.md` | The paid book "How to Cook": chapters, position chapters, access |
| G3 Leadership Guide | `docs/features/leadership-guide.md` | Full program and Leadership Light, lessons, plan, sign-off, certificate, Leader Badge; voice rules |
| Game-day production | `docs/features/game-day-production.md` | DP/FLEX, umpire card, jobs, substitutions, staff duties, box scores, QAB/BP, stat explainers |
| Hitting & Softball IQ | `docs/features/hitting-iq.md` | Offense IQ, My Zone, Hitting Approach chapter |
| Legal | `docs/features/legal.md` | Terms of Service, Privacy & Security, footer disclaimer, sign-up agreement, safety and rewards notes |
| Mental game | `docs/features/mental-game.md` | Mental GP tools: signals, intensity, self-scan, guided sessions, journal; G3 Mental Toughness |
| Mentors | `docs/features/mentors.md` | Mentor sign-up, approvals (parents / head coach), private messages, notes and focus with coaches, training |
| Movement Preferences and Preferred Hitting Style | `docs/features/movement-hitting.md` | Movement Preferences (G3) and Preferred Hitting Style |
| Offseason Training Leaderboard and + Activity | `docs/features/leaderboard.md` | Points, Player of the Week, the Leaderboard page, notifications |
| Offseason training | `docs/features/offseason-training.md` | Dugout → Training: roadmap phases, team routines, testing, offseason draft |
| Pitching & catching | `docs/features/pitching-catching.md` | Battery IQ, scripted bullpens, pitcher game plans |
| Player accounts | `docs/features/player-accounts.md` | Claims, what an approved player can see and edit, IQ integrity |
| Player dashboard | `docs/features/player-dashboard.md` | Her menu: sections, TWIS, goals, Performance Training, Softball IQ tests, Keep the Book, Trophy Room |
| Players page and intake | `docs/features/players-intake.md` | Players list by age group, player intake, profile photos |
| Practice planning | `docs/features/practice-planning.md` | Install checklist, road to opening day, notes and cues for players |
| Team Yearbook | `docs/features/yearbook.md` | Season photos, who can add and view, the viewer |
| Team playbook & scouting | `docs/features/playbook-scouting.md` | Depth chart, call sheet and flashcards, team quizzes, scouting |
| UI components | `docs/features/ui-components.md` | Type scale, shared components and props, states, accessibility rules |

## Softball conventions
- Default format is fastpitch; `teams.format` allows slowpitch.
- Innings pitched are stored as outs (`outs_recorded`); display as `x.y` where y is 0–2.
- ERA and per-7 rates use 7-inning games: ERA = 7 × ER / IP.
- Box-score lines (`batting_lines` etc.) are the source of truth for standard stats.
  Play-by-play (`plate_appearances`, `pitches`) is optional detail for strategy views.
- Pitch zones: 1–9 strike-zone grid from the catcher's view, 11–14 outside quadrants.

## Design audience (user feedback, 2026-11-06)
Players are teenage girls (around 16). Everything must look age-appropriate: sleek and athletic,
like a sports brand or media-day graphics. Never childish or preschool.
- No cartoon doodles or clip-art (the hand-drawn bat/softball/star doodles were removed for this).
- No gold stars, stickers or emoji-style rewards; achievements use the hexagon badge.
- Prefer: outlined numerals (`OutlineText`, e.g. jersey number, section 01–05), thin speed stripes
  (`SpeedStripes`), sharp type, progress bars, real stats. Both live in `src/components/athletic.tsx`.
- Corners: `rounded-2xl` at most for boards and cards; no bubbly 2rem radii or dashed "craft" borders on
  boards (a dashed outline is fine for an empty-state placeholder).
- Copy: direct and confident, like a coach talking to a varsity athlete. No cutesy phrasing.
- The cafe-menu concept stays (numbered menu boards, "Full details →"), executed in this style.

## Brand
- Logo: `public/brand/ggg-cafe-logo.webp` (use `<Logo>` from `src/components/brand.tsx`);
  favicon/icons in `src/app/` are generated from it.
- Type logo "GGG.CAFE": `public/brand/ggg-cafe-wordmark.png` (transparent, `<Wordmark>`). It sits
  bottom-right on every page via `<SiteFooter>` in the root layout; keep pages from covering it. The logo lettering is Montecatini Pro
  (Louise Fili, commercial) and only appears as the image.
- Fonts (next/font/google, user's choice after a side-by-side test, 2026-11-07): DM Sans (`font-sans`,
  brand kit) for body and interface (text, buttons, navigation, forms, captions). Jost
  (`font-display`) for h1/h2 titles, tables, `dd` values, anything `tabular-nums`, outlined numerals
  and the award engravings: DM Sans has no tabular figures, so numbers wouldn't line up. The
  Jost rule lives in `@layer base` in globals.css, so `font-mono` (Space Mono) still wins.
- Brand kit (Edition 03, from the user; not in the repo): colors Navy #000A2D, Neon Yellow #E7FB06,
  Neon Pink #FE1F7C, White. The site tokens (`navy-950`, `neon`, `pink`) use exactly these values;
  hard-coded glows use the same RGB (0 10 45 / 231 251 6 / 254 31 124). Tagline "Elevate Together": use ONLY the supplied artwork
  (`public/brand/elevate-together-yellow.png`, `<Tagline>` in `src/components/brand.tsx`; custom
  lighter Permanent Marker), never retype it in the font, never lock it up with a logo, don't
  stretch/outline/add effects/recolor. Sign-in page: logo 8.4rem, tagline, "Good Vibes Only".
- Night Game (dark, default) / Day Game (white) switch at the top right (`src/components/theme-toggle.tsx`,
  `html[data-theme="day"]`, saved in localStorage `ggg-theme`, applied before paint by a script in the
  root layout). Day Game only re-maps tokens in `globals.css`, so use tokens by ROLE:
  `text-highlight` for emphasis text (neon at night, navy by day; never `text-neon`), `text-link` for pink text,
  `text-on-accent` for text on neon/pink fills (never `text-navy-950`), `bg-neon`/`bg-pink` for fills.
  `keep-night` keeps a piece in night colors (the field diagram; the navy chip behind the footer
  wordmark, which the brand kit approves only over navy). `day:` variant for Day-only tweaks.
  The sign-in tagline swaps to `elevate-together-navy.png` (same artwork, ink recolored to brand navy)
  in Day Game, with no panel behind it (user's choice).
- Text sizes (user, 2026-11-07): body text is one notch larger than Tailwind's defaults
  (`text-xs` 13px, `text-sm` 15px, base 17px; set in globals.css @theme). Titles (text-lg and up)
  are unchanged. Small uppercase labels (card section labels, DetailHeading, table headers, badges) use
  `text-2xs` (12px), the smallest size on the site.
- Use the tokens from `src/app/globals.css`, never zinc/gray or `dark:` classes:
  `navy-950` page, `navy-900` cards, `navy-800` hover/inputs, `navy-700/600` borders,
  `ink` text, `muted` secondary text, `neon` (brand yellow) primary-button fills, `highlight` titles/numbers,
  `pink` (logo pink) focus/selected/accents and fills (`text-link` for pink text), `danger` errors.
- Page titles: uppercase, letter-spaced, neon, with a short pink rule (see `PageHeader`).

## Next.js 16 notes
- `middleware.ts` is now `proxy.ts` (export `proxy`).
- `cacheComponents` is on: anything reading cookies (any Supabase server query) must sit inside `<Suspense>`. Pages
  get it from `loading.tsx` files (one line: `export { Loading as default } from "@/components/ui"`), one in every
  folder that has a layout or child pages, so pages are plain `export default async function XPage(props: PageProps<…>)`.
  A new folder with pages under it gets its own `loading.tsx` (else navigating inside it shows no "Loading…"). Pages
  with a static header (login, /me, /family, Players, Teams) keep their own inner `<Suspense>`.
- Server-side Supabase `createClient()` calls `connection()` first, because Supabase's token-expiry
  check uses `Date.now()`, which Cache Components rejects during prerender/prefetch. Keep it.
- Password reset: /forgot-password emails a link (`resetPasswordForEmail`, redirect to
  /auth/confirm?next=/reset-password); /auth/confirm (route handler) signs her in from `?code=` or
  `?token_hash=&type=`; /reset-password sets the new password. The Supabase "Reset Password" email template links straight to
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` (user, 2026-11-09):
  the default `{{ .ConfirmationURL }}` (PKCE `?code=`) only works in the browser that asked and within ~5 minutes.
  Supabase's built-in email sends about 2 emails an hour for the whole project (resets + sign-up confirmations);
  more needs custom SMTP in Supabase Auth settings. Per person: 4 reset emails per address every 20 minutes
  (`allow_password_reset()`, signed-out callable; keeps only a SHA-256 of the address, for a day). Supabase Auth URL config: Site URL
  https://gggcafe.vercel.app, Redirect URLs https://gggcafe.vercel.app/** (localhost isn't listed).
- Auth: `getCurrentUser()` in `src/lib/auth.ts` (verified claims + staff record). `src/proxy.ts`
  redirects signed-out visitors away from `/dashboard`; pages still check staff access themselves.
- Read `node_modules/next/dist/docs/` before using an unfamiliar API.
