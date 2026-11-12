-- My Journal (user, 2026-11-12; migration 20261112132733). Her notes and voice memos from
-- mentor sessions: she keeps them; her approved parent reads them; a mentor reads only an
-- entry shared with her; coaches read nothing. Seed: c1 Avery and c2 Jordan on b1.
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
  ('e3e3e3e3-0000-0000-0000-000000000001', 'mj-avery@example.test', '{"role": "player"}'),
  ('e3e3e3e3-0000-0000-0000-000000000002', 'mj-mentor@example.test', '{"role": "mentor"}'),
  ('e3e3e3e3-0000-0000-0000-000000000003', 'mj-other-mentor@example.test', '{"role": "mentor"}'),
  ('e3e3e3e3-0000-0000-0000-000000000004', 'mj-parent@example.test', '{"role": "parent"}'),
  ('e3e3e3e3-0000-0000-0000-000000000005', 'mj-admin@example.test', '{}');
insert into public.staff (user_id, display_name, role) values ('e3e3e3e3-0000-0000-0000-000000000005', 'MJ Admin', 'admin');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'e3e3e3e3-0000-0000-0000-000000000001', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c1';
insert into public.mentors (user_id, display_name, specialty) values
  ('e3e3e3e3-0000-0000-0000-000000000002', 'MJ Mentor', 'Hitting'),
  ('e3e3e3e3-0000-0000-0000-000000000003', 'MJ Other', null);
