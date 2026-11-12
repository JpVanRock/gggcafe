-- =============================================================================
-- GGG.Cafe — Parents "View as player": see what their daughter sees, read only
-- (user, 2026-11-12)
--
-- An approved parent opens her daughter's player pages (/players/[id]) and sees what she
-- sees. Read only: parents get SELECT, never a write.
--   * private.my_child_ids()      her approved daughters on a team's current roster (like
--                                  my_player_ids() for the player herself)
--   * private.my_child_team_ids()  those daughters' current teams (like my_current_team_ids())
--   * private.has_child_access()   she has such a daughter (like has_player_access())
--   * Every SELECT rule a player reads by (my_player_ids, my_current_team_ids,
--     has_player_access) gets a read-only twin for parents, "... (parent view)", made here by
--     a loop over pg_policies. Every table a player reads is one her coaches read too, so a
--     parent sees what coaches see about her, nothing private to the player alone.
--     tests/db/zz_parent_view.test.sql fails if a later player rule has no parent twin.
--   * The read functions player pages call get a parent branch; functions that record
--     answers or progress stay the player's alone.
-- =============================================================================

create function private.my_child_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select r.player_id
    from public.parent_links l
    join public.roster_entries r on r.player_id = l.player_id and r.team_id = l.team_id
   where l.parent_id = (select auth.uid())
     and l.status = 'approved'
     and r.active
     and r.season_id = private.team_current_season(r.team_id)
$$;
create function private.my_child_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select r.team_id
    from public.parent_links l
    join public.roster_entries r on r.player_id = l.player_id and r.team_id = l.team_id
   where l.parent_id = (select auth.uid())
     and l.status = 'approved'
     and r.active
     and r.season_id = private.team_current_season(r.team_id)
$$;
create function private.has_child_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.my_child_ids())
$$;
revoke all on function private.my_child_ids(), private.my_child_team_ids(), private.has_child_access() from public;
grant execute on function private.my_child_ids(), private.my_child_team_ids(), private.has_child_access() to authenticated;
-- the app asks which daughters a parent may view (requirePlayerPage)
select private.expose('private.my_child_ids()');

-- -----------------------------------------------------------------------------
-- Read-only twins of the player's SELECT rules
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  v_using text;
begin
  for r in
    select schemaname, tablename, policyname, qual
      from pg_policies
     where cmd in ('SELECT', 'ALL') and qual is not null
       and (qual like '%my_player_ids()%' or qual like '%my_current_team_ids()%' or qual like '%has_player_access()%')
       and policyname not like '%(parent view)'
  loop
    v_using := replace(replace(replace(r.qual,
                 'my_player_ids()', 'my_child_ids()'),
                 'my_current_team_ids()', 'my_child_team_ids()'),
                 'has_player_access()', 'has_child_access()');
    execute format('create policy %I on %I.%I for select to authenticated using (%s)',
                   left(r.policyname, 48) || ' (parent view)', r.schemaname, r.tablename, v_using);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Read functions the player pages call: her approved parent may read too
-- -----------------------------------------------------------------------------

