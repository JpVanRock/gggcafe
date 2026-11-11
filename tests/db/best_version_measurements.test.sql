-- The Best Version of You (her answers on the Goals page), the team's extra measurements,
-- the new default metrics, and the questionnaire's sock size. Own users, removed at the
-- end. Seed: c1 Avery Lopez #7 (team b1).
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

create function pg_temp.err(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return '';
exception when others then
  return sqlstate;
end $$;
grant execute on function pg_temp.err(text) to authenticated, anon;

insert into auth.users (id, email) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'best-player@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'best-coach@example.test');
insert into public.staff (user_id, display_name, role) values ('bbbbbbbb-0000-0000-0000-000000000002', 'Best Coach', 'coach');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'bbbbbbbb-0000-0000-0000-000000000001', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r
 where r.player_id = '00000000-0000-0000-0000-0000000000c1' and r.team_id = '00000000-0000-0000-0000-0000000000b1';

-- The new default measurements exist
select pg_temp.expect('the new defaults are metrics',
  (select count(*) from public.metrics where key in ('first_to_second', 'first_to_home', 'throw_velo_overhand', 'rotational_acceleration', 'connection_score', 'on_plane_score')),
  6::bigint);

-- She keeps her own Best Version answers, and only hers
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('she saves her answers',
  pg_temp.err($$insert into public.player_best_version (player_id, answers) values ('00000000-0000-0000-0000-0000000000c1', '{"want":"Start at short"}')$$), '');
select pg_temp.expect('not a teammate''s',
  pg_temp.err($$insert into public.player_best_version (player_id, answers) values ('00000000-0000-0000-0000-0000000000c2', '{"want":"x"}')$$), '42501');
select pg_temp.expect('answers are an object', pg_temp.err($$update public.player_best_version set answers = '[1]'$$), '23514');
-- her team's extra measurements: she reads them, can't change them
reset role;
insert into public.team_measurements (team_id, metric_key) values ('00000000-0000-0000-0000-0000000000b1', 'exit_velo_tee');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('she reads her team''s list', (select count(*) from public.team_measurements), 1::bigint);
select pg_temp.expect('she can''t add to it',
  pg_temp.err($$insert into public.team_measurements (team_id, metric_key) values ('00000000-0000-0000-0000-0000000000b1', 'bat_speed')$$), '42501');
reset role;

-- Coaches read her answers and write the team's list
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('coach reads her answers', (select answers ->> 'want' from public.player_best_version where player_id = '00000000-0000-0000-0000-0000000000c1'), 'Start at short');
select pg_temp.expect('coach adds to the team list',
  pg_temp.err($$insert into public.team_measurements (team_id, metric_key, position) values ('00000000-0000-0000-0000-0000000000b1', 'bat_speed', 1)$$), '');
reset role;

-- The questionnaire asks sock size; jacket and hat are gone
select pg_temp.expect('sock size column',
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'player_questionnaires' and column_name = 'sock_size'), 1::bigint);
select pg_temp.expect('no jacket or hat',
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'player_questionnaires' and column_name in ('jacket_size', 'hat_size')), 0::bigint);

-- Clean up
delete from public.team_measurements where team_id = '00000000-0000-0000-0000-0000000000b1';
delete from public.player_best_version where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_claims where user_id = 'bbbbbbbb-0000-0000-0000-000000000001';
delete from public.staff where user_id::text like 'bbbbbbbb-%';
delete from auth.users where id::text like 'bbbbbbbb-%';
