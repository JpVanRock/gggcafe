-- =============================================================================
-- Game-day production, part 1 (SB Blueprint Phase 9, user 2026-11-08)
--   90 DP/FLEX on the GameDay lineup (dp_player_id bats, flex_player_id plays defense
--      only, the extra line on the card), the umpire exchange card (PDF, no schema),
--      and substitution / re-entry tracking during the game (sub_log).
--   16 Game-day jobs on the lineup (jobs: who keeps the book, coaches the bases...).
--   76 Coaching staff duty matrix (staff_duties) and staff standards (staff_standards:
--      the staff commitment and the pre-practice checklist). Head coaches write; every
--      coach reads.
-- =============================================================================

alter table public.gameday_lineups
  add column dp_player_id   uuid references public.players (id) on delete set null,
  add column flex_player_id uuid references public.players (id) on delete set null,
  add column jobs           jsonb not null default '[]' check (jsonb_typeof(jobs) = 'array' and jsonb_array_length(jobs) <= 12),
  add column sub_log        jsonb not null default '[]' check (jsonb_typeof(sub_log) = 'array' and jsonb_array_length(sub_log) <= 60),
  add constraint gameday_dp_flex_differ check (dp_player_id is null or flex_player_id is null or dp_player_id <> flex_player_id);

-- -----------------------------------------------------------------------------
-- Staff duty matrix and staff standards
-- -----------------------------------------------------------------------------
create table public.staff_duties (
  id       uuid primary key default gen_random_uuid(),
  team_id  uuid not null references public.teams (id) on delete cascade,
  phase    text not null check (phase in ('practice', 'pregame', 'game', 'postgame', 'season')),
  duty     text not null check (char_length(duty) between 1 and 60),
  owner    text check (char_length(owner) <= 60),
  position smallint not null default 0
);
create index staff_duties_team_idx on public.staff_duties (team_id, phase, position);
select private.apply_staff_rls('public.staff_duties');
select private.apply_head_coach_writes('public.staff_duties');

create table public.staff_standards (
  team_id      uuid primary key references public.teams (id) on delete cascade,
  commitment   text[] not null default '{}' check (cardinality(commitment) <= 12),
  pre_practice text[] not null default '{}' check (cardinality(pre_practice) <= 15),
  updated_at   timestamptz not null default now()
);
select private.apply_staff_rls('public.staff_standards');
select private.apply_head_coach_writes('public.staff_standards');
