-- Parent codes (migration 20261117010048): a parent who joins with the parent code is approved at
-- once when the daughter's name matches one player on the current roster, and the head coaches are
-- told; everything else waits for the head coach. Players can't read the code or join as parents.
-- An approved parent fills in a missing birth date.
-- Seed: team b1 (season a1) = c1 Avery Lopez #7, c2 Jordan Kim #21, c3, c4.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

-- Runs a statement as the signed-in user and returns the error code ('' when it worked).
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
  ('fcfcfcfc-0000-0000-0000-000000000001', 'pc-head@example.test', '{}'),
  ('fcfcfcfc-0000-0000-0000-000000000002', 'pc-assist@example.test', '{}'),
  ('fcfcfcfc-0000-0000-0000-000000000003', 'pc-pat@example.test', '{"role": "parent"}'),
  ('fcfcfcfc-0000-0000-0000-000000000004', 'pc-sam@example.test', '{"role": "parent"}'),
  ('fcfcfcfc-0000-0000-0000-000000000005', 'pc-player@example.test', '{"role": "player"}'),
  ('fcfcfcfc-0000-0000-0000-000000000006', 'pc-declined@example.test', '{"role": "parent"}'),
  ('fcfcfcfc-0000-0000-0000-000000000007', 'pc-mentor@example.test', '{"role": "mentor"}');
insert into public.staff (user_id, display_name, role) values
  ('fcfcfcfc-0000-0000-0000-000000000001', 'Hana Head', 'coach'),
  ('fcfcfcfc-0000-0000-0000-000000000002', 'Sam Assist', 'assistant');
create temp table saved_team_code as select team_code from public.teams where id = '00000000-0000-0000-0000-0000000000b1';
create temp table saved_parent_code as select * from public.team_parent_codes where team_id = '00000000-0000-0000-0000-0000000000b1';
create temp table saved_birth as select birth_date from public.players where id = '00000000-0000-0000-0000-0000000000c2';
update public.players set birth_date = null where id = '00000000-0000-0000-0000-0000000000c2';
-- a player with her own account (an approved claim on c3)
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, status)
select 'fcfcfcfc-0000-0000-0000-000000000005', r.team_id, r.season_id, r.id, 'Casey Player', 'approved'
  from public.roster_entries r
 where r.player_id = '00000000-0000-0000-0000-0000000000c3' and r.team_id = '00000000-0000-0000-0000-0000000000b1'
 limit 1;

-- -----------------------------------------------------------------------------
-- The head coach sets the codes; a code is never both
-- -----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000001"}', false);
update public.teams set team_code = 'PCT234' where id = '00000000-0000-0000-0000-0000000000b1';
delete from public.team_parent_codes where team_id = '00000000-0000-0000-0000-0000000000b1';
insert into public.team_parent_codes (team_id, code) values ('00000000-0000-0000-0000-0000000000b1', 'PAR234');
select pg_temp.expect('a parent code can''t be a team code',
  pg_temp.err($$update public.team_parent_codes set code = 'PCT234' where team_id = '00000000-0000-0000-0000-0000000000b1'$$), '23505');
select pg_temp.expect('a team code can''t be a parent code',
  pg_temp.err($$update public.teams set team_code = 'PAR234' where id = '00000000-0000-0000-0000-0000000000b1'$$), '23505');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistants read the parent code',
  (select code from public.team_parent_codes where team_id = '00000000-0000-0000-0000-0000000000b1'), 'PAR234');
update public.team_parent_codes set code = 'ZZZ999' where team_id = '00000000-0000-0000-0000-0000000000b1';
reset role;
select pg_temp.expect('assistants can''t change it',
  (select code from public.team_parent_codes where team_id = '00000000-0000-0000-0000-0000000000b1'), 'PAR234');

-- Sign-up checks the parent code signed out, like the team code
set role anon;
select pg_temp.expect('sign-up finds the team by its parent code', (select name from public.signup_parent_team('par-234')), 'Sample Squad 14U');
select pg_temp.expect('the team code isn''t a parent code', (select count(*) from public.signup_parent_team('PCT234')), 0::bigint);
select pg_temp.expect('signed out, no one reads the codes', (select count(*) from public.team_parent_codes), 0::bigint);
reset role;

-- -----------------------------------------------------------------------------
-- A player can't read it or join as a parent
-- -----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000005"}', false);
select pg_temp.expect('a player can''t read the parent code', (select count(*) from public.team_parent_codes), 0::bigint);
insert into public.parent_accounts (display_name) values ('Casey Player');
select pg_temp.expect('a player can''t join as a parent',
  pg_temp.err($$select public.request_parent_link('PAR234', 'Avery Lopez')$$), 'P0011');
reset role;

-- -----------------------------------------------------------------------------
-- The parent code: approved at once when her name matches the roster
-- -----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000003"}', false);
insert into public.parent_accounts (display_name) values ('Pat Lopez');
select pg_temp.expect('joins with the parent code', public.request_parent_link('par 234', '  avery  LOPEZ '), 'Sample Squad 14U');
select pg_temp.expect('approved at once and matched to her',
  (select status || ' ' || player_name from public.parent_home()), 'approved Avery Lopez');
select public.request_parent_link('PAR234', 'Avery Lopez');
select pg_temp.expect('another spelling keeps one link', (select count(*) from public.parent_links), 1::bigint);
select public.request_parent_link('PAR234', 'Jordyn Kim');
select pg_temp.expect('a name that isn''t on the roster waits',
  (select status::text from public.parent_links where child_name = 'Jordyn Kim'), 'pending');
select pg_temp.expect('fixing the name matches her',
  public.rematch_parent_link((select id from public.parent_links where child_name = 'Jordyn Kim'), 'Jordan Kim')::text, 'approved');
