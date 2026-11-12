-- Team admins (user, 2026-11-12; migration 20261112133709): the head coach makes an approved
-- parent the team's team admin, who then edits that team's calendar, GameDay, box scores and
-- measurements, and nothing else. Seed: b1 is ours (c1 Avery, c2 Jordan, c3 Riley, c4 Morgan);
-- b2 isn't (d1, d2); game e1 is b1 at home against b2.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to authenticated;
create function pg_temp.err(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return '';
exception when others then
  return sqlstate;
end $$;
grant execute on function pg_temp.err(text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('e5e5e5e5-0000-0000-0000-000000000001', 'ta-head@example.test', '{}'),
  ('e5e5e5e5-0000-0000-0000-000000000002', 'ta-assistant@example.test', '{}'),
  ('e5e5e5e5-0000-0000-0000-000000000003', 'ta-parent@example.test', '{"role": "parent"}'),
  ('e5e5e5e5-0000-0000-0000-000000000004', 'ta-waiting@example.test', '{"role": "parent"}');
insert into public.staff (user_id, display_name, role) values
  ('e5e5e5e5-0000-0000-0000-000000000001', 'TA Head', 'coach'),
  ('e5e5e5e5-0000-0000-0000-000000000002', 'TA Assistant', 'assistant');
insert into public.parent_accounts (user_id, display_name) values
  ('e5e5e5e5-0000-0000-0000-000000000003', 'TA Parent'),
  ('e5e5e5e5-0000-0000-0000-000000000004', 'TA Waiting');
insert into public.parent_links (parent_id, team_id, child_name, player_id, status, decided_at) values
  ('e5e5e5e5-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '00000000-0000-0000-0000-0000000000c1', 'approved', now()),
  ('e5e5e5e5-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000b1', 'Riley Chen', null, 'pending', null);

-- Only a head coach names one, and only an approved parent of the team
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant can''t', pg_temp.err($$select public.set_team_admin('00000000-0000-0000-0000-0000000000b1', 'e5e5e5e5-0000-0000-0000-000000000003', true)$$), '42501');
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('not a waiting parent', pg_temp.err($$select public.set_team_admin('00000000-0000-0000-0000-0000000000b1', 'e5e5e5e5-0000-0000-0000-000000000004', true)$$), 'P0006');
select pg_temp.expect('not on another team', pg_temp.err($$select public.set_team_admin('00000000-0000-0000-0000-0000000000b2', 'e5e5e5e5-0000-0000-0000-000000000003', true)$$), 'P0006');
select public.set_team_admin('00000000-0000-0000-0000-0000000000b1', 'e5e5e5e5-0000-0000-0000-000000000003', true);
select pg_temp.expect('the head coach sees the team admin', (select count(*) from public.team_admins where team_id = '00000000-0000-0000-0000-0000000000b1'), 1::bigint);
reset role;

-- The team admin: their team's roster by name only, their calendar, GameDay and measurements
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('their team', (select string_agg(t::text, ',') from public.my_admin_team_ids() t), '00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect('the roster by name', (select count(*) from public.team_admin_roster('00000000-0000-0000-0000-0000000000b1', null)), 4::bigint);
select pg_temp.expect('not another team''s roster', pg_temp.err($$select * from public.team_admin_roster('00000000-0000-0000-0000-0000000000b2', null)$$), '42501');
select pg_temp.expect('teammates'' profiles stay closed (only her own daughter)', (select count(*) from public.players), 1::bigint);
select pg_temp.expect('no coach notes', (select count(*) from public.coach_notes), 0::bigint);
select pg_temp.expect('no medical cards', (select count(*) from public.medical_cards), 0::bigint);
insert into public.team_events (team_id, kind, title, event_date) values ('00000000-0000-0000-0000-0000000000b1', 'practice', 'TA practice', '2026-12-01');
update public.team_events set title = 'TA practice (moved)' where title = 'TA practice';
select pg_temp.expect('their calendar', (select count(*) from public.team_events where title = 'TA practice (moved)'), 1::bigint);
select pg_temp.expect('not another team''s calendar', pg_temp.err($$insert into public.team_events (team_id, event_date) values ('00000000-0000-0000-0000-0000000000b2', '2026-12-01')$$), '42501');
insert into public.measurements (player_id, metric_key, value, measured_on) values ('00000000-0000-0000-0000-0000000000c2', 'home_to_first', 3.1, '2026-11-10');
select pg_temp.expect('a teammate''s measurement', (select count(*) from public.measurements where player_id = '00000000-0000-0000-0000-0000000000c2' and value = 3.1), 1::bigint);
select pg_temp.expect('not another team''s player', pg_temp.err($$insert into public.measurements (player_id, metric_key, value) values ('00000000-0000-0000-0000-0000000000d1', 'home_to_first', 3.0)$$), '42501');
insert into public.gameday_lineups (team_id, game_date, title) values ('00000000-0000-0000-0000-0000000000b1', '2026-12-05', 'TA lineup');
select pg_temp.expect('their GameDay', (select count(*) from public.gameday_lineups where title = 'TA lineup'), 1::bigint);
select pg_temp.expect('not another team''s GameDay', pg_temp.err($$insert into public.gameday_lineups (team_id, game_date) values ('00000000-0000-0000-0000-0000000000b2', '2026-12-05')$$), '42501');
insert into public.depth_chart (team_id, position, player_id, rank) values ('00000000-0000-0000-0000-0000000000b1', 'RF', '00000000-0000-0000-0000-0000000000c1', 9);
select pg_temp.expect('their depth chart', (select count(*) from public.depth_chart where team_id = '00000000-0000-0000-0000-0000000000b1' and rank = 9), 1::bigint);
select pg_temp.expect('not the culture', pg_temp.err($$insert into public.team_standards (team_id, title, position) values ('00000000-0000-0000-0000-0000000000b1', 'x', 25)$$), '42501');
select pg_temp.expect('not the roster', pg_temp.err($$update public.roster_entries set jersey_number = '99' where team_id = '00000000-0000-0000-0000-0000000000b1'$$) ||
  (select count(*) from public.roster_entries where jersey_number = '99')::text, '0');
select pg_temp.expect('can''t make others team admin', pg_temp.err($$select public.set_team_admin('00000000-0000-0000-0000-0000000000b1', 'e5e5e5e5-0000-0000-0000-000000000004', true)$$), '42501');
-- box scores: their team's side of a game, and the final score (rolled back, the seed's lines stay)
begin;
select public.save_box_score('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1',
  '{"us": 7, "them": 2, "batting": [{"player_id": "00000000-0000-0000-0000-0000000000c1", "pa": 4, "ab": 3, "r": 1, "h": 2, "d": 0, "t": 0, "hr": 0, "rbi": 1, "bb": 1, "so": 0, "hbp": 0, "sac": 0, "sf": 0, "sb": 0, "cs": 0}]}');
select pg_temp.expect('their box score', (select home_score from public.games where id = '00000000-0000-0000-0000-0000000000e1'), 7::smallint);
rollback;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('not the other team''s side', pg_temp.err($$select public.save_box_score('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b2', '{}')$$), '42501');
reset role;

-- The role lapses with the parent link
update public.parent_links set status = 'declined' where parent_id = 'e5e5e5e5-0000-0000-0000-000000000003';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('no longer a team admin', (select count(*) from public.my_admin_team_ids()), 0::bigint);
select pg_temp.expect('the calendar closes', pg_temp.err($$insert into public.team_events (team_id, event_date) values ('00000000-0000-0000-0000-0000000000b1', '2026-12-02')$$), '42501');
reset role;

-- The head coach takes it back
update public.parent_links set status = 'approved' where parent_id = 'e5e5e5e5-0000-0000-0000-000000000003';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000001"}', false);
select public.set_team_admin('00000000-0000-0000-0000-0000000000b1', 'e5e5e5e5-0000-0000-0000-000000000003', false);
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('taken back', (select count(*) from public.my_admin_team_ids()), 0::bigint);
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.team_events where title like 'TA practice%';
delete from public.measurements where player_id = '00000000-0000-0000-0000-0000000000c2' and value = 3.1;
delete from public.gameday_lineups where title = 'TA lineup';
delete from public.depth_chart where team_id = '00000000-0000-0000-0000-0000000000b1' and rank = 9;
delete from public.team_admins where user_id::text like 'e5e5e5e5-%';
delete from public.parent_links where parent_id::text like 'e5e5e5e5-%';
delete from public.parent_accounts where user_id::text like 'e5e5e5e5-%';
delete from public.staff where user_id::text like 'e5e5e5e5-%';
delete from auth.users where id::text like 'e5e5e5e5-%';
