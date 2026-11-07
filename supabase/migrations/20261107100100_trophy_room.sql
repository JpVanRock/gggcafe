-- =============================================================================
-- GGG.Cafe — MVP badges, the Extra Credit Library and the GGG World Series Trophy
--
-- MVP badge: earned for a test once every question she missed has been answered
--   again in its review, or outright with a perfect score (nothing to review).
--   One per test (playbook level, position, or the library).
-- Extra Credit Library (track 'extra'): questions on the playbook topics the
--   tests don't cover, grouped into shelves (`section`). One run at a time, any
--   order, hints allowed, progress saved. A run is graded once every question is
--   answered; 80%+ earns the GGG World Series Trophy.
-- The Stolen Base Leader plaque needs no table: it comes with the Baserunning IQ
--   Level 3 ring (all three levels passed).
-- =============================================================================

alter table public.iq_questions
  add column section text check (section is null or length(section) between 1 and 60),
  add constraint iq_questions_extra_track_check check (
    track is distinct from 'extra' or (level = 1 and position is null and section is not null)
  );

alter table public.iq_level_attempts
  add constraint iq_level_attempts_extra_check check (track is distinct from 'extra' or level = 1);

create table public.player_mvp_badges (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  track      public.iq_track not null,
  level      smallint not null check (level between 1 and 3),
  position   public.field_position,
  attempt_id uuid references public.iq_level_attempts (id) on delete set null,
  earned_on  date not null default current_date,
  created_at timestamptz not null default now(),
  constraint player_mvp_badges_one_per_test unique nulls not distinct (player_id, track, level, position)
);
comment on table public.player_mvp_badges is
  'MVP badges: one per test, for reviewing every missed question (or a perfect score).';
select private.apply_staff_rls('public.player_mvp_badges');

create table public.player_world_series_trophies (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null unique references public.players (id) on delete cascade,
  attempt_id uuid references public.iq_level_attempts (id) on delete set null,
  earned_on  date not null default current_date,
  created_at timestamptz not null default now()
);
comment on table public.player_world_series_trophies is
  'GGG World Series Trophy: every Extra Credit Library question answered in one run with 80%+.';
select private.apply_staff_rls('public.player_world_series_trophies');

