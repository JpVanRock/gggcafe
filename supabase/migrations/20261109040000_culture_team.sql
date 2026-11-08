-- =============================================================================
-- Culture & team (SB Blueprint Phase 5, user 2026-11-08)
--   72 Her commitment and the team pledge: an "I will..." line for each Team Standard
--      and her signature on the team pledge, each season (team_pledges).
--   37 Team Season Goals by season phase, with a target tracked by hand until box
--      scores exist (team_goals), and a season motto (team_culture.motto) shown in
--      From the Dugout.
--   40 Player Spotlight: a short coach-written feature for the team, with a
--      media-day graphic (player_spotlights).
--   (75 Know Your Why Extra Reps are content in src/lib/leadership-guide.ts.)
-- Culture is head-coach work (like Team Standards): goals, motto and spotlights are
-- head-coach writes; players on the team read them.
-- =============================================================================

alter table public.team_culture add column motto text check (char_length(motto) <= 80);

create table public.team_pledges (
  player_id   uuid not null references public.players (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete cascade,
  season_id   uuid not null references public.seasons (id) on delete cascade,
  lines       jsonb not null default '{}' check (jsonb_typeof(lines) = 'object'),   -- standard title -> her "I will..." line
  signed_name text check (char_length(signed_name) <= 80),
  signed_at   timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (player_id, team_id, season_id),
  check ((signed_at is null) = (signed_name is null))
);
select private.apply_staff_rls('public.team_pledges');
create policy "player keeps her own pledge" on public.team_pledges for all to authenticated
  using (player_id in (select private.my_player_ids()))
  with check (player_id in (select private.my_player_ids()) and team_id in (select private.my_current_team_ids()));

create table public.team_goals (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  phase       text not null default 'season' check (phase in ('preseason', 'early', 'mid', 'late', 'postseason', 'season')),
  title       text not null check (char_length(title) between 1 and 140),
  target      numeric(8,2),
  current     numeric(8,2),
  unit        text check (char_length(unit) <= 20),
  achieved_at timestamptz,
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index team_goals_team_idx on public.team_goals (team_id, position);

create table public.player_spotlights (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  player_name  text not null check (char_length(player_name) between 1 and 80),   -- as the coach shares it with the team
  jersey       text check (char_length(jersey) <= 3),
  headline     text not null check (char_length(headline) between 1 and 80),
  body         text not null check (char_length(body) between 1 and 1200),
  published_on date not null default current_date,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index player_spotlights_team_idx on public.player_spotlights (team_id, published_on desc);

do $$
declare
  t text;
begin
  foreach t in array array['team_goals', 'player_spotlights'] loop
    perform private.apply_staff_rls(format('public.%I', t)::regclass);
    perform private.apply_head_coach_writes(format('public.%I', t)::regclass);
    execute format('create policy "players read their team''s" on public.%I for select to authenticated
                      using (team_id in (select private.my_current_team_ids()))', t);
  end loop;
end $$;
