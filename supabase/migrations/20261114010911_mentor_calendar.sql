-- The mentor's calendar (user, 2026-11-13): her players' team practices, events and games beside her own
-- training and video calls. Mentors still can't read team_events, games or other teams' records: this
-- function hands a mentor only the calendar rows for her players' current teams (the teams she mentors
-- as a whole, and the teams her one-on-one players are on this season), with the opponent's name for
-- each game. A head coach hides the team calendar from mentors with the Switchboard's "mentor.calendar".
-- Columns are cast to their declared types: a plpgsql "return query" must match them exactly.
create function private.mentor_calendar(p_from date, p_to date)
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
    with mine as (
      select l.team_id from public.mentor_links l
       where l.mentor_id = (select auth.uid()) and l.status = 'approved' and l.player_id is null
      union
      select r.team_id from public.roster_entries r
       where r.player_id in (select private.my_mentee_ids())
         and r.active and r.season_id = private.team_current_season(r.team_id)
    ),
    teams as (
      select t.id, coalesce(nullif(btrim(t.short_name), ''), t.name)::text as name
        from public.teams t
       where t.id in (select m.team_id from mine m)
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

select private.expose('private.mentor_calendar(date, date)');
