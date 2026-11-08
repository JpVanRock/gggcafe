-- =============================================================================
-- GGG.Cafe — How to Keep the Book, extra credit: score a two-inning game
--
-- After all six chapters, a player can keep the book for a full game (Bayside
-- Blaze at Summit Storm, 15 batters; play-by-play in src/lib/scorebook-game.ts).
-- Every play she records is graded here against a key she can't read
-- (private.scorebook_game_key, generated from supabase/iq/scorebook-game.json).
-- A clean book (12+ of 15 batters right on the first try and the right line
-- score) earns a hidden award: the GGG World Series Trophy. It's an easter egg,
-- so the site never names the reward before it's earned.
-- =============================================================================

-- Hidden awards (easter eggs), one row per award a player has found.
create table public.player_hidden_awards (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  award      text not null check (award in ('world-series')),
  earned_on  date not null default current_date,
  created_at timestamptz not null default now(),
  unique (player_id, award)
);
comment on table public.player_hidden_awards is
  'Easter-egg awards. world-series: the GGG World Series Trophy, for keeping a clean book in the How to Keep the Book game.';
select private.apply_staff_rls('public.player_hidden_awards');
create policy "player reads her hidden awards" on public.player_hidden_awards for select to authenticated
  using (player_id in (select private.my_player_ids()));

-- One run of the game: her book so far (only plays she has recorded right), the
-- next batter, and how many she got right on the first try.
create table public.scorebook_game_runs (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  started_at  timestamptz not null default now(),
  next_play   smallint not null default 1 check (next_play between 1 and 16),
  first_try   smallint not null default 0 check (first_try between 0 and 15),
  tries       smallint not null default 0,
  book        jsonb not null default '{}'::jsonb,
  finished_at timestamptz,
  passed      boolean,
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null
);
comment on table public.scorebook_game_runs is
  'How to Keep the Book game runs: book = boxes recorded so far; tries = wrong tries on the current batter.';
create unique index scorebook_game_runs_one_open on public.scorebook_game_runs (player_id) where finished_at is null;
select private.apply_staff_rls('public.scorebook_game_runs');
create policy "player reads her game runs" on public.scorebook_game_runs for select to authenticated
  using (player_id in (select private.my_player_ids()));

-- The answer key: the boxes she writes in on each play, and the final line score.
create table private.scorebook_game_key (
  play  smallint primary key check (play between 1 and 15),
  boxes jsonb not null
);
create table private.scorebook_game_line (
  id   boolean primary key default true check (id),
  line jsonb not null
);
revoke all on private.scorebook_game_key, private.scorebook_game_line from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Start (or resume) a game. Opens once all six chapters are complete.
-- -----------------------------------------------------------------------------
create function private.start_scorebook_game(p_player_id uuid, p_restart boolean default false)
returns setof public.scorebook_game_runs
language plpgsql security definer set search_path = '' as $$
declare
  v_run public.scorebook_game_runs;
begin
  if not private.can_act_for(p_player_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.player_manager_awards where player_id = p_player_id) < 6 then
    raise exception 'Finish all six chapters first' using errcode = 'P0001';
  end if;
  select * into v_run from public.scorebook_game_runs where player_id = p_player_id and finished_at is null;
  if v_run.id is not null and p_restart then
    delete from public.scorebook_game_runs where id = v_run.id;
    v_run := null;
  end if;
  if v_run.id is null then
    insert into public.scorebook_game_runs (player_id) values (p_player_id) returning * into v_run;
  end if;
  return next v_run;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grade one play: p_boxes is the full state of every box she wrote in (the
-- batter's and each runner's). Right: it goes in her book and the next batter
-- comes up. Wrong: she's told which marks to check, and after three tries the
-- answer is shown (that batter no longer counts as first try).
-- -----------------------------------------------------------------------------
create function private.score_game_play(p_run_id uuid, p_play smallint, p_boxes jsonb)
returns table (correct boolean, wrong text[], answer jsonb, next_play smallint, first_try smallint)
language plpgsql security definer set search_path = '' as $$
declare
  v_run      public.scorebook_game_runs;
  v_expected jsonb;
  v_wrong    text[];
  v_ok       boolean;