insert into public.mentor_links (mentor_id, player_id, status) values ('e3e3e3e3-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'approved');
-- the other mentor works with Jordan, not Avery
insert into public.mentor_links (mentor_id, player_id, status) values ('e3e3e3e3-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c2', 'approved');
insert into public.parent_accounts (user_id, display_name) values ('e3e3e3e3-0000-0000-0000-000000000004', 'MJ Parent');
insert into public.parent_links (parent_id, team_id, child_name, player_id, status, decided_at) values
  ('e3e3e3e3-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '00000000-0000-0000-0000-0000000000c1', 'approved', now());

-- Avery writes her journal and a voice memo in her own folder
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3e3e3e3-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('her mentors', (select string_agg(display_name, ',') from public.player_mentors('00000000-0000-0000-0000-0000000000c1')), 'MJ Mentor');
select pg_temp.expect('not Jordan''s mentors', pg_temp.err($$select * from public.player_mentors('00000000-0000-0000-0000-0000000000c2')$$), '42501');
insert into storage.objects (bucket_id, name) values ('journal-audio', '00000000-0000-0000-0000-0000000000c1/0f8fad5b-d9cb-469f-a165-70867728950e.webm');
select pg_temp.expect('not in Jordan''s folder', pg_temp.err($$insert into storage.objects (bucket_id, name) values ('journal-audio', '00000000-0000-0000-0000-0000000000c2/0f8fad5b-d9cb-469f-a165-70867728950e.webm')$$), '42501');
insert into public.player_journal_entries (player_id, mentor_id, session_date, topic, notes, audio_path, audio_seconds, shared_with_mentor) values
  ('00000000-0000-0000-0000-0000000000c1', 'e3e3e3e3-0000-0000-0000-000000000002', '2026-11-10', 'MJ shared', 'Load early.',
   '00000000-0000-0000-0000-0000000000c1/0f8fad5b-d9cb-469f-a165-70867728950e.webm', 42, true),
  ('00000000-0000-0000-0000-0000000000c1', 'e3e3e3e3-0000-0000-0000-000000000002', '2026-11-11', 'MJ private', 'Just for me.', null, null, false);
select pg_temp.expect('a memo outside her folder', pg_temp.err($$insert into public.player_journal_entries (player_id, notes, audio_path) values ('00000000-0000-0000-0000-0000000000c1', 'x', '00000000-0000-0000-0000-0000000000c2/0f8fad5b-d9cb-469f-a165-70867728950e.webm')$$), '23514');
select pg_temp.expect('an empty entry', pg_temp.err($$insert into public.player_journal_entries (player_id) values ('00000000-0000-0000-0000-0000000000c1')$$), '23514');
select pg_temp.expect('shared with no mentor', pg_temp.err($$insert into public.player_journal_entries (player_id, notes, shared_with_mentor) values ('00000000-0000-0000-0000-0000000000c1', 'x', true)$$), '23514');
select pg_temp.expect('not in Jordan''s journal', pg_temp.err($$insert into public.player_journal_entries (player_id, notes) values ('00000000-0000-0000-0000-0000000000c2', 'x')$$), '42501');
select pg_temp.expect('she reads both', (select count(*) from public.player_journal_entries), 2::bigint);
select pg_temp.expect('she plays her memo', (select count(*) from storage.objects where bucket_id = 'journal-audio'), 1::bigint);
reset role;

-- Her mentor reads the shared entry and plays its memo, not the private one
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3e3e3e3-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('mentor reads what she shared', (select string_agg(topic, ',') from public.player_journal_entries), 'MJ shared');
select pg_temp.expect('mentor plays the shared memo', (select count(*) from storage.objects where bucket_id = 'journal-audio'), 1::bigint);
select pg_temp.expect('mentor can''t change it', pg_temp.err($$update public.player_journal_entries set notes = 'x'$$) ||
  (select count(*) from public.player_journal_entries where notes = 'x')::text, '0');
reset role;

-- Another mentor (not hers) reads nothing, even when named on the entry
update public.player_journal_entries set mentor_id = 'e3e3e3e3-0000-0000-0000-000000000003' where topic = 'MJ private';
update public.player_journal_entries set shared_with_mentor = true where topic = 'MJ private';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3e3e3e3-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('another player''s mentor reads nothing', (select count(*) from public.player_journal_entries), 0::bigint);
select pg_temp.expect('nor plays her memos', (select count(*) from storage.objects where bucket_id = 'journal-audio'), 0::bigint);
reset role;

-- Her parent reads her journal and plays her memo, read only
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3e3e3e3-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('parent reads her journal', (select count(*) from public.player_journal_entries), 2::bigint);
select pg_temp.expect('parent plays her memo', (select count(*) from storage.objects where bucket_id = 'journal-audio'), 1::bigint);
select pg_temp.expect('parent can''t write in it', pg_temp.err($$insert into public.player_journal_entries (player_id, notes) values ('00000000-0000-0000-0000-0000000000c1', 'x')$$), '42501');
select pg_temp.expect('parent sees her mentors', (select count(*) from public.player_mentors('00000000-0000-0000-0000-0000000000c1')), 1::bigint);
reset role;

-- Coaches and admins don't read it (user's choice)
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3e3e3e3-0000-0000-0000-000000000005"}', false);
select pg_temp.expect('admin reads no journal', (select count(*) from public.player_journal_entries), 0::bigint);
select pg_temp.expect('admin can''t write one', pg_temp.err($$insert into public.player_journal_entries (player_id, notes) values ('00000000-0000-0000-0000-0000000000c1', 'x')$$), '42501');
select pg_temp.expect('admin plays no memo', (select count(*) from storage.objects where bucket_id = 'journal-audio'), 0::bigint);
reset role;

-- She removes her memo
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3e3e3e3-0000-0000-0000-000000000001"}', false);
delete from storage.objects where bucket_id = 'journal-audio';
reset role;
select pg_temp.expect('her memo is gone', (select count(*) from storage.objects where bucket_id = 'journal-audio'), 0::bigint);

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.player_journal_entries where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.parent_links where parent_id = 'e3e3e3e3-0000-0000-0000-000000000004';
delete from public.parent_accounts where user_id = 'e3e3e3e3-0000-0000-0000-000000000004';
delete from public.mentor_links where mentor_id::text like 'e3e3e3e3-%';
delete from public.mentors where user_id::text like 'e3e3e3e3-%';
delete from public.player_claims where user_id::text like 'e3e3e3e3-%';
delete from public.staff where user_id::text like 'e3e3e3e3-%';
delete from auth.users where id::text like 'e3e3e3e3-%';
