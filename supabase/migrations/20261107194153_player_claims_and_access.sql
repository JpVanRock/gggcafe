-- =============================================================================
-- GGG.Cafe — Player accounts: claims and self-access
--
-- Coaches build each season's roster (Player intake). A player signs up, picks
-- her team, reads the coach's welcome message and claims her spot by name and
-- jersey number. A coach approves the claim. Claims are per team AND season:
-- when a team starts a new season (its latest season with a roster), last
-- season's claim stops giving access until she claims her new spot. Her player
-- profile (one players row) keeps all history across seasons and teams.
--
-- With an approved claim on her current spot, a player can (user's choice:
-- "full edit") read her own dashboard and change her goals, Mental GP, training
-- routines and TWIS check-offs, and take Softball IQ tests. She can't see other
-- players, coach notes, or anything in the Coaches Dugout. IQ grading and awards
-- run inside security-definer functions so answers and awards can't be faked,
-- and answer keys are not readable before she has answered.
--
-- Also: team welcome messages, and video links for practice drills.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Small additions
-- -----------------------------------------------------------------------------
alter table public.teams
  add column welcome_message text check (char_length(welcome_message) <= 1000);

alter table public.practice_drills
  add column video_url text check (video_url is null or video_url ~ '^https://\S+$');
alter table public.practice_plan_drills
  add column video_url text check (video_url is null or video_url ~ '^https://\S+$');

-- save_practice_plan now keeps each drill's video link too.
create or replace function public.save_practice_plan(p_plan_id uuid, p_plan jsonb) returns timestamptz
language plpgsql security invoker set search_path = '' as $$
declare
  v_status  public.practice_plan_status;
  v_item    jsonb;
  v_pos     smallint := 0;
  v_updated timestamptz;
begin
  if not (select private.can_edit()) then
    raise exception 'only coaches and admins can change practice plans' using errcode = '42501';
  end if;

  select status into v_status from public.practice_plans where id = p_plan_id for update;
  if not found then
    raise exception 'practice plan not found' using errcode = 'P0002';
  end if;
  if v_status = 'final' then
    raise exception 'this plan is final; reopen it to edit' using errcode = 'P0004';
  end if;

  update public.practice_plans
     set practice_date = (p_plan ->> 'practice_date')::date,
         start_time    = nullif(p_plan ->> 'start_time', '')::time,
         setting       = (p_plan ->> 'setting')::public.practice_setting,
         total_minutes = (p_plan ->> 'total_minutes')::smallint,
         location      = nullif(trim(p_plan ->> 'location'), ''),
         focus         = nullif(trim(p_plan ->> 'focus'), '')
   where id = p_plan_id
  returning updated_at into v_updated;

  delete from public.practice_plan_drills where plan_id = p_plan_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_plan -> 'drills', '[]'::jsonb)) loop
    continue when coalesce(trim(v_item ->> 'name'), '') = '';
    v_pos := v_pos + 1;
    insert into public.practice_plan_drills
      (plan_id, position, drill_id, name, description, tags, minutes, coaches, equipment, video_url)
    values (
      p_plan_id,
      v_pos,
      (select d.id from public.practice_drills d where d.id = nullif(v_item ->> 'drill_id', '')::uuid),
      trim(v_item ->> 'name'),
      nullif(trim(v_item ->> 'description'), ''),
      coalesce((select array_agg(t::public.drill_tag)
                  from jsonb_array_elements_text(coalesce(v_item -> 'tags', '[]'::jsonb)) t), '{}'),
      nullif(v_item ->> 'minutes', '')::smallint,
      coalesce((select array_agg(trim(c))
                  from jsonb_array_elements_text(coalesce(v_item -> 'coaches', '[]'::jsonb)) c
                 where trim(c) <> ''), '{}'),
      nullif(trim(v_item ->> 'equipment'), ''),
      case when coalesce(v_item ->> 'video_url', '') ~ '^https://\S+$' then v_item ->> 'video_url' end
    );
  end loop;

  delete from public.practice_plan_positions where plan_id = p_plan_id;
  insert into public.practice_plan_positions (plan_id, position, player_id, sort)
  select p_plan_id, (x ->> 'position')::public.field_position, (x ->> 'player_id')::uuid, i::smallint
    from jsonb_array_elements(coalesce(p_plan -> 'positions', '[]'::jsonb)) with ordinality as t(x, i)
   where exists (select 1 from public.players p where p.id = (x ->> 'player_id')::uuid)
  on conflict do nothing;

  return v_updated;