begin
  select * into v_run from public.scorebook_game_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  if not private.can_act_for(v_run.player_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_run.finished_at is not null or p_play is distinct from v_run.next_play then
    raise exception 'that batter isn''t up' using errcode = 'P0008';
  end if;
  select boxes into v_expected from private.scorebook_game_key where play = p_play;
  if v_expected is null then
    raise exception 'no such play' using errcode = 'P0002';
  end if;

  v_ok := coalesce(jsonb_typeof(p_boxes) = 'object', false) and p_boxes = v_expected;
  if v_ok then
    update public.scorebook_game_runs r
       set book = r.book || v_expected,
           next_play = r.next_play + 1,
           first_try = r.first_try + case when r.tries = 0 then 1 else 0 end,
           tries = 0
     where r.id = p_run_id
     returning * into v_run;
    return query select true, '{}'::text[], null::jsonb, v_run.next_play, v_run.first_try;
    return;
  end if;

  -- which marks don't match, as "box:field" (box:box when a box is missing or extra)
  select coalesce(array_agg(w order by w), '{}') into v_wrong from (
    select b.key || ':' || f.key as w
      from jsonb_each(v_expected) b
     cross join lateral (
       select coalesce(e.key, s.key) as key
         from jsonb_each(b.value) e
         full join jsonb_each(case when jsonb_typeof(p_boxes -> b.key) = 'object' then p_boxes -> b.key else '{}'::jsonb end) s
           on s.key = e.key
        where e.value is distinct from s.value
     ) f
    union
    select k || ':box' from jsonb_object_keys(case when jsonb_typeof(p_boxes) = 'object' then p_boxes else '{}'::jsonb end) k
     where not v_expected ? k
  ) d;

  update public.scorebook_game_runs r set tries = r.tries + 1 where r.id = p_run_id returning * into v_run;
  return query select false, v_wrong, case when v_run.tries >= 3 then v_expected end, v_run.next_play, v_run.first_try;
end;
$$;

-- -----------------------------------------------------------------------------
-- Finish: every batter recorded, then the line score. A wrong line score can be
-- fixed; the right one ends the run. A clean book earns the hidden award.
-- -----------------------------------------------------------------------------
create function private.finish_scorebook_game(p_run_id uuid, p_line jsonb)
returns table (line_ok boolean, passed boolean, first_try smallint, award_earned boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_run    public.scorebook_game_runs;
  v_passed boolean;
  v_award  boolean := false;
begin
  select * into v_run from public.scorebook_game_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  if not private.can_act_for(v_run.player_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_run.finished_at is not null then
    return query select true, v_run.passed, v_run.first_try, false;
    return;
  end if;
  if v_run.next_play <= 15 then
    raise exception 'Score every batter first' using errcode = 'P0003';
  end if;
  if p_line is distinct from (select line from private.scorebook_game_line) then
    return query select false, false, v_run.first_try, false;
    return;
  end if;

  v_passed := v_run.first_try >= 12;
  update public.scorebook_game_runs set finished_at = now(), passed = v_passed where id = p_run_id;
  if v_passed then
    insert into public.player_hidden_awards (player_id, award) values (v_run.player_id, 'world-series')
    on conflict (player_id, award) do nothing;
    v_award := found;
  end if;
  return query select true, v_passed, v_run.first_try, v_award;
end;
$$;

revoke all on function private.start_scorebook_game(uuid, boolean), private.score_game_play(uuid, smallint, jsonb),
  private.finish_scorebook_game(uuid, jsonb) from public;
grant execute on function private.start_scorebook_game(uuid, boolean), private.score_game_play(uuid, smallint, jsonb),
  private.finish_scorebook_game(uuid, jsonb) to authenticated;

create function public.start_scorebook_game(p_player_id uuid, p_restart boolean default false)
returns setof public.scorebook_game_runs
language sql security invoker set search_path = '' as $$ select * from private.start_scorebook_game(p_player_id, p_restart) $$;
create function public.score_game_play(p_run_id uuid, p_play smallint, p_boxes jsonb)
returns table (correct boolean, wrong text[], answer jsonb, next_play smallint, first_try smallint)
language sql security invoker set search_path = '' as $$ select * from private.score_game_play(p_run_id, p_play, p_boxes) $$;
create function public.finish_scorebook_game(p_run_id uuid, p_line jsonb)
returns table (line_ok boolean, passed boolean, first_try smallint, award_earned boolean)
language sql security invoker set search_path = '' as $$ select * from private.finish_scorebook_game(p_run_id, p_line) $$;
revoke all on function public.start_scorebook_game(uuid, boolean), public.score_game_play(uuid, smallint, jsonb),
  public.finish_scorebook_game(uuid, jsonb) from public, anon;
grant execute on function public.start_scorebook_game(uuid, boolean), public.score_game_play(uuid, smallint, jsonb),
  public.finish_scorebook_game(uuid, jsonb) to authenticated;
