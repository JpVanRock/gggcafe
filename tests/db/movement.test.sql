-- Movement Preferences, Preferred Hitting Style (history kept) and GameDay
-- Prep access. Own users, removed at the end. Seed: team b1, season a1, c1
-- Avery Lopez #7 (claimed below), c2 Jordan Kim.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

insert into auth.users (id, email) values
  ('77777777-0000-0000-0000-000000000001', 'mp-coach@example.test'),
  ('77777777-0000-0000-0000-000000000002', 'mp-player@example.test'),
  ('77777777-0000-0000-0000-000000000003', 'mp-viewer@example.test');
insert into public.staff (user_id, display_name, role) values
  ('77777777-0000-0000-0000-000000000001', 'MP Coach', 'coach'),
  ('77777777-0000-0000-0000-000000000003', 'MP Viewer', 'viewer');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select '77777777-0000-0000-0000-000000000002', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r
 where r.player_id = '00000000-0000-0000-0000-0000000000c1' and r.team_id = '00000000-0000-0000-0000-0000000000b1';

-- Coach records movement preferences twice: history kept, latest wins
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"77777777-0000-0000-0000-000000000001"}', false);
insert into public.movement_preferences (player_id, move_style, power_side, dial_one, breathing, space)
values ('00000000-0000-0000-0000-0000000000c1', 'terrestrial', 'right', 'right_heel', 'out', 'axial');
insert into public.movement_preferences (player_id, move_style, power_side, dial_one, breathing, space, recorded_at)
values ('00000000-0000-0000-0000-0000000000c1', 'aerial', 'right', 'right_front', 'in', 'large', now() + interval '1 minute');
do $$ begin
  insert into public.movement_preferences (player_id, move_style) values ('00000000-0000-0000-0000-0000000000c1', 'floaty');
  raise exception 'FAIL: an unknown movement option was accepted';
exception when check_violation then null;
end $$;
insert into public.gameday_lineups (team_id, game_date, batting_order, defense)
values ('00000000-0000-0000-0000-0000000000b1', '2026-09-20', array['00000000-0000-0000-0000-0000000000c1'::uuid],
        '{"1": {"00000000-0000-0000-0000-0000000000c1": "SS"}}');
insert into public.gameday_profiles (team_id, season_id, player_id, hitting_type, base_running, avg)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'gap', 'pure', 0.412);
reset role;

-- Player: reads her movement history, can't add to it; owns her hitting style history
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"77777777-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('player sees both movement versions', (select count(*) from public.movement_preferences), 2::bigint),
       pg_temp.expect('latest version is current',
         (select move_style from public.movement_preferences order by recorded_at desc limit 1), 'aerial');
do $$ begin
  insert into public.movement_preferences (player_id, move_style) values ('00000000-0000-0000-0000-0000000000c1', 'terrestrial');
  raise exception 'FAIL: a player changed her movement preferences';
exception when insufficient_privilege then null;
end $$;
insert into public.hitting_styles (player_id, hands_height, load_stride) values ('00000000-0000-0000-0000-0000000000c1', 'high', 'toe_tap');
insert into public.hitting_styles (player_id, hands_height, load_stride) values ('00000000-0000-0000-0000-0000000000c1', 'low', 'leg_lift');
select pg_temp.expect('her changes are kept as history', (select count(*) from public.hitting_styles), 2::bigint),
       pg_temp.expect('change author is her', (select count(*) from public.hitting_styles where recorded_by = '77777777-0000-0000-0000-000000000002'), 2::bigint);
update public.hitting_styles set hands_height = 'high';
delete from public.hitting_styles;
do $$ begin
  insert into public.hitting_styles (player_id, hands_height) values ('00000000-0000-0000-0000-0000000000c2', 'high');
  raise exception 'FAIL: a player changed a teammate''s hitting style';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.hitting_styles (player_id, hands_height, recorded_by)
  values ('00000000-0000-0000-0000-0000000000c1', 'high', '77777777-0000-0000-0000-000000000001');
  raise exception 'FAIL: a player recorded a change in a coach''s name';
exception when insufficient_privilege then null;
end $$;
select pg_temp.expect('player cannot see GameDay Prep',
         (select count(*) from public.gameday_lineups) + (select count(*) from public.gameday_profiles), 0::bigint),
       pg_temp.expect('authors resolve for the history list',
         (select string_agg(name, ',') from public.change_authors(array['77777777-0000-0000-0000-000000000001'::uuid, '77777777-0000-0000-0000-000000000002'::uuid])),
         'MP Coach,Player');
reset role;
select pg_temp.expect('player could not rewrite or delete history',
  (select string_agg(hands_height, ',' order by recorded_at) from public.hitting_styles), 'high,low');

-- Viewer reads GameDay Prep, changes nothing
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"77777777-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('viewer reads lineups', (select count(*) from public.gameday_lineups), 1::bigint);
do $$ begin
  insert into public.hitting_styles (player_id, hands_height) values ('00000000-0000-0000-0000-0000000000c1', 'high');
  raise exception 'FAIL: a viewer changed a hitting style';
exception when insufficient_privilege then null;
end $$;
update public.gameday_lineups set opponent = 'viewer';
reset role;
select pg_temp.expect('viewer lineup edit had no effect', (select count(*) from public.gameday_lineups where opponent = 'viewer'), 0::bigint);
do $$ begin
  update public.gameday_lineups set status = 'final';
  raise exception 'FAIL: a lineup was final without finalized_at';
exception when check_violation then null;
end $$;

-- Clean up
delete from public.gameday_lineups; delete from public.gameday_profiles;
delete from public.hitting_styles; delete from public.movement_preferences;
delete from public.player_claims where user_id::text like '77777777-%';
delete from public.staff where user_id::text like '77777777-%';
delete from auth.users where id::text like '77777777-%';
