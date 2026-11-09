-- Template: a function that needs the database's own rights (reads rows the caller can't, or
-- writes several tables in one go). Copy into a new migration (npm run db:new:definer <name>)
-- and replace my_function, its arguments and its body.
--
-- Rules (tests/db/zz_functions.test.sql enforces them):
--   * it lives in the private schema (not exposed by the API), security definer,
--     with set search_path = '' (so every name below is fully qualified: public.table);
--   * it checks the caller first (private.can_edit(), private.is_head_coach(),
--     private.can_act_for(p_player_id), ...) and raises 42501 when not allowed;
--   * private.expose() writes the public wrapper the app calls (supabase.rpc("my_function"))
--     and the grants: authenticated by default, add 'anon' only for signed-out pages.

create function private.my_function(p_team_id uuid)
returns table (id uuid, name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.can_edit()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select t.id, t.name from public.teams t where t.id = p_team_id;
end $$;

select private.expose('private.my_function(uuid)');
-- or, for a page signed-out visitors use: select private.expose('private.my_function(uuid)', array['anon', 'authenticated']);
