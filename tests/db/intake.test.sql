-- Player intake: date of birth, walk-up songs, and the private player-photos
-- bucket. Uses its own coach, viewer and stranger, removed at the end.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

insert into auth.users (id, email) values
  ('33333333-0000-0000-0000-000000000001', 'intake-coach@example.test'),
  ('33333333-0000-0000-0000-000000000002', 'intake-viewer@example.test'),
  ('33333333-0000-0000-0000-000000000003', 'intake-stranger@example.test');
insert into public.staff (user_id, display_name, role) values
  ('33333333-0000-0000-0000-000000000001', 'Intake Coach',  'coach'),
  ('33333333-0000-0000-0000-000000000002', 'Intake Viewer', 'viewer');

select pg_temp.expect('player-photos bucket is private',
  (select public from storage.buckets where id = 'player-photos'), false);

-- Columns: date of birth, photo path shape, at most three songs
update public.players
   set birth_date = '2010-04-02',
       photo_path = '0f8fad5b-d9cb-469f-a165-70867728950e/1762539000000.jpg',
       walk_up_songs = '[{"title": "Song A", "artist": "Artist A"}]'
 where id = '00000000-0000-0000-0000-0000000000c1';
do $$ begin
  update public.players set photo_path = '../other-bucket/x.jpg' where id = '00000000-0000-0000-0000-0000000000c1';
  raise exception 'FAIL: a photo path outside the expected shape was accepted';
exception when check_violation then null;
end $$;
do $$ begin
  update public.players set walk_up_songs = '[{}, {}, {}, {}]' where id = '00000000-0000-0000-0000-0000000000c1';
  raise exception 'FAIL: four walk-up songs were accepted';
exception when check_violation then null;
end $$;

-- Coach uploads; viewer reads but can't upload; stranger sees nothing
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-0000-0000-0000-000000000001"}', false);
insert into storage.objects (bucket_id, name) values ('player-photos', '0f8fad5b-d9cb-469f-a165-70867728950e/1762539000000.jpg');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('viewer sees player photos',
  (select count(*) from storage.objects where bucket_id = 'player-photos'), 1::bigint);
do $$ begin
  insert into storage.objects (bucket_id, name) values ('player-photos', '0f8fad5b-d9cb-469f-a165-70867728950e/1.jpg');
  raise exception 'FAIL: viewer could upload a player photo';
exception when insufficient_privilege then null;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('stranger sees no player photos',
  (select count(*) from storage.objects where bucket_id = 'player-photos'), 0::bigint);
reset role;

set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect('signed-out visitors see no player photos',
  (select count(*) from storage.objects where bucket_id = 'player-photos'), 0::bigint);
reset role;

-- Clean up
delete from storage.objects where bucket_id = 'player-photos';
update public.players set birth_date = null, photo_path = null, walk_up_songs = '[]' where id = '00000000-0000-0000-0000-0000000000c1';
delete from public.staff where user_id::text like '33333333-%';
delete from auth.users where id::text like '33333333-%';
