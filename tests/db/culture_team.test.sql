-- Culture & team (Phase 5): the motto, season goals and spotlights are head-coach
-- writes that players on the team read; each player keeps her own pledge.
-- Seed: team b1 (season a1, culture + standards), c1 Avery #7; team b2 is an opponent.
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
grant execute on function pg_temp.err(text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('efefefef-0000-0000-0000-000000000001', 'head-c@example.test', '{}'),
  ('efefefef-0000-0000-0000-000000000002', 'assist-c@example.test', '{}'),
  ('efefefef-0000-0000-0000-000000000003', 'avery-c@example.test', '{"role": "player"}');
insert into public.staff (user_id, display_name, role) values
  ('efefefef-0000-0000-0000-000000000001', 'C Head', 'coach'),
  ('efefefef-0000-0000-0000-000000000002', 'C Assistant', 'assistant');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'efefefef-0000-0000-0000-000000000003', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c1';
create temp table saved_motto as select motto from public.team_culture where team_id = '00000000-0000-0000-0000-0000000000b1';
grant select on saved_motto to authenticated;

-- The head coach sets the motto, a goal and a spotlight; the assistant can't
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"efefefef-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant can''t add goals', pg_temp.err($$insert into public.team_goals (team_id, title) values ('00000000-0000-0000-0000-0000000000b1', 'x')$$), '42501');
select pg_temp.expect('assistant can''t write spotlights', pg_temp.err($$insert into public.player_spotlights (team_id, player_id, player_name, headline, body) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Avery Lopez', 'h', 'b')$$), '42501');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"efefefef-0000-0000-0000-000000000001"}', false);
update public.team_culture set motto = 'Every pitch' where team_id = '00000000-0000-0000-0000-0000000000b1';
insert into public.team_goals (id, team_id, phase, title, target, current, unit)
values ('efefefef-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'season', 'Win 25 games', 25, 3, 'wins');
insert into public.player_spotlights (id, team_id, player_id, player_name, jersey, headline, body)
values ('efefefef-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2', 'Jordan Kim', '21', 'Ace of the staff', 'She competes every pitch.');
select pg_temp.expect('bad goal phase', pg_temp.err($$insert into public.team_goals (team_id, phase, title) values ('00000000-0000-0000-0000-0000000000b1', 'winter', 'x')$$), '23514');
reset role;
select pg_temp.expect('motto saved', (select motto from public.team_culture where team_id = '00000000-0000-0000-0000-0000000000b1'), 'Every pitch');

-- Avery reads them, keeps her own pledge, and can't touch the goals
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"efefefef-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('she reads the goals', (select title from public.team_goals where id = 'efefefef-0000-0000-0000-0000000000a1'), 'Win 25 games');
select pg_temp.expect('she reads the spotlight', (select headline from public.player_spotlights where id = 'efefefef-0000-0000-0000-0000000000b1'), 'Ace of the staff');
select pg_temp.expect('she reads the motto', (select motto from public.team_culture where team_id = '00000000-0000-0000-0000-0000000000b1'), 'Every pitch');
update public.team_goals set current = 25 where id = 'efefefef-0000-0000-0000-0000000000a1';
insert into public.team_pledges (player_id, team_id, season_id, lines, signed_name, signed_at)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
        '{"Be early": "I will be on the field at 5:15"}', 'Avery Lopez', now());
select pg_temp.expect('signing needs a name', pg_temp.err($$update public.team_pledges set signed_name = null where player_id = '00000000-0000-0000-0000-0000000000c1'$$), '23514');
select pg_temp.expect('not another player''s pledge', pg_temp.err($$insert into public.team_pledges (player_id, team_id, season_id) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1')$$), '42501');
select pg_temp.expect('not for another team', pg_temp.err($$insert into public.team_pledges (player_id, team_id, season_id) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1')$$), '42501');
reset role;
select pg_temp.expect('her update to the goal did nothing', (select current from public.team_goals where id = 'efefefef-0000-0000-0000-0000000000a1'), 3.00::numeric);

-- The head coach sees the pledge
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"efefefef-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('coach sees the pledge', (select signed_name from public.team_pledges where player_id = '00000000-0000-0000-0000-0000000000c1'), 'Avery Lopez');
update public.team_culture set motto = (select motto from saved_motto) where team_id = '00000000-0000-0000-0000-0000000000b1';
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.team_pledges where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_spotlights where id::text like 'efefefef-%';
delete from public.team_goals where id::text like 'efefefef-%';
delete from public.player_claims where user_id::text like 'efefefef-%';
delete from public.staff where user_id::text like 'efefefef-%';
delete from auth.users where id::text like 'efefefef-%';
