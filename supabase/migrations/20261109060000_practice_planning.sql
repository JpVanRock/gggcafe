-- =============================================================================
-- Practice planning (SB Blueprint Phase 7, user 2026-11-08)
--   78 Installation checklist: everything the team must have in place by opening day,
--      by position and by situation, each Not started / Taught / Repped / Game-ready,
--      linked to the practice plans that covered it (install_items, install_item_plans).
--   82 Practice notes that reach players: a plan's objective, rule of the day and
--      announcements, a one-line cue per player (practice_plan_cues) and coach-only
--      notes. Each player sees the practice in TWIS with her own cue
--      (my_practice_notes()); the coach-only notes never reach players.
-- =============================================================================

alter table public.practice_plans
  add column objective     text check (char_length(objective) <= 200),
  add column rule_of_day   text check (char_length(rule_of_day) <= 200),
  add column announcements text check (char_length(announcements) <= 1000),
  add column coach_notes   text check (char_length(coach_notes) <= 1000);

create table public.practice_plan_cues (
  plan_id   uuid not null references public.practice_plans (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  cue       text not null check (char_length(cue) between 1 and 120),
  primary key (plan_id, player_id)
);
alter table public.practice_plan_cues enable row level security;
create policy "staff can read" on public.practice_plan_cues for select to authenticated using ((select private.is_staff()));
create policy "plan editors add" on public.practice_plan_cues for insert to authenticated with check ((select private.can_edit_plan(plan_id)));
create policy "plan editors change" on public.practice_plan_cues for update to authenticated
  using ((select private.can_edit_plan(plan_id))) with check ((select private.can_edit_plan(plan_id)));
create policy "plan editors remove" on public.practice_plan_cues for delete to authenticated using ((select private.can_edit_plan(plan_id)));

create table public.install_items (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  category   text not null check (category in ('position', 'situation')),
  group_name text not null check (char_length(group_name) between 1 and 40),   -- "1B", "Bunt defense"...
  title      text not null check (char_length(title) between 1 and 140),
  status     text not null default 'not_started' check (status in ('not_started', 'taught', 'repped', 'game_ready')),
  iq_track   text check (iq_track in ('defense', 'baserunning', 'offense', 'battery', 'position')),  -- where Softball IQ tests it
  position   smallint not null default 0,
  updated_at timestamptz not null default now()
);
create index install_items_team_idx on public.install_items (team_id, category, position);
select private.apply_staff_rls('public.install_items');

create table public.install_item_plans (
  item_id uuid not null references public.install_items (id) on delete cascade,
  plan_id uuid not null references public.practice_plans (id) on delete cascade,
  primary key (item_id, plan_id)
);
select private.apply_staff_rls('public.install_item_plans');

-- A player's practices in a date range: objective, rule of the day, announcements and
-- her own cue (never the coach-only notes). For her (or staff).
create function private.my_practice_notes(p_player_id uuid, p_from date, p_to date)
returns table (practice_date date, start_time time, team_name text, objective text, rule_of_day text, announcements text, cue text)
language sql stable security definer set search_path = '' as $$
  select p.practice_date, p.start_time, t.name, p.objective, p.rule_of_day, p.announcements, c.cue
    from public.practice_plans p
    join public.teams t on t.id = p.team_id
    left join public.practice_plan_cues c on c.plan_id = p.id and c.player_id = p_player_id
   where ((select private.can_act_for(p_player_id)) or (select private.is_staff()))
     and p.practice_date between p_from and p_to
     and p.team_id in (select r.team_id from public.roster_entries r where r.player_id = p_player_id and r.active)
     and (p.objective is not null or p.rule_of_day is not null or p.announcements is not null or c.cue is not null)
   order by p.practice_date, p.start_time nulls first
$$;
revoke all on function private.my_practice_notes(uuid, date, date) from public;
grant execute on function private.my_practice_notes(uuid, date, date) to authenticated;
create function public.my_practice_notes(p_player_id uuid, p_from date, p_to date)
returns table (practice_date date, start_time time, team_name text, objective text, rule_of_day text, announcements text, cue text)
language sql stable security invoker set search_path = '' as $$ select * from private.my_practice_notes(p_player_id, p_from, p_to) $$;
revoke all on function public.my_practice_notes(uuid, date, date) from public, anon;
grant execute on function public.my_practice_notes(uuid, date, date) to authenticated;