end;
$$;

-- -----------------------------------------------------------------------------
-- Player claims
-- -----------------------------------------------------------------------------
create type public.player_claim_status as enum ('pending', 'approved', 'declined');

create table public.player_claims (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  team_id         uuid not null references public.teams (id) on delete cascade,
  season_id       uuid not null references public.seasons (id) on delete cascade,
  roster_entry_id uuid references public.roster_entries (id) on delete cascade,  -- her spot (matched or set by the coach)
  typed_name      text not null check (char_length(typed_name) between 1 and 80),
  typed_jersey    text check (typed_jersey ~ '^\d{1,2}$'),
  status          public.player_claim_status not null default 'pending',
  requested_at    timestamptz not null default now(),
  decided_by      uuid references auth.users (id) on delete set null,
  decided_at      timestamptz,
  check (status <> 'approved' or roster_entry_id is not null),
  unique (user_id, team_id, season_id)
);
create index player_claims_team_idx on public.player_claims (team_id, status);
create index player_claims_entry_idx on public.player_claims (roster_entry_id);

alter table public.player_claims enable row level security;
-- Claims are made through request_player_claim(); coaches approve or decline.
create policy "players see their claims, staff see all" on public.player_claims for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy "coaches decide claims" on public.player_claims for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "players withdraw, coaches remove" on public.player_claims for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.can_edit()));

-- -----------------------------------------------------------------------------
-- Access helpers (security definer, private schema)
-- -----------------------------------------------------------------------------
-- A team's current season: the latest season (by start date) with a roster.
create function private.team_current_season(p_team_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select r.season_id
    from public.roster_entries r
    join public.seasons s on s.id = r.season_id
   where r.team_id = p_team_id
   order by s.start_date desc nulls last, s.created_at desc
   limit 1
$$;

-- Players the signed-in user has claimed for her team's current season.
create function private.my_player_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select r.player_id
    from public.player_claims c
    join public.roster_entries r on r.id = c.roster_entry_id
   where c.user_id = (select auth.uid())
     and c.status = 'approved'
     and r.active
     and r.season_id = private.team_current_season(r.team_id)
$$;

-- Teams of her current claims (schedule, standards).
create function private.my_current_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select r.team_id
    from public.player_claims c
    join public.roster_entries r on r.id = c.roster_entry_id
   where c.user_id = (select auth.uid())
     and c.status = 'approved'
     and r.active
     and r.season_id = private.team_current_season(r.team_id)
$$;

-- Teams whose names she may see: every team in her history, plus opponents
-- on her current teams' schedules.
create function private.my_visible_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select r.team_id from public.roster_entries r where r.player_id in (select private.my_player_ids())
  union
  select case when g.home_team_id in (select private.my_current_team_ids()) then g.away_team_id else g.home_team_id end
    from public.games g
   where g.home_team_id in (select private.my_current_team_ids()) or g.away_team_id in (select private.my_current_team_ids())
$$;

create function private.has_player_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.my_player_ids())
$$;

-- Staff who can edit, or the player herself.
create function private.can_act_for(p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.can_edit()) or p_player_id in (select private.my_player_ids())
$$;

revoke all on function private.team_current_season(uuid), private.my_player_ids(), private.my_current_team_ids(),
  private.my_visible_team_ids(), private.has_player_access(), private.can_act_for(uuid) from public;