-- -----------------------------------------------------------------------------
-- Start or resume a test. Playbook tracks: Levels 1-3, each unlocked by the
-- previous ring. Position track: Level 1, one fielding position. Extra track:
-- Level 1, the whole library.
-- -----------------------------------------------------------------------------
create or replace function public.start_iq_level(
  p_player_id uuid,
  p_track public.iq_track,
  p_level smallint,
  p_restart boolean default false,
  p_position public.field_position default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt uuid;
  v_order   uuid[];
begin
  if p_track = 'position' then
    if p_level <> 1 then
      raise exception 'Position tests have one level' using errcode = '22023';
    end if;
    if p_position is null or p_position not in ('P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF') then
      raise exception 'Choose a fielding position' using errcode = '22023';
    end if;
  elsif p_track = 'extra' then
    if p_level <> 1 or p_position is not null then
      raise exception 'The Extra Credit Library is one run with no position' using errcode = '22023';
    end if;
  else
    if p_position is not null then
      raise exception 'Only position tests take a position' using errcode = '22023';
    end if;
    if p_level < 1 or p_level > 3 then
      raise exception 'level must be 1-3' using errcode = '22023';
    end if;
    if p_level > 1 and not exists (
      select 1 from public.player_rings
       where player_id = p_player_id and track = p_track and level = p_level - 1
    ) then
      raise exception 'Level % is locked until Level % is passed', p_level, p_level - 1 using errcode = 'P0001';
    end if;
  end if;

  select array_agg(id order by random()) into v_order
    from public.iq_questions
   where track = p_track and level = p_level and active and position is not distinct from p_position;
  if v_order is null then
    raise exception 'No questions in this test yet' using errcode = 'P0002';
  end if;

  select id into v_attempt from public.iq_level_attempts
   where player_id = p_player_id and track = p_track and level = p_level
     and position is not distinct from p_position and finished_at is null;

  if v_attempt is not null and p_restart then
    delete from public.iq_level_attempts where id = v_attempt;
    v_attempt := null;
  end if;

  if v_attempt is not null then
    update public.iq_level_attempts set question_order = v_order
     where id = v_attempt and question_order is null;
    return v_attempt;
  end if;

  insert into public.iq_level_attempts (player_id, track, level, position, question_order)
  values (p_player_id, p_track, p_level, p_position, v_order)
  returning id into v_attempt;
  return v_attempt;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grade a test against the questions it was dealt (unanswered = wrong; a
-- library run must be fully answered first). 80%+ earns the test's award: the
-- ring, the Golden Glove, or the World Series Trophy. A perfect score also
-- earns the MVP badge, since there is nothing left to review.
-- -----------------------------------------------------------------------------
create or replace function public.finish_iq_level(p_attempt_id uuid)
returns table (correct smallint, total smallint, passed boolean, award_earned boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt  public.iq_level_attempts;
  v_correct  smallint;
  v_answered smallint;
  v_total    smallint;
  v_passed   boolean;
  v_award    boolean := false;
begin
  select * into v_attempt from public.iq_level_attempts where id = p_attempt_id;
  if v_attempt.id is null then
    raise exception 'attempt not found' using errcode = 'P0002';
  end if;
  if v_attempt.finished_at is not null then
    return query select v_attempt.correct, v_attempt.total, v_attempt.passed, false;
    return;
  end if;

  if v_attempt.question_order is not null then
    v_total := coalesce(array_length(v_attempt.question_order, 1), 0);
    select count(*), count(*) filter (where a.is_correct) into v_answered, v_correct
      from public.iq_answers a
     where a.attempt_id = p_attempt_id and a.question_id = any (v_attempt.question_order);
  else
    select count(*) into v_total from public.iq_questions
     where track = v_attempt.track and level = v_attempt.level and active;
    select count(*), count(*) filter (where a.is_correct) into v_answered, v_correct
      from public.iq_answers a
      join public.iq_questions q on q.id = a.question_id
     where a.attempt_id = p_attempt_id and q.track = v_attempt.track and q.level = v_attempt.level;
  end if;

  if v_attempt.track = 'extra' and v_answered < v_total then
    raise exception 'Answer every library question before grading (% of % answered)', v_answered, v_total
      using errcode = 'P0003';
  end if;

  v_passed := v_total > 0 and v_correct * 100 >= v_total * 80;

  update public.iq_level_attempts
     set finished_at = now(), correct = v_correct, total = v_total, passed = v_passed
   where id = p_attempt_id;

  if v_passed then
    if v_attempt.track = 'position' then
      insert into public.player_golden_gloves (player_id, position, attempt_id)
      values (v_attempt.player_id, v_attempt.position, p_attempt_id)
      on conflict (player_id, position) do nothing;
    elsif v_attempt.track = 'extra' then
      insert into public.player_world_series_trophies (player_id, attempt_id)
      values (v_attempt.player_id, p_attempt_id)
      on conflict (player_id) do nothing;
    else
      insert into public.player_rings (player_id, track, level, attempt_id)
      values (v_attempt.player_id, v_attempt.track, v_attempt.level, p_attempt_id)
      on conflict (player_id, track, level) do nothing;
    end if;
    v_award := found;
  end if;

  if v_total > 0 and v_correct = v_total then
    insert into public.player_mvp_badges (player_id, track, level, position, attempt_id)
    values (v_attempt.player_id, v_attempt.track, v_attempt.level, v_attempt.position, p_attempt_id)
    on conflict do nothing;
  end if;

  return query select v_correct, v_total, v_passed, v_award;
end;
$$;

-- -----------------------------------------------------------------------------
-- Review progress for a finished test. When every missed question has been
-- answered again, stamp reviewed_at and award the MVP badge for that test.
-- -----------------------------------------------------------------------------
create or replace function public.iq_review_status(p_attempt_id uuid)
returns table (missed int, reviewed int, complete boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt  public.iq_level_attempts;
  v_missed   int;
  v_reviewed int;
begin
  select * into v_attempt from public.iq_level_attempts where id = p_attempt_id and finished_at is not null;
  if not found then
    raise exception 'test not finished' using errcode = 'P0002';
  end if;

  -- missed = dealt but not answered correctly (wrong or left unanswered)
  select count(*) into v_missed from unnest(coalesce(v_attempt.question_order, '{}'::uuid[])) as q(id)
   where not exists (select 1 from public.iq_answers a where a.attempt_id = p_attempt_id and a.question_id = q.id and a.is_correct);
  select count(*) into v_reviewed from public.iq_answers r
   where r.review_of = p_attempt_id
     and not exists (select 1 from public.iq_answers a where a.attempt_id = p_attempt_id and a.question_id = r.question_id and a.is_correct);

  if v_missed > 0 and v_reviewed >= v_missed then
    update public.iq_level_attempts set reviewed_at = coalesce(reviewed_at, now()) where id = p_attempt_id;
    insert into public.player_mvp_badges (player_id, track, level, position, attempt_id)
    values (v_attempt.player_id, v_attempt.track, v_attempt.level, v_attempt.position, p_attempt_id)
    on conflict do nothing;
  end if;
  return query select v_missed, v_reviewed, (v_missed > 0 and v_reviewed >= v_missed);
end;
$$;
