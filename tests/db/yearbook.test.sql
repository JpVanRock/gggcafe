-- Team Yearbook (G3 Advanced): who sees it, who adds to it, tags (team players only),
-- names through team_yearbook() only, uploader name from her record. Own users,
-- removed at the end. Seed: team b1 (season a1) = c1 Avery, c2 Jordan, c3 Riley, c4 Morgan;
-- team b2 = d1 Taylor.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

insert into auth.users (id, email) values
  ('dddddddd-0000-0000-0000-000000000001', 'yb-coach@example.test'),
  ('dddddddd-0000-0000-0000-000000000002', 'yb-parent@example.test'),
  ('dddddddd-0000-0000-0000-000000000003', 'yb-avery@example.test'),
  ('dddddddd-0000-0000-0000-000000000004', 'yb-taylor@example.test');
insert into public.staff (user_id, display_name, role) values ('dddddddd-0000-0000-0000-000000000001', 'YB Coach', 'coach');
insert into public.parent_accounts (user_id, display_name) values ('dddddddd-0000-0000-0000-000000000002', 'Pat Lopez');
insert into public.parent_links (parent_id, team_id, child_name, player_id, status)
values ('dddddddd-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '00000000-0000-0000-0000-0000000000c1', 'approved');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select u, r.team_id, r.season_id, r.id, n, j, 'approved'
  from (values ('dddddddd-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid, 'Avery Lopez', '7'),
               ('dddddddd-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-0000000000d1'::uuid, 'Taylor Brooks', '12')) v(u, p, n, j)
  join public.roster_entries r on r.player_id = v.p;

-- Without G3 Advanced: the parent and the player have no yearbook; the coach manages it
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('parent: no G3 Advanced, no yearbook', public.yearbook_access('00000000-0000-0000-0000-0000000000b1'), null::text);
do $$ begin
  perform public.team_yearbook('00000000-0000-0000-0000-0000000000b1');
  raise exception 'FAIL: opened the yearbook without G3 Advanced';
exception when insufficient_privilege then null;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('coach manages', public.yearbook_access('00000000-0000-0000-0000-0000000000b1'), 'manage');
insert into public.yearbook_photos (id, team_id, season_id, path, thumb_path, caption, uploader_name)
values ('dddddddd-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-0000000000b1/00000000-0000-0000-0000-0000000000a1/1762600000000-abcd.jpg',
        '00000000-0000-0000-0000-0000000000b1/00000000-0000-0000-0000-0000000000a1/1762600000000-abcd_t.jpg',
        'Team photo', 'Someone Else');
insert into public.yearbook_photo_tags (photo_id, player_id) values
  ('dddddddd-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1'),
  ('dddddddd-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c2');
do $$ begin
  insert into public.yearbook_photo_tags (photo_id, player_id) values ('dddddddd-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d1');
  raise exception 'FAIL: tagged a player from another team';
exception when insufficient_privilege then null;
end $$;
select pg_temp.expect('uploader name from her record', (select uploader_name from public.yearbook_photos), 'YB Coach');
do $$ begin
  insert into public.yearbook_photos (team_id, season_id, path, thumb_path)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-0000000000b2/00000000-0000-0000-0000-0000000000a1/1762600000001-wxyz.jpg',
          '00000000-0000-0000-0000-0000000000b2/00000000-0000-0000-0000-0000000000a1/1762600000001-wxyz_t.jpg');
  raise exception 'FAIL: a photo path outside its team''s folder';
exception when check_violation then null;
end $$;
reset role;

-- Avery gets G3 Advanced: her parent can add, she can view; Taylor (other team) can't
insert into public.player_advanced_access (player_id) values ('00000000-0000-0000-0000-0000000000c1');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('parent adds', public.yearbook_access('00000000-0000-0000-0000-0000000000b1'), 'add');
insert into public.yearbook_photos (id, team_id, season_id, path, thumb_path)
values ('dddddddd-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-0000000000b1/00000000-0000-0000-0000-0000000000a1/1762600000002-efgh.jpg',
        '00000000-0000-0000-0000-0000000000b1/00000000-0000-0000-0000-0000000000a1/1762600000002-efgh_t.jpg');
insert into public.yearbook_photo_tags (photo_id, player_id) values ('dddddddd-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c3');
select pg_temp.expect('parent sees both photos', jsonb_array_length(public.team_yearbook('00000000-0000-0000-0000-0000000000b1') -> 'photos'), 2);
select pg_temp.expect('teammates'' names through the yearbook only',
  (select string_agg(t ->> 'name', ', ' order by t ->> 'name')
     from jsonb_array_elements(public.team_yearbook('00000000-0000-0000-0000-0000000000b1') -> 'photos') p, jsonb_array_elements(p -> 'tags') t),
  'Avery Lopez, Jordan Kim, Riley Chen');
select pg_temp.expect('parent reads no player rows', (select count(*) from public.players), 0::bigint);
select pg_temp.expect('parent upload named from her parent profile',
  (select uploader_name from public.yearbook_photos where id = 'dddddddd-0000-0000-0000-0000000000f2'), 'Pat Lopez');
do $$ begin
  delete from public.yearbook_photos where id = 'dddddddd-0000-0000-0000-0000000000f1';
  if found then raise exception 'FAIL: a parent removed the coach''s photo'; end if;
end $$;
do $$ begin
  update public.yearbook_photos set path = 'x';
  raise exception 'FAIL: a parent changed a photo''s path';
exception when insufficient_privilege then null;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('Avery views', public.yearbook_access('00000000-0000-0000-0000-0000000000b1'), 'view');
select pg_temp.expect('roster for search', jsonb_array_length(public.team_yearbook('00000000-0000-0000-0000-0000000000b1') -> 'roster'), 4);
do $$ begin
  insert into public.yearbook_photos (team_id, season_id, path, thumb_path)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-0000000000b1/00000000-0000-0000-0000-0000000000a1/1762600000003-ijkl.jpg',
          '00000000-0000-0000-0000-0000000000b1/00000000-0000-0000-0000-0000000000a1/1762600000003-ijkl_t.jpg');
  raise exception 'FAIL: a player uploaded a yearbook photo';
exception when insufficient_privilege then null;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('another team''s player: no access', public.yearbook_access('00000000-0000-0000-0000-0000000000b1'), null::text);
select pg_temp.expect('another team''s player sees no photos', (select count(*) from public.yearbook_photos), 0::bigint);
reset role;

-- Clean up
delete from public.yearbook_photos where team_id = '00000000-0000-0000-0000-0000000000b1';
delete from public.player_advanced_access where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.parent_links where parent_id = 'dddddddd-0000-0000-0000-000000000002';
delete from public.parent_accounts where user_id = 'dddddddd-0000-0000-0000-000000000002';
delete from public.player_claims where user_id::text like 'dddddddd-%';
delete from public.staff where user_id::text like 'dddddddd-%';
delete from auth.users where id::text like 'dddddddd-%';
