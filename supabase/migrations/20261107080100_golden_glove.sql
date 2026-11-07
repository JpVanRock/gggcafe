-- =============================================================================
-- GGG.Cafe — Position IQ tests and the Golden Glove award
--
-- A player picks a fielding position and takes that position's test: one level,
-- 21 questions on what that position does in each situation. It works like the
-- playbook level tests (saved order, resume, review of misses with hints).
-- Scoring 80% or better earns that position's Golden Glove.
-- Position test questions: track 'position', level 1, topic 'position', position set.
-- =============================================================================

alter table public.iq_questions
  add constraint iq_questions_position_track_check check (
    track is distinct from 'position'
    or (level = 1 and position in ('P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'))
  );

alter table public.iq_level_attempts
  add column position public.field_position,
  add constraint iq_level_attempts_position_check check (
    case when track = 'position'
      then level = 1 and position in ('P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF')
      else position is null
    end
  );

-- one open test per player per level (per position for position tests)
drop index public.iq_level_attempts_one_open;
create unique index iq_level_attempts_one_open on public.iq_level_attempts (player_id, track, level, position)
  nulls not distinct where finished_at is null;

create table public.player_golden_gloves (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  position   public.field_position not null check (position in ('P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF')),
  earned_on  date not null default current_date,
  attempt_id uuid references public.iq_level_attempts (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (player_id, position)
);
comment on table public.player_golden_gloves is 'Golden Glove awards: one per position test passed with 80%+.';
select private.apply_staff_rls('public.player_golden_gloves');

-- -----------------------------------------------------------------------------
-- Start or resume a test. Playbook tracks: Levels 1-3, each unlocked by the
-- previous ring. Position track: Level 1 only, for one fielding position.
-- -----------------------------------------------------------------------------
drop function public.start_iq_level(uuid, public.iq_track, smallint, boolean);

create function public.start_iq_level(
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
revoke all on function public.start_iq_level(uuid, public.iq_track, smallint, boolean, public.field_position) from public, anon;
grant execute on function public.start_iq_level(uuid, public.iq_track, smallint, boolean, public.field_position) to authenticated;

-- -----------------------------------------------------------------------------
-- Grade a test against the questions it was dealt (unanswered = wrong).
-- 80%+ earns the award: the level's ring, or the position's Golden Glove.
-- -----------------------------------------------------------------------------
drop function public.finish_iq_level(uuid);

create function public.finish_iq_level(p_attempt_id uuid)
returns table (correct smallint, total smallint, passed boolean, award_earned boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt public.iq_level_attempts;
  v_correct smallint;
  v_total   smallint;
  v_passed  boolean;
  v_award   boolean := false;
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
    if v_attempt.track = 'position' then
      insert into public.player_golden_gloves (player_id, position, attempt_id)
      values (v_attempt.player_id, v_attempt.position, p_attempt_id)
      on conflict (player_id, position) do nothing;
    else
      insert into public.player_rings (player_id, track, level, attempt_id)
      values (v_attempt.player_id, v_attempt.track, v_attempt.level, p_attempt_id)
      on conflict (player_id, track, level) do nothing;
    end if;
    v_award := found;
  end if;

  return query select v_correct, v_total, v_passed, v_award;
end;
$$;
revoke all on function public.finish_iq_level(uuid) from public, anon;
grant execute on function public.finish_iq_level(uuid) to authenticated;
