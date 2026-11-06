# GGG.Cafe

Softball player development and game-strategy database, with a website on top.

- **Database:** Supabase (Postgres) — project `vhvjoigbkyuebsduonpf`, US East (Ohio)
- **Site:** Next.js 16 (App Router, TypeScript, Tailwind) in `src/`
- **Code:** github.com/JpVanRock/gggcafe
- **Hosting:** not yet — the domain is ready; Vercel is the natural fit when it's time

## Setup on a new machine

```bash
git clone https://github.com/JpVanRock/gggcafe.git GGG.Cafe && cd GGG.Cafe
npm install
cp .env.example .env.local      # then fill it in (see comments in the file)
npm run db:check                # confirms the database connection
npm run dev                     # http://localhost:3000
```

Tools: Node 20+, [Supabase CLI](https://supabase.com/docs/guides/cli), Homebrew Postgres (`brew install postgresql@16`, only for `npm run db:test`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run the site locally |
| `npm run build` | Production build |
| `npm run db:check` | Test the connection to the live database and list applied migrations |
| `npm run db:test` | Apply all migrations + sample data to a throwaway local Postgres and check stat math and access rules. Run before every push. |
| `npm run db:push` | Apply new migrations to the live database (never loads sample data) |
| `npm run db:new <name>` | Create a new migration file in `supabase/migrations/` |
| `npm run db:types` | Regenerate TypeScript types from the live schema (needs `supabase login` once) |

## What's in the database

**Teams & games** — `teams` (ours and opponents, fastpitch or slowpitch), `seasons`, `players`, `roster_entries`, `games`, `lineup_entries`.

**Standard stats (box scores)** — one row per player per game, entered by hand or imported from GameChanger:
`batting_lines`, `pitching_lines`, `fielding_lines`.
Season views compute the standard numbers: `batting_season` (AVG, OBP, SLG, OPS, ISO, BABIP, K%, BB%), `pitching_season` (IP, ERA, WHIP, K/7, BB/7, K/BB, strike %), `fielding_season` (FPCT, catcher CS%).
Innings pitched are stored as outs (5.1 IP = 16 outs). ERA uses 7-inning games.

**Play-by-play (optional, for charted games)** — `plate_appearances` (situation, result, batted-ball type, spray location, exit velo) and `pitches` (type, speed, result, zone). Views:
`pitch_log` (every pitch with its count), `pitcher_pitch_mix` (what a pitcher throws when ahead / behind / even / two strikes), `batter_splits` (vs RHP/LHP, RISP, two outs, bases empty).

**Game strategy** — `scouting_reports` (opponent pitcher/hitter tendencies, defense, signs, coaching habits), `game_plans` (pre-game plan + post-game review), `playbook_plays` (bunt defense, 1st-and-3rd, pickoffs, short game...), `play_calls` (each time a play was called and whether it worked) → `play_effectiveness` view.

**Player development** — `metrics` (exit velo, bat speed, pitch velo, pop time, home-to-first, 60 yd... editable list), `measurements` → `player_metric_progress` view (first / latest / best / improvement), `skill_evaluations` (1–5 by skill area), `development_goals`, `coach_notes`, `drills`, `drill_assignments`.

## Who can see what

Row Level Security is on for every table. Nobody sees anything until they're on the `staff` list:

| | Read | Write | Manage staff |
|---|---|---|---|
| Signed-out visitor | — | — | — |
| Signed in, not on staff | — | — | — |
| `viewer` | ✓ | — | — |
| `coach` | ✓ | ✓ | — |
| `admin` | ✓ | ✓ | ✓ |

**Adding the first admin** (one time):
1. Supabase Dashboard → Authentication → Users → **Add user** (your email + a password).
2. Supabase Dashboard → SQL Editor, run:
   ```sql
   insert into public.staff (user_id, display_name, role)
   select id, 'Your Name', 'admin' from auth.users where email = 'you@example.com';
   ```
After that, admins can add coaches and viewers the same way (or from the site once there's a page for it).

## Changing the database

1. `npm run db:new add_something` → edit the new file in `supabase/migrations/`.
2. Every new table: `select private.apply_staff_rls('public.your_table');`
   Every new view: `create view ... with (security_invoker = true) as ...`
3. `npm run db:test` (the tests fail if a table lacks RLS or a view isn't `security_invoker`).
4. `npm run db:push`.

Sample data lives in `supabase/seed.sql` and is only ever loaded into the local test database.
