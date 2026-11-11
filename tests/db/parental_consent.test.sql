-- Verified parental consent (COPPA) for players under 13: a parent uploads a signed form (or asks
-- for a video call), a GGG.Cafe admin checks it, and only then can the parent make her login or a
-- coach approve her profile claim. Coaches never read consent records or forms. Withdrawing ends
-- her access. Own users, removed at the end.
-- Seed: team b1 = c1 Avery #7, c2 Jordan Kim #21, c3 Riley #00, c4 Morgan #3 (season a1, current).
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
create function pg_temp.as_user(uid text) returns void
language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid)::text, false) $$;
grant execute on function pg_temp.as_user(text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('abababab-0000-0000-0000-000000000001', 'riley-parent@example.test', '{"role": "parent"}'),
  ('abababab-0000-0000-0000-000000000002', 'avery-parent@example.test', '{"role": "parent"}'),
  ('abababab-0000-0000-0000-000000000003', 'c-admin@example.test', '{}'),
  ('abababab-0000-0000-0000-000000000004', 'c-coach@example.test', '{}'),
  ('abababab-0000-0000-0000-000000000005', 'morgan@example.test', '{"role": "player"}');
insert into public.staff (user_id, display_name, role) values
  ('abababab-0000-0000-0000-000000000003', 'C Admin', 'admin'),
  ('abababab-0000-0000-0000-000000000004', 'C Coach', 'coach');
insert into public.parent_accounts (user_id, display_name) values
  ('abababab-0000-0000-0000-000000000001', 'Robin Chen'),
  ('abababab-0000-0000-0000-000000000002', 'Al Lopez');
insert into public.parent_links (parent_id, team_id, child_name, player_id, status, decided_at) values
  ('abababab-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'Riley Chen', '00000000-0000-0000-0000-0000000000c3', 'approved', now()),
  ('abababab-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '00000000-0000-0000-0000-0000000000c1', 'approved', now());
-- Riley is 11, Morgan 12, Avery 16
update public.players set birth_date = current_date - interval '11 years' where id = '00000000-0000-0000-0000-0000000000c3';
update public.players set birth_date = current_date - interval '12 years' where id = '00000000-0000-0000-0000-0000000000c4';
update public.players set birth_date = '2010-04-02' where id = '00000000-0000-0000-0000-0000000000c1';
-- Morgan signed herself up (with the wrong age) and claimed her spot
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'abababab-0000-0000-0000-000000000005', r.team_id, r.season_id, r.id, 'Morgan Diaz', '3', 'pending'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c4' and r.team_id = '00000000-0000-0000-0000-0000000000b1';

-- ---------------------------------------------------------------------------
-- The parent: her status, no login yet, the form first
-- ---------------------------------------------------------------------------
set role authenticated;
select pg_temp.as_user('abababab-0000-0000-0000-000000000001');
select pg_temp.expect('she sees her daughter is under 13, nothing on file',
  (select under_13 || '/' || coalesce(status, 'none') from public.parent_consent_status()), 'true/none');
select pg_temp.expect('no login without consent',
  pg_temp.err($$select public.create_player_login('00000000-0000-0000-0000-0000000000c3', 'riley00', 'goodpass123')$$), 'P0008');
select pg_temp.expect('no form uploaded yet',
  pg_temp.err($$select public.submit_parental_consent('00000000-0000-0000-0000-0000000000c3', 'signed_form', 'Robin Chen', 'parent', 'abababab-0000-0000-0000-000000000001/1762900000000.jpg', '2026-11-11')$$), '22023');
insert into storage.objects (bucket_id, name) values ('consent-forms', 'abababab-0000-0000-0000-000000000001/1762900000000.jpg');
select pg_temp.expect('not into someone else''s folder',
  pg_temp.err($$insert into storage.objects (bucket_id, name) values ('consent-forms', 'abababab-0000-0000-0000-000000000002/1762900000000.jpg')$$), '42501');
select pg_temp.expect('a name is required',
  pg_temp.err($$select public.submit_parental_consent('00000000-0000-0000-0000-0000000000c3', 'signed_form', ' ', 'parent', 'abababab-0000-0000-0000-000000000001/1762900000000.jpg', '2026-11-11')$$), '22023');
select pg_temp.expect('submitted', (select public.submit_parental_consent('00000000-0000-0000-0000-0000000000c3', 'signed_form', ' Robin Chen ', 'parent', 'abababab-0000-0000-0000-000000000001/1762900000000.jpg', '2026-11-11') is not null), true);
select pg_temp.expect('one open request at a time',
  pg_temp.err($$select public.submit_parental_consent('00000000-0000-0000-0000-0000000000c3', 'video_call', 'Robin Chen', 'parent', null, '2026-11-11')$$), '23505');
select pg_temp.expect('she sees it waiting', (select status || '/' || method || '/' || parent_name from public.parent_consent_status()), 'pending/signed_form/Robin Chen');
select pg_temp.expect('she reads her own form', (select count(*) from storage.objects where bucket_id = 'consent-forms'), 1::bigint);
select pg_temp.expect('still no login while it waits',
  pg_temp.err($$select public.create_player_login('00000000-0000-0000-0000-0000000000c3', 'riley00', 'goodpass123')$$), 'P0008');
reset role;

-- Another parent: not for someone else's daughter; a 13-year-old needs no consent
set role authenticated;
select pg_temp.as_user('abababab-0000-0000-0000-000000000002');
select pg_temp.expect('not her daughter',
  pg_temp.err($$select public.submit_parental_consent('00000000-0000-0000-0000-0000000000c3', 'video_call', 'Al Lopez', 'parent', null, '2026-11-11')$$), '42501');
select pg_temp.expect('13 and older needs no consent',
  pg_temp.err($$select public.submit_parental_consent('00000000-0000-0000-0000-0000000000c1', 'video_call', 'Al Lopez', 'parent', null, '2026-11-11')$$), '22023');
select pg_temp.expect('she reads no one else''s consent', (select count(*) from public.parental_consents), 0::bigint);
select pg_temp.expect('or their forms', (select count(*) from storage.objects where bucket_id = 'consent-forms'), 0::bigint);
select pg_temp.expect('can''t review', pg_temp.err($$select public.review_parental_consent((select id from public.parental_consents limit 1), true, null)$$), '42501');
reset role;

-- A coach: no consent records, no forms, no list, no decisions
set role authenticated;
select pg_temp.as_user('abababab-0000-0000-0000-000000000004');
select pg_temp.expect('coach reads no consents', (select count(*) from public.parental_consents), 0::bigint);
select pg_temp.expect('coach reads no forms', (select count(*) from storage.objects where bucket_id = 'consent-forms'), 0::bigint);
select pg_temp.expect('coach gets no pending list', (select count(*) from public.pending_parental_consents()), 0::bigint);
reset role;
create temp table consent_id as select id from public.parental_consents where player_id = '00000000-0000-0000-0000-0000000000c3';
grant select on consent_id to authenticated;
set role authenticated;
select pg_temp.as_user('abababab-0000-0000-0000-000000000004');
select pg_temp.expect('coach can''t verify', pg_temp.err($$select public.review_parental_consent((select id from consent_id), true, null)$$), '42501');
reset role;

-- ---------------------------------------------------------------------------
-- The admin checks it
-- ---------------------------------------------------------------------------
set role authenticated;
select pg_temp.as_user('abababab-0000-0000-0000-000000000003');
select pg_temp.expect('admin sees the request',
  (select player_name || '/' || parent_name || '/' || parent_account || '/' || method || '/' || team_name from public.pending_parental_consents()),
  'Riley Chen/Robin Chen/Robin Chen/signed_form/' || (select name from public.teams where id = '00000000-0000-0000-0000-0000000000b1'));
select pg_temp.expect('admin opens the form', (select count(*) from storage.objects where bucket_id = 'consent-forms'), 1::bigint);
select pg_temp.expect('declining needs a reason', pg_temp.err($$select public.review_parental_consent((select id from consent_id), false, '  ')$$), '22023');
select public.review_parental_consent((select id from consent_id), true, null);
select pg_temp.expect('decided once', pg_temp.err($$select public.review_parental_consent((select id from consent_id), false, 'changed my mind')$$), 'P0002');
select pg_temp.expect('nothing waiting now', (select count(*) from public.pending_parental_consents()), 0::bigint);
reset role;
select pg_temp.expect('recorded who and when',
  (select status || '/' || (reviewed_by = 'abababab-0000-0000-0000-000000000003') || '/' || (reviewed_at is not null) from public.parental_consents where id = (select id from consent_id)),
  'verified/true/true');

-- Verified: now her parent can make her login
set role authenticated;
select pg_temp.as_user('abababab-0000-0000-0000-000000000001');
select pg_temp.expect('login made after consent', public.create_player_login('00000000-0000-0000-0000-0000000000c3', 'riley00', 'goodpass123'), 'riley00');
reset role;
select pg_temp.expect('her claim approved with the login',
  (select count(*) from public.player_claims c join public.player_logins l on l.user_id = c.user_id
    where l.player_id = '00000000-0000-0000-0000-0000000000c3' and c.status = 'approved'), 1::bigint);

-- ---------------------------------------------------------------------------
-- A claim for an under-13 player can't be approved without consent
-- ---------------------------------------------------------------------------
select pg_temp.expect('Morgan''s claim waits for consent',
  pg_temp.err($$update public.player_claims set status = 'approved' where user_id = 'abababab-0000-0000-0000-000000000005'$$), 'P0008');
select pg_temp.expect('declining it is fine',
  pg_temp.err($$update public.player_claims set status = 'declined' where user_id = 'abababab-0000-0000-0000-000000000005'$$), '');

-- ---------------------------------------------------------------------------
-- Withdrawing ends her access
-- ---------------------------------------------------------------------------
set role authenticated;
select pg_temp.as_user('abababab-0000-0000-0000-000000000002');
select pg_temp.expect('only her parent withdraws', pg_temp.err($$select public.withdraw_parental_consent('00000000-0000-0000-0000-0000000000c3')$$), '42501');
select pg_temp.as_user('abababab-0000-0000-0000-000000000001');
select public.withdraw_parental_consent('00000000-0000-0000-0000-0000000000c3');
select pg_temp.expect('withdrawn', (select status from public.parent_consent_status()), 'withdrawn');
select pg_temp.expect('nothing left to withdraw', pg_temp.err($$select public.withdraw_parental_consent('00000000-0000-0000-0000-0000000000c3')$$), 'P0002');
reset role;
select pg_temp.expect('her login is gone', (select count(*) from public.player_logins where player_id = '00000000-0000-0000-0000-0000000000c3'), 0::bigint);
select pg_temp.expect('and its account', (select count(*) from auth.users where email like 'riley00@%'), 0::bigint);

-- ---------------------------------------------------------------------------
-- A video call instead: the admin notes when and with whom
-- ---------------------------------------------------------------------------
set role authenticated;
select pg_temp.as_user('abababab-0000-0000-0000-000000000001');
select pg_temp.expect('video call asked', (select public.submit_parental_consent('00000000-0000-0000-0000-0000000000c3', 'video_call', 'Robin Chen', 'guardian', null, '2026-11-11') is not null), true);
reset role;
truncate consent_id;
insert into consent_id select id from public.parental_consents where player_id = '00000000-0000-0000-0000-0000000000c3' and status = 'pending';
set role authenticated;
select pg_temp.as_user('abababab-0000-0000-0000-000000000003');
select pg_temp.expect('a video call needs a note', pg_temp.err($$select public.review_parental_consent((select id from consent_id), true, null)$$), '22023');
select public.review_parental_consent((select id from consent_id), true, 'Video call Nov 12 with Robin Chen, her guardian; matched her ID to the account.');
reset role;
select pg_temp.expect('video call verified', (select status || '/' || relationship from public.parental_consents where id = (select id from consent_id)), 'verified/guardian');

-- ---------------------------------------------------------------------------
-- Clean up
-- ---------------------------------------------------------------------------
delete from public.parental_consents where player_id in ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c4');
delete from storage.objects where bucket_id = 'consent-forms';
delete from public.player_claims where user_id = 'abababab-0000-0000-0000-000000000005';
delete from auth.users where email like 'riley00@%';
delete from public.parent_links where parent_id::text like 'abababab-%';
delete from public.parent_accounts where user_id::text like 'abababab-%';
delete from public.staff where user_id::text like 'abababab-%';
delete from auth.users where id::text like 'abababab-%';
update public.players set birth_date = null
 where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c4');
