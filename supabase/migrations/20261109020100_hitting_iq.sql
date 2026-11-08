-- =============================================================================
-- Hitting & Softball IQ (SB Blueprint Phase 3, user 2026-11-08)
--   27 Offense IQ: a Levels 1-3 track (questions in supabase/iq/offense.json).
--      Battery IQ (Phase 4) works the same way. Passing a level (80%+) unlocks the
--      next; the award is the MVP badge (a perfect score, or every miss reviewed).
--   28 My Zone: her pitch, the zones she handles and her weak zones on the 1-9 grid
--      (catcher's view), on her Preferred Hitting Style (hitting_zones). Her count
--      plan (0, 1, 2 strikes) comes from it (src/lib/my-zone.ts).
-- =============================================================================

-- Start: Offense and Battery levels unlock from a passed test, not a ring.
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
    if p_level > 1 and (
      -- Offense and Battery IQ: a passed test unlocks the next level (no rings)
      (p_track::text in ('offense', 'battery') and not exists (
        select 1 from public.iq_level_attempts
         where player_id = p_player_id and track = p_track and level = p_level - 1 and passed))
      or (p_track::text not in ('offense', 'battery') and not exists (
        select 1 from public.player_rings
         where player_id = p_player_id and track = p_track and level = p_level - 1))
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

-- Grade: no ring for Offense or Battery IQ; the MVP badge rules are unchanged.
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

  -- Offense and Battery IQ: passing unlocks the next level; their award is the MVP badge (below)
  if v_passed and v_attempt.track::text not in ('offense', 'battery') then
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

-- My Zone
create table public.hitting_zones (
  player_id  uuid primary key references public.players (id) on delete cascade,
  hot        smallint[] not null default '{}' check (hot <@ array[1, 2, 3, 4, 5, 6, 7, 8, 9]::smallint[]),
  strong     smallint[] not null default '{}' check (strong <@ array[1, 2, 3, 4, 5, 6, 7, 8, 9]::smallint[]),
  weak       smallint[] not null default '{}' check (weak <@ array[1, 2, 3, 4, 5, 6, 7, 8, 9]::smallint[]),
  notes      text check (char_length(notes) <= 300),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (not (hot && strong) and not (hot && weak) and not (strong && weak))
);
comment on table public.hitting_zones is
  'My Zone: her pitch (hot), zones she handles (strong) and weak zones, 1-9 from the catcher''s view. She or a coach edits it.';
select private.apply_staff_rls('public.hitting_zones');
create policy "player manages her own" on public.hitting_zones for all to authenticated
  using (player_id in (select private.my_player_ids()))
  with check (player_id in (select private.my_player_ids()));
create policy "mentor reads her players' zones" on public.hitting_zones for select to authenticated
  using (player_id in (select private.my_mentee_ids()));