-- teams she can see: her teams and their opponents (the teams table's read rule)
create or replace function private.my_visible_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select r.team_id from public.roster_entries r where r.player_id in (select private.my_player_ids())
  union
  select case when g.home_team_id in (select private.my_current_team_ids()) then g.away_team_id else g.home_team_id end
    from public.games g
   where g.home_team_id in (select private.my_current_team_ids()) or g.away_team_id in (select private.my_current_team_ids())
  union
  select r.team_id from public.roster_entries r where r.player_id in (select private.my_child_ids())
  union
  select case when g.home_team_id in (select private.my_child_team_ids()) then g.away_team_id else g.home_team_id end
    from public.games g
   where g.home_team_id in (select private.my_child_team_ids()) or g.away_team_id in (select private.my_child_team_ids())
$$;

create or replace function private.iq_answer_key(p_player_id uuid)
returns table (question_id uuid, correct_index smallint, explanation text)
language sql stable security definer set search_path = '' as $$
  select q.id, q.correct_index, q.explanation
    from public.iq_questions q
   where (select private.is_staff())
      or ((p_player_id in (select private.my_player_ids()) or p_player_id in (select private.my_child_ids()))
          and exists (select 1 from public.iq_answers a where a.player_id = p_player_id and a.question_id = q.id))
$$;

create or replace function private.my_practice_notes(p_player_id uuid, p_from date, p_to date)
returns table (practice_date date, start_time time, team_name text, objective text, rule_of_day text, announcements text, cue text)
language sql stable security definer set search_path = '' as $$
  select p.practice_date, p.start_time, t.name, p.objective, p.rule_of_day, p.announcements, c.cue
    from public.practice_plans p
    join public.teams t on t.id = p.team_id
    left join public.practice_plan_cues c on c.plan_id = p.id and c.player_id = p_player_id
   where ((select private.can_act_for(p_player_id)) or (select private.is_staff()) or p_player_id in (select private.my_child_ids()))
     and p.practice_date between p_from and p_to
     and p.team_id in (select r.team_id from public.roster_entries r where r.player_id = p_player_id and r.active)
     and (p.objective is not null or p.rule_of_day is not null or p.announcements is not null or c.cue is not null)
   order by p.practice_date, p.start_time nulls first
$$;

create or replace function private.team_bp_leaders(p_team_id uuid)
returns table (player_id uuid, first_name text, last_name text, jersey_number text, swings integer, production numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_off  public.team_offseason;
  v_from date;
  v_to   date := private.team_today();
begin
  if not ((select private.is_staff()) or p_team_id in (select private.my_current_team_ids())
          or p_team_id in (select private.my_child_team_ids())) then
    raise exception 'You can only see your own team''s leaderboard.' using errcode = '42501';
  end if;
  select * into v_off from public.team_offseason where team_id = p_team_id;
  v_from := coalesce(v_off.starts_on, v_to - 60);
  if v_off.ends_on is not null and v_off.ends_on < v_to then
    v_to := v_off.ends_on;
  end if;
  return query
    select r.player_id, coalesce(p.preferred_name, p.first_name), p.last_name, r.jersey_number,
           sum(cardinality(b.grades))::int,
           round(sum((select sum(g) from unnest(b.grades) g))::numeric / sum(cardinality(b.grades)), 2)
      from private.team_roster(p_team_id) r
      join public.players p on p.id = r.player_id
      join public.bp_rounds b on b.player_id = r.player_id and b.round_date between v_from and v_to
     group by r.player_id, p.preferred_name, p.first_name, p.last_name, r.jersey_number
    having sum(cardinality(b.grades)) >= 20
     order by 6 desc, 5 desc
     limit 5;
end $$;

create or replace function private.team_squads(p_team_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ((select private.is_staff()) or p_team_id in (select private.my_current_team_ids())
          or p_team_id in (select private.my_child_team_ids())) then
    raise exception 'You can only see your own team''s squads.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', s.id, 'name', s.name, 'captain_id', s.captain_id, 'pick_order', s.pick_order,
             'members', (select coalesce(jsonb_agg(m.player_id order by m.pick_no, m.picked_at), '[]'::jsonb)
                           from public.offseason_squad_members m where m.squad_id = s.id)
           ) order by s.pick_order), '[]'::jsonb)
      from public.offseason_squads s
     where s.team_id = p_team_id
  );
end $$;

