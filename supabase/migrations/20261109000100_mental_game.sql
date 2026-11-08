-- =============================================================================
-- Mental game (Phase 1 of the SB Blueprint build, user 2026-11-08)
--   Standard (every player with an approved claim):
--     - My signals: green / yellow / red and a release for yellow and red, plus her
--       ideal intensity zone (columns on mental_game_plans)
--     - Intensity checks: 1-10 before a game or practice (mental_intensity_checks)
--     - Monthly self-scan: ten mental skills rated 1-5 (mental_scans; skill order in
--       src/lib/mental.ts SCAN_SKILLS, append only)
--     - Guided sessions: breathing and imagery scripts (src/lib/mental.ts), seeded as
--       "mental" training drills (drills.guide) so they become Performance Training
--       routines in TWIS: streaks and achievements count, Leaderboard points don't
--     - Practice journal: a purpose before practice, what worked and what to fix
--       after (journal_entries), and a weekly look-back (journal_weeks)
--   G3 Advanced: the Mental Toughness chapter's course; her place in it is saved on
--   player_advanced_chapters (course_step, course_done_at).
-- =============================================================================

-- My signals and her zone
alter table public.mental_game_plans
  add column green_signs    text check (char_length(green_signs) <= 500),
  add column yellow_signs   text check (char_length(yellow_signs) <= 500),
  add column red_signs      text check (char_length(red_signs) <= 500),
  add column yellow_release text check (char_length(yellow_release) <= 500),
  add column red_release    text check (char_length(red_release) <= 500),
  add column zone_low       smallint check (zone_low between 1 and 10),
  add column zone_high      smallint check (zone_high between 1 and 10),
  add constraint mental_game_plans_zone_check check (zone_low is null or zone_high is null or zone_low <= zone_high);

-- Intensity checks
create table public.mental_intensity_checks (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  checked_on date not null,
  context    text not null default 'game' check (context in ('game', 'practice', 'other')),
  level      smallint not null check (level between 1 and 10),
  adjustment text check (char_length(adjustment) <= 200),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index mental_intensity_checks_player_idx on public.mental_intensity_checks (player_id, checked_on desc);

-- Monthly self-scan: one row per player and month (the 1st)
create table public.mental_scans (
  player_id  uuid not null references public.players (id) on delete cascade,
  month      date not null check (extract(day from month) = 1),
  scores     smallint[] not null check (cardinality(scores) = 10 and 1 <= all (scores) and 5 >= all (scores)),
  note       text check (char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (player_id, month)
);

-- Practice journal
create table public.journal_entries (
  player_id  uuid not null references public.players (id) on delete cascade,
  entry_date date not null,
  purpose    text check (char_length(purpose) <= 200),
  worked     text check (char_length(worked) <= 500),
  fix        text check (char_length(fix) <= 500),
  updated_at timestamptz not null default now(),
  primary key (player_id, entry_date)
);
create table public.journal_weeks (
  player_id  uuid not null references public.players (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  look_back  text check (char_length(look_back) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (player_id, week_start)
);

-- Staff read, coaches write (as everywhere); the player keeps her own.
do $$
declare
  t text;
begin
  foreach t in array array['mental_intensity_checks', 'mental_scans', 'journal_entries', 'journal_weeks'] loop
    perform private.apply_staff_rls(format('public.%I', t)::regclass);
    execute format('create policy "player manages her own" on public.%I for all to authenticated
                      using (player_id in (select private.my_player_ids()))
                      with check (player_id in (select private.my_player_ids()))', t);
  end loop;
end $$;

-- Mentors read the mental-game tools of the players assigned to them (they already
-- read her Mental GP); not her journal.
create policy "mentor reads her players' intensity checks" on public.mental_intensity_checks for select to authenticated
  using (player_id in (select private.my_mentee_ids()));
create policy "mentor reads her players' self-scans" on public.mental_scans for select to authenticated
  using (player_id in (select private.my_mentee_ids()));

-- Guided sessions in the training drill library
alter table public.drills
  add column guide text check (guide ~ '^[a-z0-9-]{1,40}$');
create unique index drills_guide_idx on public.drills (guide) where guide is not null;

insert into public.drills (name, area, description, category, guide) values
  ('Guided: Reset Breath', 'mental', 'In for four, out for six. The breath you use between pitches. About 2 minutes.', 'mental', 'reset-breath'),
  ('Guided: Box Breathing', 'mental', 'In, hold, out, hold for four counts each. Settles you before a game or a big at-bat. About 2 minutes.', 'mental', 'box-breathing'),
  ('Guided: Red-Light Breath', 'mental', 'A long, slow breath out to come back from red. About 2 minutes.', 'mental', 'red-light-breath'),
  ('Guided: Game Face', 'mental', 'See your pre-game from arrival to first pitch and walk on the field at green. About 3 minutes.', 'mental', 'game-face'),
  ('Guided: Confident At-Bat', 'mental', 'See a full at-bat, routine to contact, including a two-strike battle. About 3 minutes.', 'mental', 'confident-at-bat'),
  ('Guided: Lock-In Inning', 'mental', 'See a full inning on defense or in the circle, including the reset after a mistake. About 3 minutes.', 'mental', 'lock-in-inning')
on conflict (name) do update set area = excluded.area, description = excluded.description, category = excluded.category, guide = excluded.guide;

-- The G3 course: where she is and when she finished it
alter table public.player_advanced_chapters
  add column course_step    smallint not null default 0 check (course_step between 0 and 200),
  add column course_done_at timestamptz;

-- Leaderboard: mental routines count toward streaks and achievements, not session points.
create or replace function private.offseason_tally(p_player_id uuid, p_from date, p_to date)
returns table (training integer, workouts integer, lessons integer, unlocks integer, points integer)
language sql stable security definer set search_path = '' as $$
  with sessions as (
    select l.kind::text as kind
      from public.training_logs l
     where l.player_id = p_player_id and l.logged_on between p_from and p_to
    union all
    select case when a.category = 'workout' then 'workout' else 'training' end
      from public.twis_checks c
      join public.player_activities a on a.id = c.activity_id
     where c.player_id = p_player_id and a.category is not null and a.category::text <> 'mental'
       and c.on_date between p_from and p_to
  ),
  earned as (
    select count(*)::integer as n from (
      select earned_on as d from public.player_rings where player_id = p_player_id
      union all select earned_on from public.player_golden_gloves where player_id = p_player_id
      union all select earned_on from public.player_mvp_badges where player_id = p_player_id
      union all select earned_on from public.player_world_series_trophies where player_id = p_player_id
      union all select earned_on from public.player_manager_awards where player_id = p_player_id
      union all select earned_on from public.player_hidden_awards where player_id = p_player_id
      union all select unlocked_on from public.player_achievements where player_id = p_player_id
    ) u where u.d between p_from and p_to
  ),
  counts as (
    select count(*) filter (where kind = 'training')::integer as training,
           count(*) filter (where kind = 'workout')::integer as workouts,
           count(*) filter (where kind = 'lesson')::integer as lessons
      from sessions
  )
  select c.training, c.workouts, c.lessons, e.n,
         3 * c.training + 5 * c.workouts + 7 * c.lessons + 3 * e.n
    from counts c cross join earned e
$$;
