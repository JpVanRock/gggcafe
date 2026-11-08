-- Account types: coach sign-ups (head coaches approved by an admin, assistants by
-- a head coach), what assistants can't change (culture, GameDay, parents, mentors,
-- other coaches' practice plans), and parent-made username logins for players.
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
  ('dddddddd-0000-0000-0000-000000000001', 'head@example.test', '{}'),
  ('dddddddd-0000-0000-0000-000000000002', 'assist@example.test', '{"role": "assistant-coach"}'),
  ('dddddddd-0000-0000-0000-000000000003', 'admin@example.test', '{}'),
  ('dddddddd-0000-0000-0000-000000000004', 'parent@example.test', '{"role": "parent"}'),
  ('dddddddd-0000-0000-0000-000000000005', 'newhead@example.test', '{"role": "head-coach"}'),
  ('dddddddd-0000-0000-0000-000000000006', 'stranger@example.test', '{"role": "parent"}');
insert into public.staff (user_id, display_name, role) values
  ('dddddddd-0000-0000-0000-000000000001', 'Hana Head', 'coach'),
  ('dddddddd-0000-0000-0000-000000000003', 'Ada Admin', 'admin');
create temp table saved_code as select parent_code from public.teams where id = '00000000-0000-0000-0000-0000000000b1';
grant select on saved_code to authenticated;

-- -----------------------------------------------------------------------------
-- Coach sign-ups
-- -----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant asks', public.request_staff_access('assistant', 'Sam Assist', '00000000-0000-0000-0000-0000000000b1'), 'pending');
select pg_temp.expect('asking again keeps one request', public.request_staff_access('assistant', 'Sam Assist', '00000000-0000-0000-0000-0000000000b1'), 'pending');
select pg_temp.expect('not staff yet: no players', (select count(*) from public.players), 0::bigint);
select pg_temp.expect('she sees her request', (select status from public.staff_requests), 'pending');
select pg_temp.expect('she can''t approve herself', pg_temp.err($$select public.decide_staff_request('dddddddd-0000-0000-0000-000000000002', true)$$), '42501');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000005"}', false);
select pg_temp.expect('a head coach asks', public.request_staff_access('coach', 'Hank Head', null, 'River City Club'), 'pending');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000006"}', false);
select pg_temp.expect('an assistant must pick a team', pg_temp.err($$select public.request_staff_access('assistant', 'X Y', null)$$), '22023');
select pg_temp.expect('a made-up role', pg_temp.err($$select public.request_staff_access('admin', 'X Y', null)$$), '22023');
reset role;

-- A head coach sees and approves the assistant, but not the head coach
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('head coach sees the assistant only', (select string_agg(display_name || '/' || role || '/' || coalesce(team_name, '-'), ',') from public.staff_requests_to_decide()), 'Sam Assist/assistant/Sample Squad 14U');
select pg_temp.expect('head coach can''t approve a head coach', pg_temp.err($$select public.decide_staff_request('dddddddd-0000-0000-0000-000000000005', true)$$), '42501');
select public.decide_staff_request('dddddddd-0000-0000-0000-000000000002', true);
select pg_temp.expect('nothing left for the head coach', (select count(*) from public.staff_requests_to_decide()), 0::bigint);
select pg_temp.expect('direct staff insert still admin-only', pg_temp.err($$insert into public.staff (user_id, display_name, role) values ('dddddddd-0000-0000-0000-000000000006', 'X', 'coach')$$), '42501');
reset role;
select pg_temp.expect('assistant is on staff', (select role::text from public.staff where user_id = 'dddddddd-0000-0000-0000-000000000002'), 'assistant');

-- The admin approves the head coach
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('admin sees the head coach', (select display_name || '/' || note from public.staff_requests_to_decide()), 'Hank Head/River City Club');
select public.decide_staff_request('dddddddd-0000-0000-0000-000000000005', true);
reset role;
select pg_temp.expect('head coach is on staff', (select role::text from public.staff where user_id = 'dddddddd-0000-0000-0000-000000000005'), 'coach');
-- the request call now reports staff
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000005"}', false);
select pg_temp.expect('already staff', public.request_staff_access('coach', 'Hank Head'), 'staff');
reset role;

