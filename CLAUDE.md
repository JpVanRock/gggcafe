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

## Softball conventions
- Default format is fastpitch; `teams.format` allows slowpitch.
- Innings pitched are stored as outs (`outs_recorded`); display as `x.y` where y is 0–2.
- ERA and per-7 rates use 7-inning games: ERA = 7 × ER / IP.
- Box-score lines (`batting_lines` etc.) are the source of truth for standard stats.
  Play-by-play (`plate_appearances`, `pitches`) is optional detail for strategy views.
- Pitch zones: 1–9 strike-zone grid from the catcher's view, 11–14 outside quadrants.

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