select pg_temp.expect('only a waiting request can be fixed',
  pg_temp.err($$select public.rematch_parent_link((select id from public.parent_links where child_name = 'Jordan Kim'), 'X Y')$$), 'P0002');
reset role;
select pg_temp.expect('the head coach is told each time',
  (select count(*) from public.notifications where user_id = 'fcfcfcfc-0000-0000-0000-000000000001' and kind = 'parent-joined'), 2::bigint);
select pg_temp.expect('the notice names the parent and her',
  (select title from public.notifications where user_id = 'fcfcfcfc-0000-0000-0000-000000000001' and player_id = '00000000-0000-0000-0000-0000000000c1'),
  'Pat Lopez joined as Avery Lopez''s parent');
select pg_temp.expect('assistants aren''t',
  (select count(*) from public.notifications where user_id = 'fcfcfcfc-0000-0000-0000-000000000002'), 0::bigint);

-- -----------------------------------------------------------------------------
-- The team code still waits for the head coach; the parent code counts for the same request
-- -----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000004"}', false);
insert into public.parent_accounts (display_name) values ('Sam Kim');
select public.request_parent_link('PCT234', 'Jordan Kim');
select pg_temp.expect('the team code waits for the head coach', (select status::text from public.parent_home()), 'pending');
select pg_temp.expect('fixing the name doesn''t skip the head coach',
  public.rematch_parent_link((select id from public.parent_links), 'Jordan Kim')::text, 'pending');
select public.request_parent_link('PAR234', 'jordan kim');
select pg_temp.expect('then the parent code approves that request', (select status || ' ' || player_name from public.parent_home()), 'approved Jordan Kim');
select pg_temp.expect('still one request', (select count(*) from public.parent_links), 1::bigint);
reset role;

-- -----------------------------------------------------------------------------
-- A parent the head coach declined waits for the head coach; a few requests a team at most
-- -----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000006"}', false);
insert into public.parent_accounts (display_name) values ('Sly Stranger');
select public.request_parent_link('PCT234', 'Avery Lopez');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000001"}', false);
update public.parent_links set status = 'declined', decided_at = now() where parent_id = 'fcfcfcfc-0000-0000-0000-000000000006';
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000006"}', false);
select public.request_parent_link('PAR234', 'Avery Lopez');
select public.request_parent_link('PAR234', 'Avery  Lopez');
select pg_temp.expect('declined once: the parent code doesn''t let them in',
  (select string_agg(status::text, ' ' order by status) from public.parent_links), 'pending declined');
do $$ begin
  for i in 1..4 loop
    perform public.request_parent_link('PAR234', 'Name ' || i);
  end loop;
end $$;
select pg_temp.expect('six requests a team at most', pg_temp.err($$select public.request_parent_link('PAR234', 'Name 9')$$), '54000');
select pg_temp.expect('a parent who isn''t hers can''t set her birth date',
  pg_temp.err($$select public.set_daughter_birth_date('00000000-0000-0000-0000-0000000000c2', '2011-05-01')$$), '42501');
reset role;

-- -----------------------------------------------------------------------------
-- Her birth date, from her approved parent: only when it's missing
-- -----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('not a date in the future',
  pg_temp.err($$select public.set_daughter_birth_date('00000000-0000-0000-0000-0000000000c2', current_date + 1)$$), '22023');
select public.set_daughter_birth_date('00000000-0000-0000-0000-0000000000c2', '2011-05-01');
select pg_temp.expect('a date on her profile stays the coach''s',
  pg_temp.err($$select public.set_daughter_birth_date('00000000-0000-0000-0000-0000000000c2', '2011-06-01')$$), 'P0002');
reset role;
select pg_temp.expect('the date is on her profile',
  (select birth_date from public.players where id = '00000000-0000-0000-0000-0000000000c2'), '2011-05-01'::date);

-- -----------------------------------------------------------------------------
-- The one code for staff and mentors too (migration 20261117013057): an assistant coach finds the
-- team by it signed in, and a mentor asks with it and waits for the head coach
-- -----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000007"}', false);
select pg_temp.expect('signed in, the parent code finds the team', (select name from public.signup_parent_team('PAR234')), 'Sample Squad 14U');
select pg_temp.expect('a mentor asks with the parent code', public.request_mentor('par-234', ''), 'Sample Squad 14U');
select pg_temp.expect('a wrong code', pg_temp.err($$select public.request_mentor('NOPE99', '')$$), 'P0006');
reset role;
select pg_temp.expect('the mentor waits for the head coach',
  (select status::text from public.mentor_links where mentor_id = 'fcfcfcfc-0000-0000-0000-000000000007'), 'pending');

-- -----------------------------------------------------------------------------
-- Clean up
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '', false);
delete from public.notifications where kind = 'parent-joined';
delete from public.parent_links where parent_id::text like 'fcfcfcfc-%';
delete from public.parent_accounts where user_id::text like 'fcfcfcfc-%';
delete from public.player_claims where user_id::text like 'fcfcfcfc-%';
delete from public.mentor_links where mentor_id::text like 'fcfcfcfc-%';
delete from public.mentors where user_id::text like 'fcfcfcfc-%';
update public.players set birth_date = (select birth_date from saved_birth) where id = '00000000-0000-0000-0000-0000000000c2';
delete from public.team_parent_codes where team_id = '00000000-0000-0000-0000-0000000000b1';
insert into public.team_parent_codes select * from saved_parent_code;
update public.teams set team_code = (select team_code from saved_team_code) where id = '00000000-0000-0000-0000-0000000000b1';
delete from public.staff where user_id::text like 'fcfcfcfc-%';
delete from auth.users where id::text like 'fcfcfcfc-%';
