-- Mental GP lessons and the coaches' Mental Game course (user, 2026-11-12; migration
-- 20261112023653). A player keeps her own lesson answers (staff read them, mentors
-- don't); each staff member keeps their own coach-course notes, which only admins
-- also read. Seed: c1 Avery #7 and c2 Jordan #21 on team b1. Own users, removed at the end.
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
  ('e1e1e1e1-0000-0000-0000-000000000001', 'ml-avery@example.test', '{"role": "player"}'),
  ('e1e1e1e1-0000-0000-0000-000000000002', 'ml-mentor@example.test', '{"role": "mentor"}'),
  ('e1e1e1e1-0000-0000-0000-000000000003', 'ml-viewer@example.test', '{}'),
  ('e1e1e1e1-0000-0000-0000-000000000004', 'ml-coach@example.test', '{}'),
  ('e1e1e1e1-0000-0000-0000-000000000005', 'ml-admin@example.test', '{}');
insert into public.staff (user_id, display_name, role) values
  ('e1e1e1e1-0000-0000-0000-000000000003', 'ML Viewer', 'viewer'),
  ('e1e1e1e1-0000-0000-0000-000000000004', 'ML Coach', 'coach'),
  ('e1e1e1e1-0000-0000-0000-000000000005', 'ML Admin', 'admin');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'e1e1e1e1-0000-0000-0000-000000000001', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c1';
insert into public.mentors (user_id, display_name) values ('e1e1e1e1-0000-0000-0000-000000000002', 'ML Mentor');
insert into public.mentor_links (mentor_id, player_id, status) values ('e1e1e1e1-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'approved');

-- Avery keeps her own lessons, not Jordan's
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000001"}', false);
insert into public.player_mental_lessons (player_id, lesson, answer, completed_at)
values ('00000000-0000-0000-0000-0000000000c1', 'between-pitches', 'Step out, gloves, breathe, see it early.', now());
update public.player_mental_lessons set answer = 'Step out, gloves, look at Coach, breathe, see it early.'
 where player_id = '00000000-0000-0000-0000-0000000000c1' and lesson = 'between-pitches';
select pg_temp.expect('she reads her answer', (select answer from public.player_mental_lessons where lesson = 'between-pitches'), 'Step out, gloves, look at Coach, breathe, see it early.');
select pg_temp.expect('a slug the app never uses', pg_temp.err($$insert into public.player_mental_lessons (player_id, lesson) values ('00000000-0000-0000-0000-0000000000c1', 'Bad Slug!')$$), '23514');
select pg_temp.expect('an answer too long', pg_temp.err($$insert into public.player_mental_lessons (player_id, lesson, answer) values ('00000000-0000-0000-0000-0000000000c1', 'nerves', repeat('x', 1501))$$), '23514');
select pg_temp.expect('not Jordan''s', pg_temp.err($$insert into public.player_mental_lessons (player_id, lesson, answer) values ('00000000-0000-0000-0000-0000000000c2', 'nerves', 'x')$$), '42501');
-- the coaches' course is for staff
select pg_temp.expect('a player can''t keep coach notes', pg_temp.err($$insert into public.coach_mental_lessons (lesson, notes) values ('your-words', 'x')$$), '42501');
reset role;

-- Her mentor doesn't read her lesson answers (like her journal)
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('mentor reads no lesson answers', (select count(*) from public.player_mental_lessons), 0::bigint);
reset role;

-- Staff read the players' lessons; a viewer can't write them
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('viewer reads her lesson', (select count(*) from public.player_mental_lessons where player_id = '00000000-0000-0000-0000-0000000000c1'), 1::bigint);
select pg_temp.expect('viewer can''t write a player''s lesson', pg_temp.err($$insert into public.player_mental_lessons (player_id, lesson, answer) values ('00000000-0000-0000-0000-0000000000c1', 'nerves', 'x')$$), '42501');
-- every staff member keeps their own course notes, viewers included
insert into public.coach_mental_lessons (lesson, notes, completed_at) values ('your-words', 'Viewer notes', now());
select pg_temp.expect('the viewer''s row is theirs', (select user_id::text from public.coach_mental_lessons), 'e1e1e1e1-0000-0000-0000-000000000003');
select pg_temp.expect('no notes for someone else', pg_temp.err($$insert into public.coach_mental_lessons (user_id, lesson) values ('e1e1e1e1-0000-0000-0000-000000000004', 'team-reset')$$), '42501');
reset role;

-- A coach reads only their own notes
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000004"}', false);
insert into public.coach_mental_lessons (lesson, notes) values ('after-mistakes', 'Coach notes');
select pg_temp.expect('coach reads only their own', (select string_agg(notes, ',') from public.coach_mental_lessons), 'Coach notes');
select pg_temp.expect('coach can''t change the viewer''s', pg_temp.err($$update public.coach_mental_lessons set notes = 'changed' where notes = 'Viewer notes'$$) ||
  (select count(*) from public.coach_mental_lessons where notes = 'changed')::text, '0');
select pg_temp.expect('coach reads her players'' lessons', (select count(*) from public.player_mental_lessons where player_id = '00000000-0000-0000-0000-0000000000c1'), 1::bigint);
reset role;

-- An admin reads everyone's progress but can't write theirs
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000005"}', false);
select pg_temp.expect('admin reads the staff''s progress', (select count(*) from public.coach_mental_lessons where user_id::text like 'e1e1e1e1-%'), 2::bigint);
select pg_temp.expect('admin can''t change a coach''s notes', pg_temp.err($$update public.coach_mental_lessons set notes = 'admin' where notes = 'Coach notes'$$) ||
  (select count(*) from public.coach_mental_lessons where notes = 'admin')::text, '0');
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.coach_mental_lessons where user_id::text like 'e1e1e1e1-%';
delete from public.player_mental_lessons where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.mentor_links where mentor_id = 'e1e1e1e1-0000-0000-0000-000000000002';
delete from public.mentors where user_id = 'e1e1e1e1-0000-0000-0000-000000000002';
delete from public.player_claims where user_id::text like 'e1e1e1e1-%';
delete from public.staff where user_id::text like 'e1e1e1e1-%';
delete from auth.users where id::text like 'e1e1e1e1-%';
