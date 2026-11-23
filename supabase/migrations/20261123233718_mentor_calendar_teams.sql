-- A mentor picks which teams' schedules are on her calendar (user, 2026-11-23: "Add a function on mentor calendar to
-- check and uncheck team schedules they are mentoring. Default calendar items will only be meeting they add on the
-- calendar. Once check team box then the team's calendar with populate."). By default her calendar (and Coming up on
-- her menu) shows only what she put there: the training she added and her video calls. Each team she mentors (her
-- whole-team links, and her one-on-one players' teams this season) gets a box; a checked team's practices, events and
-- games are added. The choice is kept per mentor (mentor_calendar_teams), so it follows her to any device.
--
-- Not apply_staff_rls: each mentor keeps her own choice; admins read them (the admin's Mentor View shows what she sees).

-- The teams she mentors, for the calendar: as in mentor_calendar() (20261114010911).
create function private.my_mentor_calendar_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select l.team_id from public.mentor_links l
   where l.mentor_id = (select auth.uid()) and l.status = 'approved' and l.player_id is null
  union
  select r.team_id from public.roster_entries r
   where r.player_id in (select private.my_mentee_ids())
     and r.active and r.season_id = private.team_current_season(r.team_id)
$$;
revoke all on function private.my_mentor_calendar_team_ids() from public;
grant execute on function private.my_mentor_calendar_team_ids() to authenticated;

create table public.mentor_calendar_teams (
  mentor_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (mentor_id, team_id)
);
create index mentor_calendar_teams_team_idx on public.mentor_calendar_teams (team_id);
comment on table public.mentor_calendar_teams is
  'The teams whose practices, events and games a mentor checked to show on her calendar (none by default).';

alter table public.mentor_calendar_teams enable row level security;
create policy "mentors read their calendar teams" on public.mentor_calendar_teams for select to authenticated
  using (mentor_id = (select auth.uid()));
create policy "admins read mentors' calendar teams" on public.mentor_calendar_teams for select to authenticated
  using ((select private.is_admin()));
create policy "mentors check a team they mentor" on public.mentor_calendar_teams for insert to authenticated
  with check (mentor_id = (select auth.uid()) and (select private.is_mentor())
              and team_id in (select private.my_mentor_calendar_team_ids()));
create policy "mentors uncheck a team" on public.mentor_calendar_teams for delete to authenticated
  using (mentor_id = (select auth.uid()));
revoke update on public.mentor_calendar_teams from authenticated, anon;

-- The boxes: each team she mentors, whether it's checked, and whether its head coach hid its calendar from mentors
-- (the Switchboard's "See the team calendar").
create function private.my_calendar_teams()
returns table (team_id uuid, team_name text, shown boolean, off boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_mentor()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select t.id, coalesce(nullif(btrim(t.short_name), ''), t.name)::text,
           exists (select 1 from public.mentor_calendar_teams c where c.mentor_id = (select auth.uid()) and c.team_id = t.id),
           exists (select 1 from public.team_features_off f where f.team_id = t.id and f.feature = 'mentor.calendar')
      from public.teams t
     where t.id in (select private.my_mentor_calendar_team_ids())
     order by 2;
end $$;
select private.expose('private.my_calendar_teams()');

-- Her calendar's team schedule: only the teams she checked (as in 20261114010911 otherwise).
create or replace function private.mentor_calendar(p_from date, p_to date)
returns table (
  item text, id uuid, team_id uuid, team_name text, on_date date, start_time time, end_time time,
  kind text, title text, place text, notes text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_mentor()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception 'Ask for at most two months.' using errcode = '22023';
  end if;
  return query
    with teams as (
      select t.id, coalesce(nullif(btrim(t.short_name), ''), t.name)::text as name
        from public.teams t
       where t.id in (select private.my_mentor_calendar_team_ids())
         and t.id in (select c.team_id from public.mentor_calendar_teams c where c.mentor_id = (select auth.uid()))
         and not exists (select 1 from public.team_features_off f where f.team_id = t.id and f.feature = 'mentor.calendar')
    )
    select 'event'::text, e.id, e.team_id, tm.name, e.event_date, e.start_time, e.end_time,
           e.kind::text, e.title::text, e.location::text, e.notes::text
      from public.team_events e
      join teams tm on tm.id = e.team_id
     where e.event_date between p_from and p_to
    union all
    select 'game'::text, g.id, tm.id, tm.name, g.game_date, g.start_time, null::time,
           'game'::text,
           ((case when g.home_team_id = tm.id then 'vs ' else '@ ' end) || coalesce(nullif(btrim(o.short_name), ''), o.name, 'TBD'))::text,
           nullif(concat_ws(' · ', g.event_name, g.venue), '')::text,
           null::text
      from public.games g
      join teams tm on tm.id in (g.home_team_id, g.away_team_id)
      left join public.teams o on o.id = case when g.home_team_id = tm.id then g.away_team_id else g.home_team_id end
     where g.game_date between p_from and p_to;
end $$;
