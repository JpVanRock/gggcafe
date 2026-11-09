-- The app's "current season" comes from the database (public.team_current_season), the
-- same rule claims and RLS use: the team's latest season with a roster.
-- Seed: team b1 has its roster in season a1.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values ('f1f1f1f1-0000-0000-0000-000000000001', 'coach-rs@example.test', '{}');
insert into public.staff (user_id, display_name, role) values ('f1f1f1f1-0000-0000-0000-000000000001', 'RS Coach', 'coach');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1f1f1f1-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('current season', public.team_current_season('00000000-0000-0000-0000-0000000000b1'), '00000000-0000-0000-0000-0000000000a1'::uuid);
select pg_temp.expect('no roster, no season', public.team_current_season('00000000-0000-0000-0000-000000000999') is null, true);
reset role;

select set_config('request.jwt.claims', '', false);
delete from public.staff where user_id = 'f1f1f1f1-0000-0000-0000-000000000001';
delete from auth.users where id = 'f1f1f1f1-0000-0000-0000-000000000001';
