-- =============================================================================
-- Offseason training (SB Blueprint Phase 2, user 2026-11-08)
--   84 Season roadmap: dated training phases per team (training_phases) and team
--      routines coaches push to every player on the current roster (team_routines,
--      copied into player_activities with source 'coach' and kept in step, also
--      when the roster changes). Players see the phase and week in TWIS; they can
--      check coach routines off but not change or remove them.
--   85 Athletic testing: ten tests saved as measurements (metrics below), rated 1-5
--      against bands per age group (starter bands in src/lib/training-plan.ts;
--      coaches' edits in test_bands).
--   86 Conditioning & ACL-prevention library: starter drills with a focus tag.
--   34 Offseason draft: squads with a captain, drafted by the head coach; squad
--      totals come from the Leaderboard's points (team_squads()).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 85 The testing pack: metrics (home to first and vertical jump already exist)
-- -----------------------------------------------------------------------------
insert into public.metrics (key, name, unit, better, area, description) values
  ('pro_agility',    'Pro agility (5-10-5)',        'sec',  'lower',  'strength_conditioning', 'Start on the middle line: 5 yards one way, 10 back, 5 through the start. Best of 2.'),
  ('sprint_20yd',    '20-yard sprint',              'sec',  'lower',  'baserunning',           'From a standing start. Best of 2.'),
  ('broad_jump',     'Broad jump',                  'in',   'higher', 'strength_conditioning', 'Two feet to two feet, and stick the landing. Best of 3.'),
  ('med_ball_throw', 'Rotational med-ball throw',   'ft',   'higher', 'strength_conditioning', 'Side-on, like a swing. 4 lb for 12U and under, 6 lb for 13U and up. Best of 3.'),
  ('push_ups',       'Push-ups (1 minute)',         'reps', 'higher', 'strength_conditioning', 'Chest to a fist-height target, full lockout. As many as she can in 60 seconds.'),
  ('plank',          'Plank hold',                  'sec',  'higher', 'strength_conditioning', 'Forearm plank with a straight line from head to heels; time stops when the hips drop.'),
  ('single_leg_hop', 'Single-leg hop (weaker leg)', 'in',   'higher', 'strength_conditioning', 'Hop forward and stick on the same leg. Test both legs; record the weaker one.'),
  ('shuttle_300',    '300-yard shuttle',            'sec',  'lower',  'strength_conditioning', '25 yards and back, six times (12 legs), all out.')
on conflict (key) do nothing;

-- Rating bands per test and age group: four cutoffs between the five ratings, in the
-- direction of better (ascending when higher is better, descending when lower is).
-- Rows exist only where coaches changed the starter bands.
create table public.test_bands (
  metric_key text not null references public.metrics (key) on update cascade on delete cascade,
  age_group  text not null check (age_group ~ '^[0-9]{1,2}U$'),
  cutoffs    numeric(8,3)[] not null check (cardinality(cutoffs) = 4),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (metric_key, age_group)
);
select private.apply_staff_rls('public.test_bands');
-- Not personal data: players see the bands their ratings come from.
create policy "signed-in users read the bands" on public.test_bands for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- 84 The roadmap: phases
-- -----------------------------------------------------------------------------
create table public.training_phases (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  kind       text not null check (kind in ('testing', 'build', 'sport', 'preseason', 'inseason', 'recovery')),
  name       text not null check (char_length(name) between 1 and 60),
  starts_on  date not null,
  ends_on    date not null,
  focus      text check (char_length(focus) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index training_phases_team_idx on public.training_phases (team_id, starts_on);
select private.apply_staff_rls('public.training_phases');
create policy "player reads her team's phases" on public.training_phases for select to authenticated
  using (team_id in (select private.my_current_team_ids()));

-- -----------------------------------------------------------------------------
-- 84 Team routines, copied to every player on the current roster
-- -----------------------------------------------------------------------------
create table public.team_routines (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  phase_id   uuid references public.training_phases (id) on delete set null,
  title      text not null check (char_length(title) between 1 and 120),
  details    text check (char_length(details) <= 500),   -- how much: sets, reps, time
  category   public.training_category not null,
  drill_id   uuid references public.drills (id) on delete set null,
  days       smallint[] not null default '{}' check (days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  starts_on  date not null,
  ends_on    date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create index team_routines_team_idx on public.team_routines (team_id);
select private.apply_staff_rls('public.team_routines');

alter table public.player_activities
  add column team_routine_id uuid references public.team_routines (id) on delete set null;
create index player_activities_team_routine_idx on public.player_activities (team_routine_id) where team_routine_id is not null;
alter table public.player_activities drop constraint player_activities_source_check;
alter table public.player_activities
  add constraint player_activities_source_check check (source is null or source in ('leadership-checkin', 'mentor', 'coach'));

-- Coach routines stay as the coach set them: a player checks them off in TWIS but
-- can't add, change or remove them (restrictive: on top of "player manages her own").
create policy "only coaches add coach routines" on public.player_activities as restrictive for insert to authenticated
  with check (source is distinct from 'coach' or (select private.can_edit()));
create policy "only coaches change coach routines" on public.player_activities as restrictive for update to authenticated
  using (source is distinct from 'coach' or (select private.can_edit()))
  with check (source is distinct from 'coach' or (select private.can_edit()));
create policy "only coaches remove coach routines" on public.player_activities as restrictive for delete to authenticated
  using (source is distinct from 'coach' or (select private.can_edit()));

-- Keep one team routine's copies in step: add it for players on the current roster,
-- update their copies, and end the copies of players who left. Returns copies added.
create function private.sync_team_routine(p_routine_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r       public.team_routines;
  v_today date := private.team_today();
  v_added integer;
begin
  select * into r from public.team_routines where id = p_routine_id;
  if not found then
    return 0;
  end if;
  insert into public.player_activities (player_id, title, details, days, starts_on, ends_on, category, drill_id, source, team_routine_id, created_by)
  select tr.player_id, r.title, r.details, r.days, r.starts_on, r.ends_on, r.category, r.drill_id, 'coach', r.id, r.created_by
    from private.team_roster(r.team_id) tr
   where not exists (select 1 from public.player_activities a where a.team_routine_id = r.id and a.player_id = tr.player_id);
  get diagnostics v_added = row_count;
  update public.player_activities a
     set title = r.title, details = r.details, days = r.days, starts_on = r.starts_on, ends_on = r.ends_on,
         category = r.category, drill_id = r.drill_id
   where a.team_routine_id = r.id and a.player_id in (select tr.player_id from private.team_roster(r.team_id) tr);
  update public.player_activities a
     set ends_on = greatest(a.starts_on, least(coalesce(a.ends_on, v_today), v_today))
   where a.team_routine_id = r.id
     and a.player_id not in (select tr.player_id from private.team_roster(r.team_id) tr)
     and (a.ends_on is null or a.ends_on > v_today);
  return v_added;
end;
$$;
revoke all on function private.sync_team_routine(uuid) from public;

-- For the app: coaches (and assistants) sync after saving a team routine.
create function private.sync_team_routine_checked(p_routine_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.can_edit()) then
    raise exception 'only coaches push team routines' using errcode = '42501';
  end if;
  return private.sync_team_routine(p_routine_id);
end;
$$;
revoke all on function private.sync_team_routine_checked(uuid) from public;
grant execute on function private.sync_team_routine_checked(uuid) to authenticated;
create function public.sync_team_routine(p_routine_id uuid) returns integer
language sql security invoker set search_path = '' as $$ select private.sync_team_routine_checked(p_routine_id) $$;
revoke all on function public.sync_team_routine(uuid) from public, anon;
grant execute on function public.sync_team_routine(uuid) to authenticated;

-- A roster change brings the team's current routines along (new players get them,
-- players who leave have theirs ended).
create function private.sync_team_routines_on_roster() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.team_routines
     where team_id = coalesce(new.team_id, old.team_id) and (ends_on is null or ends_on >= private.team_today())
  loop
    perform private.sync_team_routine(v_id);
  end loop;
  return null;
end;
$$;
create trigger sync_team_routines after insert or update of active, season_id or delete on public.roster_entries
  for each row execute function private.sync_team_routines_on_roster();

-- -----------------------------------------------------------------------------
-- 86 The conditioning & ACL-prevention starter library
-- -----------------------------------------------------------------------------
alter table public.drills
  add column focus text check (focus in ('speed', 'agility', 'core', 'power', 'med-ball', 'landing'));

insert into public.drills (name, area, category, focus, description, equipment) values
  ('Falling Starts', 'strength_conditioning', 'workout', 'speed',
   'Stand tall and lean forward until you have to step, then sprint 10 yards. Drive your arms and push the ground back. 6 reps, walk back to recover.', 'Cones'),
  ('Wall Drives', 'strength_conditioning', 'workout', 'speed',
   'Hands on a wall, body at a 45-degree lean. Drive one knee up and switch legs fast on each call: 1, 2, then 3 switches. 3 sets of 5 calls. Teaches the angle of a fast first step.', null),
  ('Base-Path Sprints', 'strength_conditioning', 'workout', 'speed',
   'Home to first, running through the bag; then first to third with a good turn at second. Full speed with full rest (60-90 seconds). 6-8 sprints.', 'Bases'),
  ('Pro Agility Shuttle Reps', 'strength_conditioning', 'workout', 'agility',
   '5-10-5: start on the middle line, sprint 5 yards and touch the line, 10 back, then 5 through the start. Stay low on the turns and plant with your outside foot. 4-6 reps each way.', 'Cones'),
  ('Lateral Shuffle to Sprint', 'strength_conditioning', 'workout', 'agility',
   'Shuffle 5 yards without crossing your feet, then open your hips and sprint 10 yards on the call. Stay low. 3 sets of 4.', 'Cones'),
  ('Ladder: In-In-Out-Out', 'strength_conditioning', 'workout', 'agility',
   'Quick feet through an agility ladder: both feet in, both feet out, moving forward. Arms working, eyes up. 4 trips forward, then 4 sideways.', 'Agility ladder'),
  ('Dead Bug', 'strength_conditioning', 'workout', 'core',
   'On your back with arms up and knees bent at 90 degrees. Slowly lower the opposite arm and leg while pressing your lower back into the floor. 3 sets of 8 each side.', null),
  ('Side Plank with Reach', 'strength_conditioning', 'workout', 'core',
   'Side plank on your forearm with your hips high. Reach your top arm under your body and back up. 3 sets of 8 each side.', null),
  ('Bird Dog', 'strength_conditioning', 'workout', 'core',
   'On hands and knees, reach the opposite arm and leg long, hold for 2 seconds and switch. Keep your hips level. 3 sets of 10 each side.', null),
  ('Broad Jump and Stick', 'strength_conditioning', 'workout', 'power',
   'Swing your arms and jump as far as you can, then land on both feet and hold for 2 seconds: knees over your toes, hips back, chest up. 3 sets of 5.', null),
  ('Pogo Hops', 'strength_conditioning', 'workout', 'power',
   'Quick, springy hops in place on the balls of your feet with stiff ankles. 3 sets of 20 seconds. Builds the bounce behind a fast first step.', null),
  ('Lateral Bound and Stick', 'strength_conditioning', 'workout', 'landing',
   'Bound sideways off one leg, land on the other and hold for 2 seconds without your knee caving in. 3 sets of 5 each side.', null),
  ('Rotational Med-Ball Throw', 'strength_conditioning', 'workout', 'med-ball',
   'Stand side-on to a wall, load your back hip, then rotate and throw the ball into the wall like a swing. 4 lb for 12U and under, 6 lb for older players. 3 sets of 6 each side.', 'Med ball, wall'),
  ('Med-Ball Slam', 'strength_conditioning', 'workout', 'med-ball',
   'Reach the ball overhead and slam it into the ground in front of you with your core, then catch it on the bounce. 3 sets of 8.', 'Slam ball'),
  ('Med-Ball Chest Pass', 'strength_conditioning', 'workout', 'med-ball',
   'From an athletic stance, explode the ball off your chest into a wall or to a partner. 3 sets of 8.', 'Med ball'),
  ('Landing Warm-Up (ACL prevention)', 'strength_conditioning', 'workout', 'landing',
   'About 10 minutes before practice: walking lunges, squats with your knees tracking over your toes, single-leg balance (30 seconds each leg), drop-and-stick landings from a low step, lateral hop and stick, then slow partner hamstring lowers. Land soft and quiet, and never let your knees cave in.', 'Low step'),
  ('Single-Leg Balance Reach', 'strength_conditioning', 'workout', 'landing',
   'Stand on one leg with a soft knee and reach your other foot forward, to the side and back without touching down. 3 rounds each leg. Builds the control that protects your knees.', null)
on conflict (name) do update set focus = coalesce(public.drills.focus, excluded.focus);

-- -----------------------------------------------------------------------------
-- 34 The offseason draft: squads (head coach), totals from Leaderboard points
-- -----------------------------------------------------------------------------
create table public.offseason_squads (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  captain_id uuid not null references public.players (id) on delete cascade,
  pick_order smallint not null check (pick_order between 1 and 8),
  created_at timestamptz not null default now(),
  unique (team_id, pick_order),
  unique (id, team_id)
);
create table public.offseason_squad_members (
  team_id   uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  squad_id  uuid not null,
  pick_no   smallint not null default 0 check (pick_no >= 0),   -- 0 = the captain
  picked_at timestamptz not null default now(),
  primary key (team_id, player_id),
  foreign key (squad_id, team_id) references public.offseason_squads (id, team_id) on delete cascade
);
select private.apply_staff_rls('public.offseason_squads');
select private.apply_staff_rls('public.offseason_squad_members');
select private.apply_head_coach_writes('public.offseason_squads');
select private.apply_head_coach_writes('public.offseason_squad_members');

-- Squads with their members, for staff and players on the team (players can't read
-- the tables; names and points come from team_leaderboard()).
create function private.team_squads(p_team_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ((select private.is_staff()) or p_team_id in (select private.my_current_team_ids())) then
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
end;
$$;
revoke all on function private.team_squads(uuid) from public;
grant execute on function private.team_squads(uuid) to authenticated;
create function public.team_squads(p_team_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.team_squads(p_team_id) $$;
revoke all on function public.team_squads(uuid) from public, anon;
grant execute on function public.team_squads(uuid) to authenticated;
