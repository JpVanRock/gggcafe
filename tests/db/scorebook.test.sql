-- How to Keep the Book: chapter quizzes open after the lessons, chapters unlock in
-- order, 80%+ earns Manager of the Year (written only by the database), and course
-- quizzes don't earn MVP badges. Own user, removed at the end. Seed: team b1,
-- season a1, c1 Avery Lopez #7, c2 Jordan Kim #21.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

-- an earlier test hides most test questions; this one needs the course quizzes
update public.iq_questions set active = true where track = 'scorebook';
-- the answer key, for answering in the test (players can't read it)
create temp table sb_key as select id, level, correct_index from public.iq_questions where track = 'scorebook' and active;
grant select on sb_key to authenticated;
select pg_temp.expect('5 questions in each chapter', (select count(*) from sb_key where level = 1), 5::bigint),
       pg_temp.expect('6 chapters', (select count(distinct level) from sb_key), 6::bigint);

insert into auth.users (id, email) values ('77777777-0000-0000-0000-000000000001', 'scorer@example.test');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select '77777777-0000-0000-0000-000000000001', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r
 where r.player_id = '00000000-0000-0000-0000-0000000000c1' and r.team_id = '00000000-0000-0000-0000-0000000000b1';

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"77777777-0000-0000-0000-000000000001"}', false);

do $$ begin
  perform public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'scorebook', 1::smallint);
  raise exception 'FAIL: the quiz opened before the lessons were finished';
exception when sqlstate 'P0005' then null;
end $$;
do $$ begin
  perform public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'scorebook', 7::smallint);
  raise exception 'FAIL: started a chapter 7';
exception when sqlstate '22023' then null;
end $$;

-- she reads Chapter 1 and finishes it
insert into public.player_scorebook_progress (player_id, chapter, step) values ('00000000-0000-0000-0000-0000000000c1', 1, 3);
update public.player_scorebook_progress set step = 7, completed_at = now()
 where player_id = '00000000-0000-0000-0000-0000000000c1' and chapter = 1;
select pg_temp.expect('her progress saved', (select step from public.player_scorebook_progress where chapter = 1), 7::smallint);
do $$ begin
  insert into public.player_scorebook_progress (player_id, chapter) values ('00000000-0000-0000-0000-0000000000c2', 1);
  raise exception 'FAIL: wrote a teammate''s course progress';
exception when insufficient_privilege then null;
end $$;

-- Chapter 2 stays locked until Chapter 1's award
insert into public.player_scorebook_progress (player_id, chapter, step, completed_at) values ('00000000-0000-0000-0000-0000000000c1', 2, 6, now());
do $$ begin
  perform public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'scorebook', 2::smallint);
  raise exception 'FAIL: Chapter 2 opened before Chapter 1 was complete';
exception when sqlstate 'P0001' then null;
end $$;
do $$ begin
  insert into public.player_manager_awards (player_id, chapter) values ('00000000-0000-0000-0000-0000000000c1', 1);
  raise exception 'FAIL: a player gave herself Manager of the Year';
exception when insufficient_privilege then null;
end $$;

-- Chapter 1 quiz: 3 of 5 fails, then 4 of 5 passes and earns the award
do $$
declare x uuid; r record; q record; n int := 0;
begin
  x := public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'scorebook', 1::smallint);
  for q in select k.id, k.correct_index from sb_key k where k.level = 1 order by k.id loop
    n := n + 1;
    perform public.record_iq_answer('00000000-0000-0000-0000-0000000000c1', q.id,
      (case when n <= 3 then q.correct_index else (q.correct_index + 1) % 4 end)::smallint, x);
  end loop;
  select * into r from public.finish_iq_level(x);
  perform pg_temp.expect('3/5 fails', r.correct || '/' || r.total || ' ' || r.passed || ' ' || r.award_earned, '3/5 false false');

  x := public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'scorebook', 1::smallint);
  n := 0;
  for q in select k.id, k.correct_index from sb_key k where k.level = 1 order by k.id loop
    n := n + 1;
    perform public.record_iq_answer('00000000-0000-0000-0000-0000000000c1', q.id,
      (case when n <= 4 then q.correct_index else (q.correct_index + 1) % 4 end)::smallint, x);
  end loop;
  select * into r from public.finish_iq_level(x);
  perform pg_temp.expect('4/5 passes and earns Manager of the Year', r.correct || '/' || r.total || ' ' || r.award_earned, '4/5 true');
end $$;
select pg_temp.expect('sees her award', (select count(*) from public.player_manager_awards where chapter = 1), 1::bigint);

-- Chapter 2 opens; a perfect score earns its award but no MVP badge
do $$
declare x uuid; r record; q record;
begin
  x := public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'scorebook', 2::smallint);
  for q in select k.id, k.correct_index from sb_key k where k.level = 2 loop
    perform public.record_iq_answer('00000000-0000-0000-0000-0000000000c1', q.id, q.correct_index::smallint, x);
  end loop;
  select * into r from public.finish_iq_level(x);
  perform pg_temp.expect('5/5 on Chapter 2', r.correct || '/' || r.total || ' ' || r.award_earned, '5/5 true');
end $$;
select pg_temp.expect('two Manager of the Year awards', (select count(*) from public.player_manager_awards), 2::bigint),
       pg_temp.expect('no MVP badge for course quizzes', (select count(*) from public.player_mvp_badges where track = 'scorebook'), 0::bigint);
reset role;

-- Clean up
delete from public.player_manager_awards where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.iq_answers where attempt_id in (select id from public.iq_level_attempts where track = 'scorebook');
delete from public.iq_level_attempts where track = 'scorebook';
delete from public.player_scorebook_progress;
delete from public.player_claims where user_id = '77777777-0000-0000-0000-000000000001';
delete from auth.users where id = '77777777-0000-0000-0000-000000000001';
