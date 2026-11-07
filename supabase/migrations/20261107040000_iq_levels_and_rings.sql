-- =============================================================================
-- GGG.Cafe — IQ levels and championship rings
--
-- Two playbook tracks (Defense IQ, Baserunning IQ), each with Levels 1-3.
-- A level test covers every active question in that level. Scoring 80% or
-- better passes it, earns that level's championship ring, and unlocks the
-- next level. Grading and unlocking happen here, not in the browser.
-- Questions can carry a diagram (runners, outs, ball location) for a visual.
-- =============================================================================

create type public.iq_track as enum ('defense', 'baserunning');

alter table public.iq_questions
  add column track        public.iq_track,
  add column level        smallint check (level between 1 and 3),
  add column diagram      jsonb,
  add column playbook_ref text,
  add constraint iq_questions_track_level_check check ((track is null) = (level is null));
comment on column public.iq_questions.diagram is
  'Scenario diagram: {runners: [base], outs, you, ball: {at, type}, arrows: [{from, to, kind}]}. Rendered by src/components/diamond.tsx.';
create index iq_questions_track_idx on public.iq_questions (track, level) where active;

create table public.iq_level_attempts (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  track       public.iq_track not null,
  level       smallint not null check (level between 1 and 3),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  correct     smallint,
  total       smallint,
  passed      boolean,
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index iq_level_attempts_player_idx on public.iq_level_attempts (player_id, track, level);

alter table public.iq_answers
  add column attempt_id uuid references public.iq_level_attempts (id) on delete cascade;
create unique index iq_answers_once_per_attempt on public.iq_answers (attempt_id, question_id)
  where attempt_id is not null;

create table public.player_rings (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  track      public.iq_track not null,
  level      smallint not null check (level between 1 and 3),
  earned_on  date not null default current_date,
  attempt_id uuid references public.iq_level_attempts (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (player_id, track, level)
);
comment on table public.player_rings is 'Championship rings: one per track level passed with 80%+.';

select private.apply_staff_rls('public.iq_level_attempts');
select private.apply_staff_rls('public.player_rings');

-- -----------------------------------------------------------------------------
-- Start a level test. Level 1 is always open; higher levels need the previous ring.
-- -----------------------------------------------------------------------------
create function public.start_iq_level(p_player_id uuid, p_track public.iq_track, p_level smallint)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt uuid;
begin
  if p_level < 1 or p_level > 3 then
    raise exception 'level must be 1-3' using errcode = '22023';
  end if;
  if p_level > 1 and not exists (
    select 1 from public.player_rings
     where player_id = p_player_id and track = p_track and level = p_level - 1
  ) then
    raise exception 'Level % is locked until Level % is passed', p_level, p_level - 1 using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.iq_questions where track = p_track and level = p_level and active) then
    raise exception 'No questions in this level yet' using errcode = 'P0002';
  end if;

  insert into public.iq_level_attempts (player_id, track, level)
  values (p_player_id, p_track, p_level)
  returning id into v_attempt;
  return v_attempt;
end;
$$;

-- -----------------------------------------------------------------------------
-- Finish a level test: grade it from the recorded answers and award the ring.
-- Unanswered questions count as wrong. Returns the graded attempt.
-- -----------------------------------------------------------------------------
create function public.finish_iq_level(p_attempt_id uuid)
returns table (correct smallint, total smallint, passed boolean, ring_earned boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt public.iq_level_attempts;
  v_correct smallint;
  v_total   smallint;
  v_passed  boolean;
  v_ring    boolean := false;
begin
  select * into v_attempt from public.iq_level_attempts where id = p_attempt_id;
  if v_attempt.id is null then
    raise exception 'attempt not found' using errcode = 'P0002';
  end if;
  if v_attempt.finished_at is not null then
    return query select v_attempt.correct, v_attempt.total, v_attempt.passed, false;
    return;
  end if;

  select count(*) into v_total from public.iq_questions
   where track = v_attempt.track and level = v_attempt.level and active;
  select count(*) into v_correct from public.iq_answers a
    join public.iq_questions q on q.id = a.question_id
   where a.attempt_id = p_attempt_id and a.is_correct
     and q.track = v_attempt.track and q.level = v_attempt.level;
  v_passed := v_total > 0 and v_correct * 100 >= v_total * 80;

  update public.iq_level_attempts
     set finished_at = now(), correct = v_correct, total = v_total, passed = v_passed
   where id = p_attempt_id;

  if v_passed then
    insert into public.player_rings (player_id, track, level, attempt_id)
    values (v_attempt.player_id, v_attempt.track, v_attempt.level, p_attempt_id)
    on conflict (player_id, track, level) do nothing;
    v_ring := found;
  end if;

  return query select v_correct, v_total, v_passed, v_ring;
end;
$$;

revoke all on function public.start_iq_level(uuid, public.iq_track, smallint) from public, anon;
revoke all on function public.finish_iq_level(uuid) from public, anon;
grant execute on function public.start_iq_level(uuid, public.iq_track, smallint) to authenticated;
grant execute on function public.finish_iq_level(uuid) to authenticated;
