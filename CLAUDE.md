# GGG.Cafe — Project Context

Softball player-development and game-strategy database with a Next.js site.
Unrelated to investment-os — none of that project's rules, sources or database apply here.

GITHUB:   https://github.com/JpVanRock/gggcafe (public repo — never commit secrets)
DATABASE: Supabase project `vhvjoigbkyuebsduonpf` (US East / Ohio), settings in `.env.local`
SITE:     Next.js 16 App Router + TypeScript + Tailwind, `src/`. Not hosted yet.

@AGENTS.md

## Layout
```
src/app/                 pages (App Router): / and /login are public
src/app/(staff)/         signed-in area with shared nav: dashboard, teams, players
                         (each feature folder has page.tsx, actions.ts, client forms)
src/components/ui.tsx    shared page/form/table building blocks
src/lib/auth.ts          getCurrentUser, requireStaffPage, canEdit, editorCheck
src/lib/form.ts          FormData readers + friendlyDbError for server actions
src/lib/softball.ts      positions, bats/throws, formats, row types (must match DB enums)
src/lib/supabase/        server.ts (Server Components/Actions), client.ts (browser),
                         env.ts, database.types.ts (generated: npm run db:types)
src/proxy.ts             refreshes the Supabase auth session each request (Next 16 "proxy", formerly middleware)
supabase/migrations/     schema, applied in filename order
supabase/seed.sql        fictional sample data — local tests only, never pushed
tests/db/                SQL checks run by npm run db:test
scripts/                 db-test.sh, db-push.sh, db-check.sh, db-types.sh (+ lib/env.sh)
tests/unit/              node --test unit tests (npm run test:unit)
```

## Database rules
- Every new table: `select private.apply_staff_rls('public.<table>');` (staff read, coach/admin write).
  Exceptions need their own explicit policies and a reason.
- Every view: `with (security_invoker = true)`, so RLS applies to the caller.
- Security-definer helpers go in the `private` schema (not exposed by the API) with `set search_path = ''`.
- Run `npm run db:test` before `npm run db:push`. It checks stat math, RLS on every table,
  security_invoker on every view, and the viewer/coach/admin access rules.
- Never edit an applied migration; add a new one (`npm run db:new <name>`).
- Never print or commit `.env.local`. The database password lives only there.

## Player dashboard (`/players/[playerId]`, cafe-menu design)
- Layout in `src/app/(staff)/players/[playerId]/player-menu.tsx`: menu header, TWIS board, then
  menu boards. Each board shows a summary and opens a large pop-up (`components/modal.tsx`).
- Add a future section: one entry in the `sections` array (summary + detail components); add a
  board color in `menu.tsx` `BOARD` if needed (brand palette only).
- Section names (user's wording): "{Name}'s Goals" (Harada Method), "{Name}'s Pop Report",
  "Mental GP". Pop Report fields are placeholders until the user specifies them.
- TWIS = This Week in Softball: team practices/events (`team_events`) and games for the player's
  active teams, plus `player_activities`; check-offs in `twis_checks`. Weeks start Monday;
  "today" uses `APP_TIME_ZONE` (default America/New_York) in `src/lib/dates.ts`.
- Harada charts save through the `save_harada_plan` RPC (one transaction, RLS applies).
- Goals have two methods, chosen per player in the Goals pop-up (`players.goal_method`):
  Harada (full chart) or SMART (lighter; rows in `development_goals` with specific/measurable/
  achievable/relevant + target_date, optionally a metric target tracked against measurements).
  Switching never deletes the other method's goals.
- Performance Training: routines are `player_activities` with a `category` (workout, stretching,
  hitting, fielding, pitching for P, catching for C) and optional `drill_id` from the shared
  `drills` library. They appear in TWIS; check-offs drive consistency and achievements.
  Rules live in `src/lib/achievements.ts` (no imports; unit-tested with `npm run test:unit`).
  Earned achievements are stored in `player_achievements` when a box is ticked and never removed.
- IQ Test: shared `iq_questions` bank (topic general/hitting/pitching/position) with a starter
  set seeded by migration; `iq_answers` per player. Correct answers are checked server-side
  (`answerIqQuestion`) so quiz questions are sent to the browser without them.
- Coaches/admins fill dashboards in for now; player logins are a planned follow-up.

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
- Site font: Jost (next/font/google), chosen to pair with Montecatini Pro; has tabular figures.
- Always dark. Use the tokens from `src/app/globals.css`, never zinc/gray or `dark:` classes:
  `navy-950` page, `navy-900` cards, `navy-800` hover/inputs, `navy-700/600` borders,
  `ink` text, `muted` secondary text, `neon` (logo yellow) primary buttons/titles/numbers,
  `pink` (logo pink) links/focus/selected/accents, `danger` errors.
- Page titles: uppercase, letter-spaced, neon, with a short pink rule (see `PageHeader`).

## Next.js 16 notes
- `middleware.ts` is now `proxy.ts` (export `proxy`).
- `cacheComponents` is on: anything reading cookies (any Supabase server query) must sit inside `<Suspense>`.
- Server-side Supabase `createClient()` calls `connection()` first, because Supabase's token-expiry
  check uses `Date.now()`, which Cache Components rejects during prerender/prefetch. Keep it.
- Auth: `getCurrentUser()` in `src/lib/auth.ts` (verified claims + staff record). `src/proxy.ts`
  redirects signed-out visitors away from `/dashboard`; pages still check staff access themselves.
- Read `node_modules/next/dist/docs/` before using an unfamiliar API.
