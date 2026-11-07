-- =============================================================================
-- GGG.Cafe — IQ tests: hints, saved progress, and reviewing missed questions
--
-- - Questions get a hint (shown on request during review) and a stable slug.
-- - A level test keeps the order its questions were dealt in, so a player can
--   stop and resume where she left off. Only one open test per player per level.
-- - After a test, the questions she missed can be reviewed: each one answered
--   again (optionally after asking for a hint). The review is complete once
--   every missed question has been answered again.
-- =============================================================================

alter table public.iq_questions
  add column hint text,
  add column slug text unique check (slug ~ '^[a-z0-9-]+$');

alter table public.iq_level_attempts
  add column question_order uuid[],
  add column reviewed_at timestamptz;
create unique index iq_level_attempts_one_open on public.iq_level_attempts (player_id, track, level)
  where finished_at is null;

alter table public.iq_answers
  add column review_of uuid references public.iq_level_attempts (id) on delete cascade,
  add column hint_used boolean not null default false,
  add constraint iq_answers_test_or_review check (attempt_id is null or review_of is null);
create unique index iq_answers_once_per_review on public.iq_answers (review_of, question_id)
  where review_of is not null;

-- -----------------------------------------------------------------------------
-- Start or resume a level test. Returns the open test if there is one (unless
-- p_restart, which discards it and deals a fresh one).
-- -----------------------------------------------------------------------------
drop function public.start_iq_level(uuid, public.iq_track, smallint);

create function public.start_iq_level(
  p_player_id uuid,
  p_track public.iq_track,
  p_level smallint,
  p_restart boolean default false
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt uuid;
  v_order   uuid[];
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

  select array_agg(id order by random()) into v_order
    from public.iq_questions where track = p_track and level = p_level and active;
  if v_order is null then
    raise exception 'No questions in this level yet' using errcode = 'P0002';
  end if;

  select id into v_attempt from public.iq_level_attempts
   where player_id = p_player_id and track = p_track and level = p_level and finished_at is null;

  if v_attempt is not null and p_restart then
    delete from public.iq_level_attempts where id = v_attempt;
    v_attempt := null;
  end if;

  if v_attempt is not null then
    -- tests opened before progress-saving existed get their order now
    update public.iq_level_attempts set question_order = v_order
     where id = v_attempt and question_order is null;
    return v_attempt;
  end if;

  insert into public.iq_level_attempts (player_id, track, level, question_order)
  values (p_player_id, p_track, p_level, v_order)
  returning id into v_attempt;
  return v_attempt;
end;
$$;
revoke all on function public.start_iq_level(uuid, public.iq_track, smallint, boolean) from public, anon;
grant execute on function public.start_iq_level(uuid, public.iq_track, smallint, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Grade against the questions this test was dealt (unanswered = wrong).
-- -----------------------------------------------------------------------------
create or replace function public.finish_iq_level(p_attempt_id uuid)
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

  if v_attempt.question_order is not null then
    v_total := coalesce(array_length(v_attempt.question_order, 1), 0);
    select count(*) into v_correct from public.iq_answers a
     where a.attempt_id = p_attempt_id and a.is_correct and a.question_id = any (v_attempt.question_order);
  else
    select count(*) into v_total from public.iq_questions
     where track = v_attempt.track and level = v_attempt.level and active;
    select count(*) into v_correct from public.iq_answers a
      join public.iq_questions q on q.id = a.question_id
     where a.attempt_id = p_attempt_id and a.is_correct and q.track = v_attempt.track and q.level = v_attempt.level;
  end if;
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

-- -----------------------------------------------------------------------------
-- Review progress for a finished test: how many were missed, how many have been
-- answered again, and whether the review is done (marks reviewed_at once done).
-- -----------------------------------------------------------------------------
create function public.iq_review_status(p_attempt_id uuid)
returns table (missed int, reviewed int, complete boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_missed   int;
  v_reviewed int;
  v_order    uuid[];
begin
  select question_order into v_order from public.iq_level_attempts where id = p_attempt_id and finished_at is not null;
  if not found then
    raise exception 'test not finished' using errcode = 'P0002';
  end if;

  -- missed = dealt but not answered correctly (wrong or left unanswered)
  select count(*) into v_missed from unnest(coalesce(v_order, '{}'::uuid[])) as q(id)
   where not exists (select 1 from public.iq_answers a where a.attempt_id = p_attempt_id and a.question_id = q.id and a.is_correct);
  select count(*) into v_reviewed from public.iq_answers r
   where r.review_of = p_attempt_id
     and not exists (select 1 from public.iq_answers a where a.attempt_id = p_attempt_id and a.question_id = r.question_id and a.is_correct);

  if v_missed > 0 and v_reviewed >= v_missed then
    update public.iq_level_attempts set reviewed_at = coalesce(reviewed_at, now()) where id = p_attempt_id;
  end if;
  return query select v_missed, v_reviewed, (v_missed > 0 and v_reviewed >= v_missed);
end;
$$;
revoke all on function public.iq_review_status(uuid) from public, anon;
grant execute on function public.iq_review_status(uuid) to authenticated;
