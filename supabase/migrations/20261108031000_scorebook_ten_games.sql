-- =============================================================================
-- GGG.Cafe — How to Keep the Book: ten games, and a second hidden award
--
-- The extra-credit game becomes ten games (play-by-play in
-- src/lib/scorebook-game.ts, keys in supabase/iq/scorebook-games.json). They open
-- in order: game n once game n-1 has a clean book. A player can replay any game
-- she's opened. The first clean book in any game still earns the hidden GGG World
-- Series Trophy; clean books in all ten earn a second hidden award, 'all-ten'
-- (the GGG Dynasty Trophy; the name lives in the app so it can change).
-- =============================================================================

alter table public.player_hidden_awards drop constraint player_hidden_awards_award_check;
alter table public.player_hidden_awards
  add constraint player_hidden_awards_award_check check (award in ('world-series', 'all-ten'));
comment on table public.player_hidden_awards is
  'Easter-egg awards. world-series: a clean book in a How to Keep the Book game. all-ten: clean books in all ten games.';

alter table public.scorebook_game_runs add column game smallint not null default 1 check (game between 1 and 10);
drop index public.scorebook_game_runs_one_open;
create unique index scorebook_game_runs_one_open on public.scorebook_game_runs (player_id, game) where finished_at is null;

-- keys per game
alter table private.scorebook_game_key add column game smallint not null default 1 check (game between 1 and 10);
alter table private.scorebook_game_key drop constraint scorebook_game_key_pkey;
alter table private.scorebook_game_key add primary key (game, play);
drop table private.scorebook_game_line;
create table private.scorebook_game_line (
  game smallint primary key check (game between 1 and 10),
  line jsonb not null
);
revoke all on private.scorebook_game_line from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Start (or resume) one game. All six chapters first; game n needs a clean book
-- in game n-1.
-- -----------------------------------------------------------------------------
drop function public.start_scorebook_game(uuid, boolean);
drop function private.start_scorebook_game(uuid, boolean);
create function private.start_scorebook_game(p_player_id uuid, p_game smallint default 1, p_restart boolean default false)
returns setof public.scorebook_game_runs
language plpgsql security definer set search_path = '' as $$
declare
  v_run public.scorebook_game_runs;
begin
  if not private.can_act_for(p_player_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_game is null or p_game < 1 or p_game > 10 then
    raise exception 'games are numbered 1-10' using errcode = '22023';
  end if;
  if (select count(*) from public.player_manager_awards where player_id = p_player_id) < 6 then
    raise exception 'Finish all six chapters first' using errcode = 'P0001';
  end if;
  if p_game > 1 and not exists (
    select 1 from public.scorebook_game_runs where player_id = p_player_id and game = p_game - 1 and passed
  ) then
    raise exception 'Game % opens after a clean book in game %', p_game, p_game - 1 using errcode = 'P0004';
  end if;
  select * into v_run from public.scorebook_game_runs where player_id = p_player_id and game = p_game and finished_at is null;
  if v_run.id is not null and p_restart then
    delete from public.scorebook_game_runs where id = v_run.id;
    v_run := null;
  end if;
  if v_run.id is null then
    insert into public.scorebook_game_runs (player_id, game) values (p_player_id, p_game) returning * into v_run;
  end if;
  return next v_run;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grade one play of the run's game (same rules as before).
-- -----------------------------------------------------------------------------
create or replace function private.score_game_play(p_run_id uuid, p_play smallint, p_boxes jsonb)
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
  select k.boxes into v_expected from private.scorebook_game_key k where k.game = v_run.game and k.play = p_play;
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
-- Finish: the line score for the run's game. A clean book earns the World Series
-- Trophy the first time, and the all-ten award once all ten games are clean.
-- -----------------------------------------------------------------------------
drop function public.finish_scorebook_game(uuid, jsonb);
drop function private.finish_scorebook_game(uuid, jsonb);
create function private.finish_scorebook_game(p_run_id uuid, p_line jsonb)
returns table (line_ok boolean, passed boolean, first_try smallint, award_earned boolean, all_ten_earned boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_run    public.scorebook_game_runs;
  v_passed boolean;
  v_award  boolean := false;
  v_ten    boolean := false;
begin
  select * into v_run from public.scorebook_game_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  if not private.can_act_for(v_run.player_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_run.finished_at is not null then
    return query select true, v_run.passed, v_run.first_try, false, false;
    return;
  end if;
  if v_run.next_play <= 15 then
    raise exception 'Score every batter first' using errcode = 'P0003';
  end if;
  if p_line is distinct from (select l.line from private.scorebook_game_line l where l.game = v_run.game) then
    return query select false, false, v_run.first_try, false, false;
    return;
  end if;

  v_passed := v_run.first_try >= 12;
  update public.scorebook_game_runs set finished_at = now(), passed = v_passed where id = p_run_id;
  if v_passed then
    insert into public.player_hidden_awards (player_id, award) values (v_run.player_id, 'world-series')
    on conflict (player_id, award) do nothing;
    v_award := found;
    if (select count(distinct r.game) from public.scorebook_game_runs r where r.player_id = v_run.player_id and r.passed) = 10 then
      insert into public.player_hidden_awards (player_id, award) values (v_run.player_id, 'all-ten')
      on conflict (player_id, award) do nothing;
      v_ten := found;
    end if;
  end if;
  return query select true, v_passed, v_run.first_try, v_award, v_ten;
end;
$$;

revoke all on function private.start_scorebook_game(uuid, smallint, boolean), private.finish_scorebook_game(uuid, jsonb) from public;
grant execute on function private.start_scorebook_game(uuid, smallint, boolean), private.finish_scorebook_game(uuid, jsonb) to authenticated;

create function public.start_scorebook_game(p_player_id uuid, p_game smallint default 1, p_restart boolean default false)
returns setof public.scorebook_game_runs
language sql security invoker set search_path = '' as $$ select * from private.start_scorebook_game(p_player_id, p_game, p_restart) $$;
create function public.finish_scorebook_game(p_run_id uuid, p_line jsonb)
returns table (line_ok boolean, passed boolean, first_try smallint, award_earned boolean, all_ten_earned boolean)
language sql security invoker set search_path = '' as $$ select * from private.finish_scorebook_game(p_run_id, p_line) $$;
revoke all on function public.start_scorebook_game(uuid, smallint, boolean), public.finish_scorebook_game(uuid, jsonb) from public, anon;
grant execute on function public.start_scorebook_game(uuid, smallint, boolean), public.finish_scorebook_game(uuid, jsonb) to authenticated;
