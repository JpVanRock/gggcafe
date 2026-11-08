-- Family & roster (Phase 6): the medical card is for head coaches and her approved
-- parents ONLY; the questionnaire for her, her parents (through functions) and staff;
-- the welcome packet is head-coach written and read by approved parents.
-- Seed: team b1 (season a1), c1 Avery #7, c2 Jordan #21.
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
  ('a0a0a0a0-0000-0000-0000-000000000001', 'head-f@example.test', '{}'),
  ('a0a0a0a0-0000-0000-0000-000000000002', 'assist-f@example.test', '{}'),
  ('a0a0a0a0-0000-0000-0000-000000000003', 'parent-f@example.test', '{"role": "parent"}'),
  ('a0a0a0a0-0000-0000-0000-000000000004', 'other-f@example.test', '{"role": "parent"}'),
  ('a0a0a0a0-0000-0000-0000-000000000005', 'avery-f@example.test', '{"role": "player"}');
insert into public.staff (user_id, display_name, role) values
  ('a0a0a0a0-0000-0000-0000-000000000001', 'F Head', 'coach'),
  ('a0a0a0a0-0000-0000-0000-000000000002', 'F Assistant', 'assistant');
insert into public.parent_accounts (user_id, display_name) values
  ('a0a0a0a0-0000-0000-0000-000000000003', 'Pat Lopez'),
  ('a0a0a0a0-0000-0000-0000-000000000004', 'Other Parent');
insert into public.parent_links (parent_id, team_id, child_name, player_id, status, decided_at) values
  ('a0a0a0a0-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '00000000-0000-0000-0000-0000000000c1', 'approved', now()),
  ('a0a0a0a0-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000b1', 'Jordan Kim', null, 'pending', null);
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'a0a0a0a0-0000-0000-0000-000000000005', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c1';

-- Medical card: her parent fills it in
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0a0a0a0-0000-0000-0000-000000000003"}', false);
select public.save_parent_medical_card('00000000-0000-0000-0000-0000000000c1', '{"contact1_name":"Pat Lopez","contact1_phone":"555-0100","allergies":"Peanuts"}');
select pg_temp.expect('her parent reads it', public.parent_medical_card('00000000-0000-0000-0000-0000000000c1') ->> 'allergies', 'Peanuts');
select pg_temp.expect('no direct reads for parents', (select count(*) from public.medical_cards), 0::bigint);
select pg_temp.expect('not another daughter', pg_temp.err($$select public.parent_medical_card('00000000-0000-0000-0000-0000000000c2')$$), '42501');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0a0a0a0-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('a pending parent can''t', pg_temp.err($$select public.parent_medical_card('00000000-0000-0000-0000-0000000000c1')$$), '42501');
reset role;
-- the head coach reads it; the assistant and the player don't
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0a0a0a0-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('head coach reads it', (select allergies from public.medical_cards where player_id = '00000000-0000-0000-0000-0000000000c1'), 'Peanuts');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0a0a0a0-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant reads nothing', (select count(*) from public.medical_cards), 0::bigint);
select pg_temp.expect('assistant can''t write', pg_temp.err($$insert into public.medical_cards (player_id, contact1_name) values ('00000000-0000-0000-0000-0000000000c2', 'x')$$), '42501');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0a0a0a0-0000-0000-0000-000000000005"}', false);
select pg_temp.expect('the player reads nothing', (select count(*) from public.medical_cards), 0::bigint);
-- Questionnaire: she keeps her own
insert into public.player_questionnaires (player_id, team_id, season_id, top_size, numbers)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'AM', '{7,21}');
select pg_temp.expect('not a teammate''s', pg_temp.err($$insert into public.player_questionnaires (player_id, team_id, season_id) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1')$$), '42501');
select pg_temp.expect('bad size', pg_temp.err($$update public.player_questionnaires set top_size = 'XXL' where player_id = '00000000-0000-0000-0000-0000000000c1'$$), '23514');
reset role;
-- her parent updates it through the function; staff read it
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0a0a0a0-0000-0000-0000-000000000003"}', false);
select public.save_parent_questionnaire('00000000-0000-0000-0000-0000000000c1', '{"top_size":"AL","numbers":["7"],"positions":["SS"]}');
select pg_temp.expect('parent reads it', public.parent_questionnaire('00000000-0000-0000-0000-0000000000c1') ->> 'top_size', 'AL');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0a0a0a0-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant reads questionnaires', (select top_size from public.player_questionnaires where player_id = '00000000-0000-0000-0000-0000000000c1'), 'AL');
select pg_temp.expect('assistant can''t write the packet', pg_temp.err($$insert into public.parent_packet_items (team_id, title, body) values ('00000000-0000-0000-0000-0000000000b1', 'x', 'y')$$), '42501');
reset role;

-- Welcome packet
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0a0a0a0-0000-0000-0000-000000000001"}', false);
insert into public.parent_packet_items (id, team_id, kind, title, body)
values ('a0a0a0a0-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'letter', 'Welcome', 'Glad you are here.');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0a0a0a0-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('approved parent reads the packet', (select title from public.parent_packet_items where id = 'a0a0a0a0-0000-0000-0000-0000000000a1'), 'Welcome');
insert into public.parent_packet_reads (parent_id, item_id) values ('a0a0a0a0-0000-0000-0000-000000000003', 'a0a0a0a0-0000-0000-0000-0000000000a1');
select pg_temp.expect('not someone else''s read', pg_temp.err($$insert into public.parent_packet_reads (parent_id, item_id) values ('a0a0a0a0-0000-0000-0000-000000000004', 'a0a0a0a0-0000-0000-0000-0000000000a1')$$), '42501');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0a0a0a0-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('pending parent reads no packet', (select count(*) from public.parent_packet_items), 0::bigint);
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.parent_packet_items where id::text like 'a0a0a0a0-%';
delete from public.player_questionnaires where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.medical_cards where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_claims where user_id::text like 'a0a0a0a0-%';
delete from public.parent_links where parent_id::text like 'a0a0a0a0-%';
delete from public.parent_accounts where user_id::text like 'a0a0a0a0-%';
delete from public.staff where user_id::text like 'a0a0a0a0-%';
delete from auth.users where id::text like 'a0a0a0a0-%';