create or replace function private.team_leaderboard(p_team_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_off   public.team_offseason;
  v_today date := private.team_today();
  v_to    date;
  v_week  date := private.team_today() - (extract(isodow from private.team_today())::integer - 1);
begin
  if not ((select private.is_staff()) or p_team_id in (select private.my_current_team_ids())
          or p_team_id in (select private.my_child_team_ids())) then
    raise exception 'You can only see your own team''s leaderboard.' using errcode = '42501';
  end if;
  select * into v_off from public.team_offseason where team_id = p_team_id;
  if not found then
    return jsonb_build_object('offseason', null, 'today', v_today);
  end if;
  perform private.decide_players_of_week(p_team_id);
  v_to := least(coalesce(v_off.ends_on, v_today), v_today);
  return jsonb_build_object(
    'offseason', jsonb_build_object('starts_on', v_off.starts_on, 'ends_on', v_off.ends_on),
    'today', v_today,
    'week_start', v_week,
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'player_id', r.player_id, 'jersey_number', r.jersey_number,
               'first_name', coalesce(p.preferred_name, p.first_name), 'last_name', p.last_name,
               'training', t.training, 'workouts', t.workouts, 'lessons', t.lessons, 'unlocks', t.unlocks, 'points', t.points,
               'week_points', w.points,
               'times_named', (select count(*) from public.team_player_of_week x where x.team_id = p_team_id and x.player_id = r.player_id),
               'last_named', (select max(x.week_start) from public.team_player_of_week x where x.team_id = p_team_id and x.player_id = r.player_id)
             )), '[]'::jsonb)
        from private.team_roster(p_team_id) r
        join public.players p on p.id = r.player_id
        cross join lateral private.offseason_tally(r.player_id, v_off.starts_on, v_to) t
        cross join lateral private.offseason_tally(r.player_id, greatest(v_week, v_off.starts_on),
                                                   least(v_today, coalesce(v_off.ends_on, v_today))) w
    ),
    'weeks', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'week_start', x.week_start, 'player_id', x.player_id, 'points', x.points, 'round', x.round,
               'first_name', coalesce(p.preferred_name, p.first_name), 'last_name', p.last_name
             ) order by x.week_start desc), '[]'::jsonb)
        from public.team_player_of_week x
        left join public.players p on p.id = x.player_id
       where x.team_id = p_team_id
    )
  );
end $$;

create or replace function private.team_quizzes_for(p_player_id uuid)
returns table (id uuid, title text, team_name text, published_at timestamptz, total integer, answered integer, first_try integer, to_fix integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.can_act_for(p_player_id)) and not (select private.is_staff())
     and not (p_player_id in (select private.my_child_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select q.id, q.title, t.name, q.published_at,
           count(qq.id)::int,
           count(a.player_id)::int,
           count(a.player_id) filter (where a.first_correct)::int,
           count(a.player_id) filter (where not a.is_correct)::int
      from public.team_quizzes q
      join public.teams t on t.id = q.team_id
      left join public.team_quiz_questions qq on qq.quiz_id = q.id
      left join public.team_quiz_answers a on a.question_id = qq.id and a.player_id = p_player_id
     where q.published_at is not null
       and q.team_id in (select r.team_id from public.roster_entries r where r.player_id = p_player_id and r.active)
     group by q.id, q.title, t.name, q.published_at
     order by q.published_at desc;
end $$;

create or replace function private.team_quiz_for(p_player_id uuid, p_quiz_id uuid)
returns table (id uuid, sort smallint, question text, choices text[], chosen_index smallint, is_correct boolean, first_correct boolean, correct_index smallint, explanation text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ((select private.can_act_for(p_player_id)) or p_player_id in (select private.my_child_ids()))
     or not private.quiz_open_to(p_player_id, p_quiz_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select q.id, q.position, q.question, q.choices, a.chosen_index, a.is_correct, a.first_correct,
           case when a.player_id is not null then q.correct_index end,
           case when a.player_id is not null then q.explanation end
      from public.team_quiz_questions q
      left join public.team_quiz_answers a on a.question_id = q.id and a.player_id = p_player_id
     where q.quiz_id = p_quiz_id
     order by q.position, q.id;
end $$;
