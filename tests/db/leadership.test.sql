-- G3 Leadership Guide: a player keeps her lessons and plan only with G3 Advanced
-- AND a coach's pick; coaches pick leaders and write the review. Own users,
-- removed at the end. Seed: c1 Avery Lopez #7 (team b1).
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'lead-player@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'lead-coach@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'lead-viewer@example.test');
insert into public.staff (user_id, display_name, role) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Lead Coach', 'coach'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Lead Viewer', 'viewer');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'aaaaaaaa-0000-0000-0000-000000000001', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r
 where r.player_id = '00000000-0000-0000-0000-0000000000c1' and r.team_id = '00000000-0000-0000-0000-0000000000b1';

-- A coach picks her as a leader; a player can't pick herself
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}', false);
do $$ begin
  insert into public.player_leadership_access (player_id) values ('00000000-0000-0000-0000-0000000000c1');
  raise exception 'FAIL: a player picked herself as a leader';
exception when insufficient_privilege then null;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002"}', false);
insert into public.player_leadership_access (player_id) values ('00000000-0000-0000-0000-0000000000c1');
reset role;

-- Picked, but no G3 Advanced yet: still closed
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('she sees she was picked', (select count(*) from public.player_leadership_access), 1::bigint);
do $$ begin
  insert into public.player_leadership_lessons (player_id, lesson) values ('00000000-0000-0000-0000-0000000000c1', 'why-leadership');
  raise exception 'FAIL: wrote a lesson without G3 Advanced';
exception when insufficient_privilege then null;
end $$;
reset role;

-- With G3 Advanced too: her lessons and plan, but not the coach's review
insert into public.player_advanced_access (player_id) values ('00000000-0000-0000-0000-0000000000c1');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}', false);
insert into public.player_leadership_lessons (player_id, lesson, answers, steps, completed_at)
values ('00000000-0000-0000-0000-0000000000c1', 'why-leadership', '{"q1":"Lifting the team"}', '{s1}', now());
insert into public.player_leadership_plans (player_id, plan, committed_at)
values ('00000000-0000-0000-0000-0000000000c1', '{"why":"I want to lead"}', now());
select pg_temp.expect('her lesson saved', (select answers ->> 'q1' from public.player_leadership_lessons), 'Lifting the team');
do $$ begin
  insert into public.player_leadership_reviews (player_id, signed_at) values ('00000000-0000-0000-0000-0000000000c1', now());
  raise exception 'FAIL: a player signed off her own plan';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.player_leadership_lessons (player_id, lesson) values ('00000000-0000-0000-0000-0000000000c2', 'why-leadership');
  raise exception 'FAIL: wrote a teammate''s lesson';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Her plan's check-in dates become TWIS reminders she owns (source = leadership-checkin); other sources are refused
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}', false);
insert into public.player_activities (player_id, title, days, starts_on, ends_on, source)
values ('00000000-0000-0000-0000-0000000000c1', 'Leadership check-in with your coach', '{1}', '2027-01-04', '2027-01-04', 'leadership-checkin');
do $$ begin
  insert into public.player_activities (player_id, title, source) values ('00000000-0000-0000-0000-0000000000c1', 'x', 'made-up');
  raise exception 'FAIL: an unknown activity source was accepted';
exception when check_violation then null;
end $$;
reset role;
select pg_temp.expect('check-in reminder saved',
  (select count(*) from public.player_activities where source = 'leadership-checkin' and player_id = '00000000-0000-0000-0000-0000000000c1'), 1::bigint);
delete from public.player_activities where source = 'leadership-checkin';

-- The coach rates her and signs off; she can read it
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002"}', false);
insert into public.player_leadership_reviews (player_id, ratings, signed_at, signed_by)
values ('00000000-0000-0000-0000-0000000000c1', '{"r-words":"3"}', now(), 'aaaaaaaa-0000-0000-0000-000000000002');
select pg_temp.expect('coach reads her answers', (select answers ->> 'q1' from public.player_leadership_lessons), 'Lifting the team');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('she reads her coach''s rating', (select ratings ->> 'r-words' from public.player_leadership_reviews), '3');
reset role;

-- The certificate (and Leader Badge): only a coach awards it; she and coaches see it, view-only staff don't
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}', false);
do $$ begin
  insert into public.player_leadership_certificates (player_id) values ('00000000-0000-0000-0000-0000000000c1');
  raise exception 'FAIL: a player awarded herself the certificate';
exception when insufficient_privilege then null;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002"}', false);
insert into public.player_leadership_certificates (player_id, team_id)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect('coach sees the certificate', (select count(*) from public.player_leadership_certificates), 1::bigint);
select pg_temp.expect('awarded by the coach', (select awarded_by from public.player_leadership_certificates),
  'aaaaaaaa-0000-0000-0000-000000000002'::uuid);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('she sees her certificate', (select count(*) from public.player_leadership_certificates), 1::bigint);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('view-only staff don''t see it', (select count(*) from public.player_leadership_certificates), 0::bigint);
do $$ begin
  insert into public.player_leadership_certificates (player_id) values ('00000000-0000-0000-0000-0000000000c2');
  raise exception 'FAIL: view-only staff awarded a certificate';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Not a leader any more: closed again, work kept
delete from public.player_leadership_access where player_id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('closed: no lessons visible', (select count(*) from public.player_leadership_lessons), 0::bigint);
reset role;
select pg_temp.expect('closed: work kept', (select count(*) from public.player_leadership_lessons), 1::bigint);

-- Clean up
delete from public.player_leadership_certificates where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_leadership_reviews where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_leadership_plans where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_leadership_lessons where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_advanced_access where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_claims where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.staff where user_id::text like 'aaaaaaaa-%';
delete from auth.users where id::text like 'aaaaaaaa-%';