grant execute on function private.team_current_season(uuid), private.my_player_ids(), private.my_current_team_ids(),
  private.my_visible_team_ids(), private.has_player_access(), private.can_act_for(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Claim functions (public wrappers call the private definers)
-- -----------------------------------------------------------------------------
-- Our teams with a roster, for the sign-up page (name and age group only).
-- Called before sign-in, so it lives in public (signed-out visitors can't use
-- the private schema) and returns nothing but these two fields.
create function public.signup_teams() returns table (id uuid, name text, age_group text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name, t.age_group from public.teams t
   where t.is_own_team and private.team_current_season(t.id) is not null
   order by t.name
$$;
revoke all on function public.signup_teams() from public;
grant execute on function public.signup_teams() to anon, authenticated;

-- The team's welcome message and current season, for a signed-in player claiming her spot.
create function private.team_welcome(p_team_id uuid) returns table (team_name text, season_name text, welcome_message text)
language sql stable security definer set search_path = '' as $$
  select t.name, s.name, t.welcome_message
    from public.teams t
    left join public.seasons s on s.id = private.team_current_season(t.id)
   where t.id = p_team_id and t.is_own_team and (select auth.uid()) is not null
$$;
revoke all on function private.team_welcome(uuid) from public;
grant execute on function private.team_welcome(uuid) to authenticated;
create function public.team_welcome(p_team_id uuid) returns table (team_name text, season_name text, welcome_message text)
language sql stable security invoker set search_path = '' as $$ select * from private.team_welcome(p_team_id) $$;
revoke all on function public.team_welcome(uuid) from public, anon;
grant execute on function public.team_welcome(uuid) to authenticated;

-- A player claims her spot on a team's current-season roster by name and
-- jersey number. Matches when the number and first (or preferred) and last
-- name agree; otherwise the coach matches it by hand. Returns whether it matched.
create function private.request_player_claim(p_team_id uuid, p_name text, p_jersey text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_season uuid;
  v_entry  uuid;
  v_name   text := regexp_replace(lower(coalesce(p_name, '')), '[^a-z]', '', 'g');
  v_jersey text := nullif(regexp_replace(coalesce(p_jersey, ''), '\D', '', 'g'), '');
begin
  if (select auth.uid()) is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' or char_length(trim(p_name)) > 80 then
    raise exception 'enter your first and last name' using errcode = '22023';
  end if;
  if v_jersey is not null and v_jersey !~ '^\d{1,2}$' then
    raise exception 'jersey numbers are 0-99' using errcode = '22023';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id and is_own_team) then
    raise exception 'unknown team' using errcode = 'P0006';
  end if;
  v_season := private.team_current_season(p_team_id);
  if v_season is null then
    raise exception 'this team has no roster yet' using errcode = 'P0007';
  end if;

  select r.id into v_entry
    from public.roster_entries r
    join public.players p on p.id = r.player_id
   where r.team_id = p_team_id and r.season_id = v_season and r.active
     and r.jersey_number = v_jersey
     and v_name in (regexp_replace(lower(p.first_name || p.last_name), '[^a-z]', '', 'g'),
                    regexp_replace(lower(coalesce(p.preferred_name, '') || p.last_name), '[^a-z]', '', 'g'))
   limit 1;

  insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey)
  values ((select auth.uid()), p_team_id, v_season, v_entry, trim(p_name), v_jersey)
  on conflict (user_id, team_id, season_id) do update
    set roster_entry_id = excluded.roster_entry_id, typed_name = excluded.typed_name, typed_jersey = excluded.typed_jersey,
        status = 'pending', requested_at = now(), decided_by = null, decided_at = null
    where public.player_claims.status <> 'approved';
  return v_entry is not null;
end;
$$;
revoke all on function private.request_player_claim(uuid, text, text) from public;
grant execute on function private.request_player_claim(uuid, text, text) to authenticated;
create function public.request_player_claim(p_team_id uuid, p_name text, p_jersey text) returns boolean
language sql security invoker set search_path = '' as $$ select private.request_player_claim(p_team_id, p_name, p_jersey) $$;
revoke all on function public.request_player_claim(uuid, text, text) from public, anon;
grant execute on function public.request_player_claim(uuid, text, text) to authenticated;

-- The signed-in player's claims with names, newest first. `current` = the
-- claim is for her team's current season; `player_id` once approved.
create function private.my_claims()
returns table (claim_id uuid, team_id uuid, team_name text, season_name text, typed_name text, typed_jersey text,
               status public.player_claim_status, is_current boolean, player_id uuid, welcome_message text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.team_id, t.name, s.name, c.typed_name, c.typed_jersey, c.status,
         c.season_id = private.team_current_season(c.team_id),
         case when c.status = 'approved' then r.player_id end,
         t.welcome_message
    from public.player_claims c
    join public.teams t on t.id = c.team_id
    join public.seasons s on s.id = c.season_id
    left join public.roster_entries r on r.id = c.roster_entry_id
   where c.user_id = (select auth.uid())
   order by s.start_date desc nulls last, c.requested_at desc
$$;
revoke all on function private.my_claims() from public;
grant execute on function private.my_claims() to authenticated;
create function public.my_claims()
returns table (claim_id uuid, team_id uuid, team_name text, season_name text, typed_name text, typed_jersey text,
               status public.player_claim_status, is_current boolean, player_id uuid, welcome_message text)
language sql stable security invoker set search_path = '' as $$ select * from private.my_claims() $$;
revoke all on function public.my_claims() from public, anon;
grant execute on function public.my_claims() to authenticated;

-- Claims for a team, with sign-in emails, for coaches to review.
create function private.team_player_claims(p_team_id uuid)
returns table (claim_id uuid, email text, typed_name text, typed_jersey text, roster_entry_id uuid,
               status public.player_claim_status, season_id uuid, season_name text, requested_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, u.email::text, c.typed_name, c.typed_jersey, c.roster_entry_id, c.status, c.season_id, s.name, c.requested_at
    from public.player_claims c
    join auth.users u on u.id = c.user_id
    join public.seasons s on s.id = c.season_id
   where c.team_id = p_team_id and (select private.can_edit())
   order by c.status, c.requested_at
$$;
revoke all on function private.team_player_claims(uuid) from public;
grant execute on function private.team_player_claims(uuid) to authenticated;
create function public.team_player_claims(p_team_id uuid)
returns table (claim_id uuid, email text, typed_name text, typed_jersey text, roster_entry_id uuid,
               status public.player_claim_status, season_id uuid, season_name text, requested_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.team_player_claims(p_team_id) $$;
revoke all on function public.team_player_claims(uuid) from public, anon;
grant execute on function public.team_player_claims(uuid) to authenticated;

-- What's waiting for a coach: pending player claims and parent requests, per team.
create function private.pending_approvals()
returns table (team_id uuid, team_name text, player_claims bigint, parent_requests bigint)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name,
         (select count(*) from public.player_claims c where c.team_id = t.id and c.status = 'pending'),
         (select count(*) from public.parent_links l where l.team_id = t.id and l.status = 'pending')
    from public.teams t
   where t.is_own_team and (select private.can_edit())
     and (exists (select 1 from public.player_claims c where c.team_id = t.id and c.status = 'pending')
          or exists (select 1 from public.parent_links l where l.team_id = t.id and l.status = 'pending'))
   order by t.name
$$;
revoke all on function private.pending_approvals() from public;
grant execute on function private.pending_approvals() to authenticated;
create function public.pending_approvals()
returns table (team_id uuid, team_name text, player_claims bigint, parent_requests bigint)
language sql stable security invoker set search_path = '' as $$ select * from private.pending_approvals() $$;
revoke all on function public.pending_approvals() from public, anon;
grant execute on function public.pending_approvals() to authenticated;

-- Player ids the signed-in user can open (for the app's page checks).
create function public.my_player_ids() returns setof uuid
language sql stable security invoker set search_path = '' as $$ select private.my_player_ids() $$;
revoke all on function public.my_player_ids() from public, anon;
grant execute on function public.my_player_ids() to authenticated;

-- -----------------------------------------------------------------------------
-- Player self-access policies (added alongside the staff policies)
-- -----------------------------------------------------------------------------
-- Reading her own profile, history and team context
create policy "player reads herself" on public.players for select to authenticated
  using (id in (select private.my_player_ids()));
create policy "player reads her roster history" on public.roster_entries for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player reads her teams and opponents" on public.teams for select to authenticated
  using (id in (select private.my_visible_team_ids()));
create policy "players read seasons" on public.seasons for select to authenticated
  using ((select private.has_player_access()));
create policy "player reads her schedule" on public.team_events for select to authenticated
  using (team_id in (select private.my_current_team_ids()));
create policy "player reads her games" on public.games for select to authenticated
  using (home_team_id in (select private.my_current_team_ids()) or away_team_id in (select private.my_current_team_ids()));
create policy "player reads team standards" on public.team_standards for select to authenticated
  using (team_id in (select private.my_current_team_ids()));
create policy "player reads team culture" on public.team_culture for select to authenticated
  using (team_id in (select private.my_current_team_ids()));
create policy "players read the metric list" on public.metrics for select to authenticated
  using ((select private.has_player_access()));
create policy "player reads her measurements" on public.measurements for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player reads her evaluations" on public.skill_evaluations for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player reads her assigned drills" on public.drill_assignments for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "players read the training drill library" on public.drills for select to authenticated
  using ((select private.has_player_access()));
create policy "players add training drills" on public.drills for insert to authenticated
  with check ((select private.has_player_access()));
create policy "player reads her achievements" on public.player_achievements for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player unlocks her achievements" on public.player_achievements for insert to authenticated
  with check (player_id in (select private.my_player_ids()));

-- Full edit of her own goals, Mental GP, routines and TWIS check-offs
do $$
declare
  t text;
begin
  foreach t in array array['player_activities', 'twis_checks', 'harada_plans', 'development_goals', 'mental_game_plans'] loop
    execute format('create policy "player manages her own" on public.%I for all to authenticated
                      using (player_id in (select private.my_player_ids()))
                      with check (player_id in (select private.my_player_ids()))', t);
  end loop;
end $$;
create policy "player manages her own" on public.harada_pillars for all to authenticated
  using (plan_id in (select h.id from public.harada_plans h where h.player_id in (select private.my_player_ids())))
  with check (plan_id in (select h.id from public.harada_plans h where h.player_id in (select private.my_player_ids())));
create policy "player manages her own" on public.harada_actions for all to authenticated
  using (pillar_id in (select p.id from public.harada_pillars p join public.harada_plans h on h.id = p.plan_id
                        where h.player_id in (select private.my_player_ids())))
  with check (pillar_id in (select p.id from public.harada_pillars p join public.harada_plans h on h.id = p.plan_id
                             where h.player_id in (select private.my_player_ids())));

-- Softball IQ: she reads her tests, answers and awards; writing goes through
-- the functions below, so she can't record answers or awards herself.
create policy "player reads her test runs" on public.iq_level_attempts for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player reads her answers" on public.iq_answers for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player reads her rings" on public.player_rings for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player reads her Golden Gloves" on public.player_golden_gloves for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player reads her MVP badges" on public.player_mvp_badges for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player reads her Champions Trophy" on public.player_world_series_trophies for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "players read active questions" on public.iq_questions for select to authenticated
  using (active and (select private.has_player_access()));

-- Answer keys are never readable directly (not even by staff): they come back
-- from record_iq_answer() after answering, or from iq_answer_key().
revoke select on public.iq_questions from anon, authenticated;
grant select (id, topic, position, scenario, question, choices, difficulty, active, created_by, created_at, updated_at,
              track, level, diagram, playbook_ref, hint, slug, section)
  on public.iq_questions to authenticated;

-- Her own profile photo
create policy "player views her photo" on storage.objects for select to authenticated
  using (bucket_id = 'player-photos'
         and name in (select p.photo_path from public.players p where p.id in (select private.my_player_ids())));

-- -----------------------------------------------------------------------------
-- Softball IQ functions: definer, with an explicit check that the caller is a
-- coach/admin or the player herself
-- -----------------------------------------------------------------------------
-- Correct answers and explanations: every question for staff; for a player,
-- only questions she has already answered.
create function private.iq_answer_key(p_player_id uuid)
returns table (question_id uuid, correct_index smallint, explanation text)
language sql stable security definer set search_path = '' as $$
  select q.id, q.correct_index, q.explanation
    from public.iq_questions q
   where (select private.is_staff())
      or (p_player_id in (select private.my_player_ids())
          and exists (select 1 from public.iq_answers a where a.player_id = p_player_id and a.question_id = q.id))
$$;
revoke all on function private.iq_answer_key(uuid) from public;
grant execute on function private.iq_answer_key(uuid) to authenticated;
create function public.iq_answer_key(p_player_id uuid)
returns table (question_id uuid, correct_index smallint, explanation text)
language sql stable security invoker set search_path = '' as $$ select * from private.iq_answer_key(p_player_id) $$;
revoke all on function public.iq_answer_key(uuid) from public, anon;
grant execute on function public.iq_answer_key(uuid) to authenticated;

-- Records one answer and grades it. One of: a practice quiz answer (no
-- attempt), an answer in an open test (p_attempt_id), or a review answer for a
-- finished test's missed question (p_review_of).
create function private.record_iq_answer(
  p_player_id   uuid,
  p_question_id uuid,
  p_chosen      smallint,
  p_attempt_id  uuid default null,
  p_review_of   uuid default null,
  p_hint_used   boolean default false
) returns table (correct boolean, correct_index smallint, explanation text)
language plpgsql security definer set search_path = '' as $$
declare
  v_q       public.iq_questions;
  v_attempt public.iq_level_attempts;
  v_correct boolean;
begin
  if not private.can_act_for(p_player_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_q from public.iq_questions where id = p_question_id;
  if v_q.id is null then
    raise exception 'question not found' using errcode = 'P0002';
  end if;
  if p_chosen is null or p_chosen < 0 or p_chosen >= coalesce(array_length(v_q.choices, 1), 0) then
    raise exception 'pick one of the choices' using errcode = '22023';
  end if;

  if p_attempt_id is not null then
    select * into v_attempt from public.iq_level_attempts where id = p_attempt_id;
    if v_attempt.id is null or v_attempt.player_id <> p_player_id or v_attempt.finished_at is not null then
      raise exception 'that test isn''t open' using errcode = 'P0008';
    end if;
    if v_q.track is distinct from v_attempt.track or v_q.level is distinct from v_attempt.level
       or (v_attempt.question_order is not null and not (p_question_id = any (v_attempt.question_order))) then
      raise exception 'that question isn''t part of this test' using errcode = 'P0008';
    end if;
  elsif p_review_of is not null then
    select * into v_attempt from public.iq_level_attempts where id = p_review_of;
    if v_attempt.id is null or v_attempt.player_id <> p_player_id or v_attempt.finished_at is null
       or not (p_question_id = any (coalesce(v_attempt.question_order, '{}'::uuid[])))
       or exists (select 1 from public.iq_answers a where a.attempt_id = p_review_of and a.question_id = p_question_id and a.is_correct) then
      raise exception 'that question isn''t one to review' using errcode = 'P0008';
    end if;
  end if;

  v_correct := p_chosen = v_q.correct_index;
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, answered_on, attempt_id, review_of, hint_used, recorded_by)
  values (p_player_id, p_question_id, p_chosen, v_correct,
          (now() at time zone 'America/New_York')::date,
          p_attempt_id, p_review_of,
          coalesce(p_hint_used, false) and (p_review_of is not null or v_attempt.track = 'extra'),
          (select auth.uid()));
  return query select v_correct, v_q.correct_index, v_q.explanation;
end;
$$;
revoke all on function private.record_iq_answer(uuid, uuid, smallint, uuid, uuid, boolean) from public;
grant execute on function private.record_iq_answer(uuid, uuid, smallint, uuid, uuid, boolean) to authenticated;
create function public.record_iq_answer(
  p_player_id uuid, p_question_id uuid, p_chosen smallint,
  p_attempt_id uuid default null, p_review_of uuid default null, p_hint_used boolean default false
) returns table (correct boolean, correct_index smallint, explanation text)
language sql security invoker set search_path = '' as $$
  select * from private.record_iq_answer(p_player_id, p_question_id, p_chosen, p_attempt_id, p_review_of, p_hint_used)
$$;
revoke all on function public.record_iq_answer(uuid, uuid, smallint, uuid, uuid, boolean) from public, anon;
grant execute on function public.record_iq_answer(uuid, uuid, smallint, uuid, uuid, boolean) to authenticated;

-- start_iq_level, finish_iq_level and iq_review_status become security
-- definer with the same check, so awards are only ever written by them.
alter function public.start_iq_level(uuid, public.iq_track, smallint, boolean, public.field_position) security definer;
alter function public.finish_iq_level(uuid) security definer;
alter function public.iq_review_status(uuid) security definer;

create function private.require_act_for_attempt(p_attempt_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_player uuid;
begin
  select player_id into v_player from public.iq_level_attempts where id = p_attempt_id;
  if v_player is null then
    raise exception 'attempt not found' using errcode = 'P0002';
  end if;
  if not private.can_act_for(v_player) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_act_for_attempt(uuid) from public;
grant execute on function private.require_act_for_attempt(uuid) to authenticated;

-- Wrap the three functions with the access check by renaming the originals.
alter function public.start_iq_level(uuid, public.iq_track, smallint, boolean, public.field_position)
  rename to start_iq_level_unchecked;
alter function public.start_iq_level_unchecked(uuid, public.iq_track, smallint, boolean, public.field_position)
  set schema private;
alter function public.finish_iq_level(uuid) rename to finish_iq_level_unchecked;
alter function public.finish_iq_level_unchecked(uuid) set schema private;
alter function public.iq_review_status(uuid) rename to iq_review_status_unchecked;
alter function public.iq_review_status_unchecked(uuid) set schema private;
revoke all on function private.start_iq_level_unchecked(uuid, public.iq_track, smallint, boolean, public.field_position),
  private.finish_iq_level_unchecked(uuid), private.iq_review_status_unchecked(uuid) from public, anon, authenticated;

create function public.start_iq_level(
  p_player_id uuid,
  p_track public.iq_track,
  p_level smallint,
  p_restart boolean default false,
  p_position public.field_position default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_act_for(p_player_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return private.start_iq_level_unchecked(p_player_id, p_track, p_level, p_restart, p_position);
end;
$$;
revoke all on function public.start_iq_level(uuid, public.iq_track, smallint, boolean, public.field_position) from public, anon;
grant execute on function public.start_iq_level(uuid, public.iq_track, smallint, boolean, public.field_position) to authenticated;

create function public.finish_iq_level(p_attempt_id uuid)
returns table (correct smallint, total smallint, passed boolean, award_earned boolean)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_act_for_attempt(p_attempt_id);
  return query select * from private.finish_iq_level_unchecked(p_attempt_id);
end;
$$;
revoke all on function public.finish_iq_level(uuid) from public, anon;
grant execute on function public.finish_iq_level(uuid) to authenticated;

create function public.iq_review_status(p_attempt_id uuid)
returns table (missed int, reviewed int, complete boolean)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_act_for_attempt(p_attempt_id);
  return query select * from private.iq_review_status_unchecked(p_attempt_id);
end;
$$;
revoke all on function public.iq_review_status(uuid) from public, anon;
grant execute on function public.iq_review_status(uuid) to authenticated;

-- A player (or a coach) switches her goal method; players can't edit the
-- players row itself, so this one field goes through a checked function.
create function private.set_goal_method(p_player_id uuid, p_method text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_act_for(p_player_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_method not in ('harada', 'smart') then
    raise exception 'unknown goal method' using errcode = '22023';
  end if;
  update public.players set goal_method = p_method::public.goal_method where id = p_player_id;
end;
$$;
revoke all on function private.set_goal_method(uuid, text) from public;
grant execute on function private.set_goal_method(uuid, text) to authenticated;
create function public.set_goal_method(p_player_id uuid, p_method text) returns void
language sql security invoker set search_path = '' as $$ select private.set_goal_method(p_player_id, p_method) $$;
revoke all on function public.set_goal_method(uuid, text) from public, anon;
grant execute on function public.set_goal_method(uuid, text) to authenticated;