-- -----------------------------------------------------------------------------
-- What an assistant can and can't change
-- -----------------------------------------------------------------------------
-- The head coach sets the parent code and writes a practice plan (the seed has the culture)
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000001"}', false);
update public.teams set parent_code = 'TEST42' where id = '00000000-0000-0000-0000-0000000000b1';
insert into public.practice_plans (id, team_id, practice_date, total_minutes)
values ('dddddddd-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '2026-11-20', 90);
insert into public.practice_plan_drills (plan_id, position, name) values ('dddddddd-0000-0000-0000-0000000000a1', 1, 'Warm-up');
select pg_temp.expect('head coach sees assistants in the coaching staff', (select count(*) from public.coaching_staff() where display_name = 'Sam Assist'), 1::bigint);
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant reads players', (select count(*) > 0 from public.players), true);
select pg_temp.expect('assistant reads the culture', (select headline from public.team_culture where team_id = '00000000-0000-0000-0000-0000000000b1'), 'Compete. Connect. Elevate.');
select pg_temp.expect('assistant can''t save the culture', pg_temp.err($$select public.save_team_dugout('00000000-0000-0000-0000-0000000000b1', 'Mine', null, '[]'::jsonb)$$), '42501');
select pg_temp.expect('assistant can''t add GameDay cards', pg_temp.err($$insert into public.gameday_profiles (team_id, season_id, player_id) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1')$$), '42501');
select pg_temp.expect('assistant can''t assign mentors', pg_temp.err($$insert into public.mentor_players (mentor_id, player_id) values ('dddddddd-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000c1')$$), '42501');
select pg_temp.expect('assistant can''t change the parent code', pg_temp.err($$update public.teams set parent_code = 'ZZZZ99' where id = '00000000-0000-0000-0000-0000000000b1'$$), '42501');
select pg_temp.expect('assistant can''t remove a standard', pg_temp.err($$select public.save_team_dugout('00000000-0000-0000-0000-0000000000b1', 'Compete. Connect. Elevate.', null, '[]'::jsonb)$$), '42501');
select pg_temp.expect('assistant reads the budget', pg_temp.err($$select count(*) from public.budget_entries$$), '');
select pg_temp.expect('assistant can''t add to the budget', pg_temp.err($$insert into public.budget_entries (team_id, season_id, kind, entry_date, amount, description) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'expense', '2026-11-21', 10, 'x')$$), '42501');
select pg_temp.expect('assistant can''t set registration costs', pg_temp.err($$select public.save_budget_fees('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '[]'::jsonb)$$), '42501');
select pg_temp.expect('assistant still edits the calendar', pg_temp.err($$insert into public.team_events (team_id, kind, title, event_date) values ('00000000-0000-0000-0000-0000000000b1', 'practice', 'Assistant practice', '2026-11-21')$$), '');
-- practice plans: sees the head coach's, can't change it; writes her own
select pg_temp.expect('assistant sees the head coach''s plan', (select count(*) from public.practice_plans where id = 'dddddddd-0000-0000-0000-0000000000a1'), 1::bigint);
update public.practice_plans set focus = 'changed' where id = 'dddddddd-0000-0000-0000-0000000000a1';
select pg_temp.expect('assistant can''t add drills to it', pg_temp.err($$insert into public.practice_plan_drills (plan_id, position, name) values ('dddddddd-0000-0000-0000-0000000000a1', 2, 'Mine')$$), '42501');
delete from public.practice_plan_drills where plan_id = 'dddddddd-0000-0000-0000-0000000000a1';
delete from public.practice_plans where id = 'dddddddd-0000-0000-0000-0000000000a1';
select pg_temp.expect('assistant can''t autosave it', pg_temp.err($$select public.save_practice_plan('dddddddd-0000-0000-0000-0000000000a1', '{"practice_date": "2026-11-20", "setting": "outdoor", "total_minutes": 60}'::jsonb)$$), 'P0002');
insert into public.practice_plans (id, team_id, practice_date, total_minutes)
values ('dddddddd-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', '2026-11-22', 60);
select public.save_practice_plan('dddddddd-0000-0000-0000-0000000000a2', '{"practice_date": "2026-11-22", "setting": "indoor", "total_minutes": 75, "drills": [{"name": "Tee work", "minutes": 15}]}'::jsonb);
select pg_temp.expect('her own plan saved', (select total_minutes || '/' || setting from public.practice_plans where id = 'dddddddd-0000-0000-0000-0000000000a2'), '75/indoor');
select pg_temp.expect('she can''t write a plan in someone else''s name', pg_temp.err($$insert into public.practice_plans (team_id, practice_date, total_minutes, created_by) values ('00000000-0000-0000-0000-0000000000b1', '2026-11-23', 60, 'dddddddd-0000-0000-0000-000000000001')$$), '42501');
reset role;
select pg_temp.expect('head coach''s plan untouched', (select coalesce(focus, '-') || '/' || (select count(*) from public.practice_plan_drills where plan_id = 'dddddddd-0000-0000-0000-0000000000a1') from public.practice_plans where id = 'dddddddd-0000-0000-0000-0000000000a1'), '-/1');

-- The head coach can change the assistant's plan
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000001"}', false);
update public.practice_plans set focus = 'Bunt defense' where id = 'dddddddd-0000-0000-0000-0000000000a2';
reset role;
select pg_temp.expect('head coach edits any plan', (select focus from public.practice_plans where id = 'dddddddd-0000-0000-0000-0000000000a2'), 'Bunt defense');

-- -----------------------------------------------------------------------------
-- Parents: the assistant doesn't see or decide them
-- -----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000004"}', false);
insert into public.parent_accounts (display_name) values ('Pat Lopez');
select public.request_parent_link('TEST42', 'Avery Lopez');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000006"}', false);
insert into public.parent_accounts (display_name) values ('Sly Stranger');
select public.request_parent_link('TEST42', 'Jordan Kim');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant sees no parent emails', (select count(*) from public.team_parent_links('00000000-0000-0000-0000-0000000000b1')), 0::bigint);
select pg_temp.expect('assistant''s badge leaves parents out', (select coalesce(sum(parent_requests), 0) from public.pending_approvals()), 0::numeric);
update public.parent_links set status = 'approved', player_id = '00000000-0000-0000-0000-0000000000c1' where child_name = 'Avery Lopez';
reset role;
select pg_temp.expect('assistant can''t approve a parent', (select status::text from public.parent_links where child_name = 'Avery Lopez'), 'pending');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('head coach sees both parents', (select count(*) from public.team_parent_links('00000000-0000-0000-0000-0000000000b1')), 2::bigint);
update public.parent_links set status = 'approved', player_id = '00000000-0000-0000-0000-0000000000c1', decided_at = now() where child_name = 'Avery Lopez';
reset role;

-- -----------------------------------------------------------------------------
-- Parent-made username login
-- -----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('parent sees her daughter', (select player_name || '/' || on_roster || '/' || has_account from public.parent_player_logins()), 'Avery Lopez/true/false');
select pg_temp.expect('short password', pg_temp.err($$select public.create_player_login('00000000-0000-0000-0000-0000000000c1', 'avery7', 'short')$$), '22023');
select pg_temp.expect('bad username', pg_temp.err($$select public.create_player_login('00000000-0000-0000-0000-0000000000c1', 'a!', 'goodpass123')$$), '22023');
select pg_temp.expect('not her daughter', pg_temp.err($$select public.create_player_login('00000000-0000-0000-0000-0000000000c2', 'jordan21', 'goodpass123')$$), '42501');
select pg_temp.expect('login made', public.create_player_login('00000000-0000-0000-0000-0000000000c1', ' Avery7 ', 'goodpass123'), 'avery7');
select pg_temp.expect('only one login', pg_temp.err($$select public.create_player_login('00000000-0000-0000-0000-0000000000c1', 'avery8', 'goodpass123')$$), '23505');
select pg_temp.expect('parent sees the username', (select username || '/' || has_account from public.parent_player_logins()), 'avery7/true');
select pg_temp.expect('parent reads the login row', (select count(*) from public.player_logins), 1::bigint);
select pg_temp.expect('parent still reads no players', (select count(*) from public.players), 0::bigint);
reset role;

-- The stranger (pending, not approved) can't make one for Jordan
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000006"}', false);
select pg_temp.expect('pending parent can''t', pg_temp.err($$select public.create_player_login('00000000-0000-0000-0000-0000000000c2', 'jordan21', 'goodpass123')$$), '42501');
select pg_temp.expect('stranger reads no logins', (select count(*) from public.player_logins), 0::bigint);
reset role;

-- The login: confirmed, password works, claim approved, she opens her own profile
select pg_temp.expect('placeholder address, confirmed',
  (select email || '/' || (email_confirmed_at is not null) || '/' || aud from auth.users where email like 'avery7@%'),
  'avery7@player.gggcafe.invalid/true/authenticated');
select pg_temp.expect('password hashed with bcrypt',
  (select encrypted_password = extensions.crypt('goodpass123', encrypted_password) from auth.users where email like 'avery7@%'), true);
select pg_temp.expect('identity row', (select count(*) from auth.identities i join auth.users u on u.id = i.user_id where u.email like 'avery7@%'), 1::bigint);
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email like 'avery7@%'))::text, false);
set role authenticated;
select pg_temp.expect('she sees herself', (select string_agg(first_name, ',') from public.players), 'Avery');
reset role;

-- Password reset: her parent or a head coach, not an assistant
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant can''t reset it', pg_temp.err($$select public.reset_player_password('00000000-0000-0000-0000-0000000000c1', 'newpass456')$$), '42501');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000004"}', false);
select public.reset_player_password('00000000-0000-0000-0000-0000000000c1', 'newpass456');
reset role;
select pg_temp.expect('new password works',
  (select encrypted_password = extensions.crypt('newpass456', encrypted_password) from auth.users where email like 'avery7@%'), true);

-- Off the current roster: no login
update public.roster_entries set active = false where player_id = '00000000-0000-0000-0000-0000000000c2' and team_id = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000001"}', false);
update public.parent_links set status = 'approved', player_id = '00000000-0000-0000-0000-0000000000c2', decided_at = now() where child_name = 'Jordan Kim';
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000006"}', false);
select pg_temp.expect('not on the current roster', pg_temp.err($$select public.create_player_login('00000000-0000-0000-0000-0000000000c2', 'jordan21', 'goodpass123')$$), 'P0006');
reset role;
update public.roster_entries set active = true where player_id = '00000000-0000-0000-0000-0000000000c2' and team_id = '00000000-0000-0000-0000-0000000000b1';

-- -----------------------------------------------------------------------------
-- Clean up
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000001"}', false);
update public.teams set parent_code = (select parent_code from saved_code) where id = '00000000-0000-0000-0000-0000000000b1';
select set_config('request.jwt.claims', '', false);
delete from public.team_events where title = 'Assistant practice';
delete from public.practice_plans where id::text like 'dddddddd-%';
delete from public.player_claims where user_id in (select id from auth.users where email like 'avery7@%');
delete from auth.users where email like 'avery7@%';
delete from public.parent_links where parent_id::text like 'dddddddd-%';
delete from public.parent_accounts where user_id::text like 'dddddddd-%';
delete from public.staff_requests where user_id::text like 'dddddddd-%';
delete from public.staff where user_id::text like 'dddddddd-%';
delete from auth.users where id::text like 'dddddddd-%';
