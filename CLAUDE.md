# GGG.Cafe — Project Context

Softball player-development and game-strategy database with a Next.js site.
Unrelated to investment-os — none of that project's rules, sources or database apply here.

GITHUB:   https://github.com/JpVanRock/gggcafe (public repo — never commit secrets)
DATABASE: Supabase project `vhvjoigbkyuebsduonpf` (US East / Ohio), settings in `.env.local`
SITE:     Next.js 16 App Router + TypeScript + Tailwind, `src/`. Not hosted yet.

@AGENTS.md

## Layout
```
src/app/                 pages (App Router)
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

## Next.js 16 notes
- `middleware.ts` is now `proxy.ts` (export `proxy`).
- `cacheComponents` is on: anything reading cookies (any Supabase server query) must sit inside `<Suspense>`.
- Server-side Supabase `createClient()` calls `connection()` first, because Supabase's token-expiry
  check uses `Date.now()`, which Cache Components rejects during prerender/prefetch. Keep it.
- Auth: `getCurrentUser()` in `src/lib/auth.ts` (verified claims + staff record). `src/proxy.ts`
  redirects signed-out visitors away from `/dashboard`; pages still check staff access themselves.
- Read `node_modules/next/dist/docs/` before using an unfamiliar API.
