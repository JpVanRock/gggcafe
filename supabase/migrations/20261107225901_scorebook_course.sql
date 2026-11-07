-- =============================================================================
-- GGG.Cafe — How to Keep the Book (Softball IQ course) and Manager of the Year
--
-- Six chapters of lessons (content in src/lib/scorebook.ts). Each chapter ends
-- with a short quiz: iq_questions track 'scorebook', level = chapter, run through
-- the same test flow as the other IQ tests (start_iq_level / record_iq_answer /
-- finish_iq_level). Finishing a chapter's lessons and scoring 80%+ on its quiz
-- earns that chapter's Manager of the Year award. Chapters unlock in order.
-- Course quizzes don't earn MVP badges; Manager of the Year is their award.
-- =============================================================================

-- Playbook levels stay 1-3; the course has chapters 1-6.
alter table public.iq_questions drop constraint iq_questions_level_check;
alter table public.iq_questions
  add constraint iq_questions_level_check check (level between 1 and 3 or (track = 'scorebook' and level between 1 and 6)),
  add constraint iq_questions_scorebook_check check (track is distinct from 'scorebook' or (position is null and section is null));
alter table public.iq_level_attempts drop constraint iq_level_attempts_level_check;
alter table public.iq_level_attempts
  add constraint iq_level_attempts_level_check check (level between 1 and 3 or (track = 'scorebook' and level between 1 and 6));

-- Lesson progress: the furthest step she reached, and when she finished the
-- chapter's lessons (which opens its quiz). Players keep their own.
create table public.player_scorebook_progress (
  player_id    uuid not null references public.players (id) on delete cascade,
  chapter      smallint not null check (chapter between 1 and 6),
  step         smallint not null default 0 check (step between 0 and 50),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (player_id, chapter)
);
comment on table public.player_scorebook_progress is
  'How to Keep the Book: lesson progress per chapter (furthest step; completed_at opens the chapter quiz).';
select private.apply_staff_rls('public.player_scorebook_progress');
create policy "player keeps her own course progress" on public.player_scorebook_progress for all to authenticated
  using (player_id in (select private.my_player_ids()))
  with check (player_id in (select private.my_player_ids()));

-- Manager of the Year: one per chapter, written only by finish_iq_level.
create table public.player_manager_awards (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  chapter    smallint not null check (chapter between 1 and 6),
  attempt_id uuid references public.iq_level_attempts (id) on delete set null,
  earned_on  date not null default current_date,
  created_at timestamptz not null default now(),
  unique (player_id, chapter)
);
comment on table public.player_manager_awards is
  'Manager of the Year: one per How to Keep the Book chapter (lessons finished and the chapter quiz passed with 80%+).';
select private.apply_staff_rls('public.player_manager_awards');
create policy "player reads her Manager of the Year awards" on public.player_manager_awards for select to authenticated
  using (player_id in (select private.my_player_ids()));

-- -----------------------------------------------------------------------------
-- Start or resume a test (the access check lives in the public wrapper).
-- Course chapters: 1-6, chapter n needs chapter n-1's award, and the quiz opens
-- once the chapter's lessons are finished.
-- -----------------------------------------------------------------------------
create or replace function private.start_iq_level_unchecked(
  p_player_id uuid,
  p_track public.iq_track,
  p_level smallint,
  p_restart boolean default false,
  p_position public.field_position default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
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
  elsif p_track = 'scorebook' then
    if p_position is not null or p_level < 1 or p_level > 6 then
      raise exception 'The course has chapters 1-6' using errcode = '22023';
    end if;
    if p_level > 1 and not exists (
      select 1 from public.player_manager_awards where player_id = p_player_id and chapter = p_level - 1
    ) then
      raise exception 'Chapter % is locked until Chapter % is complete', p_level, p_level - 1 using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.player_scorebook_progress
       where player_id = p_player_id and chapter = p_level and completed_at is not null
    ) then
      raise exception 'Finish the chapter''s lessons before the quiz' using errcode = 'P0005';
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
-- Grade a test. 80%+ earns its award: ring, Golden Glove, Champions Trophy, or
-- (course chapters) Manager of the Year. A perfect score earns the MVP badge,
-- except on course quizzes.
-- -----------------------------------------------------------------------------
create or replace function private.finish_iq_level_unchecked(p_attempt_id uuid)
returns table (correct smallint, total smallint, passed boolean, award_earned boolean)
language plpgsql security definer set search_path = '' as $$
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
    elsif v_attempt.track = 'scorebook' then
      insert into public.player_manager_awards (player_id, chapter, attempt_id)
      values (v_attempt.player_id, v_attempt.level, p_attempt_id)
      on conflict (player_id, chapter) do nothing;
    else
      insert into public.player_rings (player_id, track, level, attempt_id)
      values (v_attempt.player_id, v_attempt.track, v_attempt.level, p_attempt_id)
      on conflict (player_id, track, level) do nothing;
    end if;
    v_award := found;
  end if;

  if v_attempt.track <> 'scorebook' and v_total > 0 and v_correct = v_total then
    insert into public.player_mvp_badges (player_id, track, level, position, attempt_id)
    values (v_attempt.player_id, v_attempt.track, v_attempt.level, v_attempt.position, p_attempt_id)
    on conflict do nothing;
  end if;

  return query select v_correct, v_total, v_passed, v_award;
end;
$$;

-- -----------------------------------------------------------------------------
-- Review progress for a finished test: every miss answered again stamps
-- reviewed_at and (except on course quizzes) awards the MVP badge.
-- -----------------------------------------------------------------------------
create or replace function private.iq_review_status_unchecked(p_attempt_id uuid)
returns table (missed int, reviewed int, complete boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_attempt  public.iq_level_attempts;
  v_missed   int;
  v_reviewed int;
begin
  select * into v_attempt from public.iq_level_attempts where id = p_attempt_id and finished_at is not null;
  if not found then
    raise exception 'test not finished' using errcode = 'P0002';
  end if;

  select count(*) into v_missed from unnest(coalesce(v_attempt.question_order, '{}'::uuid[])) as q(id)
   where not exists (select 1 from public.iq_answers a where a.attempt_id = p_attempt_id and a.question_id = q.id and a.is_correct);
  select count(*) into v_reviewed from public.iq_answers r
   where r.review_of = p_attempt_id
     and not exists (select 1 from public.iq_answers a where a.attempt_id = p_attempt_id and a.question_id = r.question_id and a.is_correct);

  if v_missed > 0 and v_reviewed >= v_missed then
    update public.iq_level_attempts set reviewed_at = coalesce(reviewed_at, now()) where id = p_attempt_id;
    if v_attempt.track <> 'scorebook' then
      insert into public.player_mvp_badges (player_id, track, level, position, attempt_id)
      values (v_attempt.player_id, v_attempt.track, v_attempt.level, v_attempt.position, p_attempt_id)
      on conflict do nothing;
    end if;
  end if;
  return query select v_missed, v_reviewed, (v_missed > 0 and v_reviewed >= v_missed);
end;
$$;

revoke all on function private.start_iq_level_unchecked(uuid, public.iq_track, smallint, boolean, public.field_position),
  private.finish_iq_level_unchecked(uuid), private.iq_review_status_unchecked(uuid) from public, anon, authenticated;
