-- How to Keep the Book game: opens after six chapters, every play graded against
-- the private key, batters in order, answer shown after three wrong tries, and
-- a clean book (12+ first try, right line score) earns the hidden award, which
-- only the database can write. Own user, removed at the end.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

create temp table all_keys as select game, play, boxes from private.scorebook_game_key;
create temp table all_lines as select game, line from private.scorebook_game_line;
create temp table game_key as select play, boxes from all_keys where game = 1;
grant select on all_keys, all_lines, game_key to authenticated;
select pg_temp.expect('ten games of 15 plays', (select count(*) || '/' || count(distinct game) from all_keys), '150/10');

insert into auth.users (id, email) values ('88888888-0000-0000-0000-000000000001', 'gamer@example.test');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select '88888888-0000-0000-0000-000000000001', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r
 where r.player_id = '00000000-0000-0000-0000-0000000000c1' and r.team_id = '00000000-0000-0000-0000-0000000000b1';

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"88888888-0000-0000-0000-000000000001"}', false);
do $$ begin
  perform public.start_scorebook_game('00000000-0000-0000-0000-0000000000c1');
  raise exception 'FAIL: the game opened before the six chapters';
exception when sqlstate 'P0001' then null;
end $$;
do $$ begin
  perform 1 from private.scorebook_game_key;
  raise exception 'FAIL: a player read the game key';
exception when insufficient_privilege then null;
end $$;
reset role;
insert into public.player_manager_awards (player_id, chapter) select '00000000-0000-0000-0000-0000000000c1', g from generate_series(1, 6) g;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"88888888-0000-0000-0000-000000000001"}', false);
do $$
declare run public.scorebook_game_runs; r record; k record;
begin
  begin
    perform public.start_scorebook_game('00000000-0000-0000-0000-0000000000c1', 2::smallint);
    raise exception 'FAIL: game 2 opened before a clean book in game 1';
  exception when sqlstate 'P0004' then null;
  end;
  select * into run from public.start_scorebook_game('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.expect('starts game 1 at batter 1', run.game || ' ' || run.next_play, '1 1');

  -- a wrong box: told which marks to check, no answer yet
  select * into r from public.score_game_play(run.id, 1::smallint, '{"V1-1":{"hit":2,"path":1}}');
  perform pg_temp.expect('wrong hit flagged', r.correct::text || ' ' || array_to_string(r.wrong, ','), 'false V1-1:hit');
  perform pg_temp.expect('no answer after one try', r.answer, null::jsonb);
  begin
    perform public.score_game_play(run.id, 2::smallint, '{}');
    raise exception 'FAIL: scored a batter out of order';
  exception when sqlstate 'P0008' then null;
  end;
  select * into r from public.score_game_play(run.id, 1::smallint, '{}');
  select * into r from public.score_game_play(run.id, 1::smallint, '{"V1-1":{}}');
  perform pg_temp.expect('answer shown after three tries', r.answer, (select boxes from game_key where play = 1));

  -- the rest of the game, right the first time
  for k in select play, boxes from game_key order by play loop
    select * into r from public.score_game_play(run.id, k.play, k.boxes);
    perform pg_temp.expect('play ' || k.play || ' right', r.correct, true);
  end loop;
  perform pg_temp.expect('14 of 15 on the first try', r.first_try, 14::smallint);
  select * into run from public.scorebook_game_runs where id = run.id;
  perform pg_temp.expect('her book has every box', (select count(*) from jsonb_object_keys(run.book)), 15::bigint);

  select * into r from public.finish_scorebook_game(run.id, '{"V":[1,0],"H":[0,1]}');
  perform pg_temp.expect('wrong line score can be fixed', r.line_ok::text || ' ' || r.passed, 'false false');
  select * into r from public.finish_scorebook_game(run.id, '{"V":[1,0],"H":[0,2]}');
  perform pg_temp.expect('clean book earns the award', r.line_ok::text || ' ' || r.passed || ' ' || r.award_earned || ' ' || r.all_ten_earned, 'true true true false');
end $$;
select pg_temp.expect('she sees her hidden award', (select count(*) from public.player_hidden_awards where award = 'world-series'), 1::bigint);
do $$ begin
  insert into public.player_hidden_awards (player_id, award) values ('00000000-0000-0000-0000-0000000000c1', 'world-series');
  raise exception 'FAIL: a player wrote her own hidden award';
exception when insufficient_privilege then null;
end $$;
update public.scorebook_game_runs set first_try = 15;
select pg_temp.expect('players can''t edit a run', (select count(*) from public.scorebook_game_runs where first_try = 15), 0::bigint);

-- a messy book (4 misses) finishes but isn't clean
do $$
declare run public.scorebook_game_runs; r record; k record;
begin
  select * into run from public.start_scorebook_game('00000000-0000-0000-0000-0000000000c1');
  for k in select play, boxes from game_key order by play loop
    if k.play <= 4 then perform public.score_game_play(run.id, k.play, '{}'); end if;
    select * into r from public.score_game_play(run.id, k.play, k.boxes);
  end loop;
  select * into r from public.finish_scorebook_game(run.id, '{"V":[1,0],"H":[0,2]}');
  perform pg_temp.expect('11 first try is not clean', r.first_try || ' ' || r.passed, '11 false');
end $$;

-- games 2-10, each clean: the World Series Trophy isn't given twice; the tenth earns all-ten
do $$
declare run public.scorebook_game_runs; r record; k record; g int;
begin
  for g in 2..10 loop
    select * into run from public.start_scorebook_game('00000000-0000-0000-0000-0000000000c1', g::smallint);
    for k in select play, boxes from all_keys where game = g order by play loop
      select * into r from public.score_game_play(run.id, k.play, k.boxes);
      perform pg_temp.expect('game ' || g || ' play ' || k.play, r.correct, true);
    end loop;
    select * into r from public.finish_scorebook_game(run.id, (select line from all_lines where game = g));
    perform pg_temp.expect('game ' || g || ' clean', r.passed::text || ' ' || r.award_earned || ' ' || r.all_ten_earned,
      'true false ' || (g = 10)::text);
  end loop;
end $$;
select pg_temp.expect('both hidden awards', (select string_agg(award, ',' order by award) from public.player_hidden_awards), 'all-ten,world-series');
reset role;

-- Clean up
delete from public.player_hidden_awards where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.scorebook_game_runs where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_manager_awards where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_claims where user_id = '88888888-0000-0000-0000-000000000001';
delete from auth.users where id = '88888888-0000-0000-0000-000000000001';
