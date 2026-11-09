-- The rules for privileged functions (supabase/templates/definer-function.sql):
--   * no security-definer function in public (it would run with the database's rights
--     straight from the API): they live in private behind a wrapper (private.expose);
--   * every security-definer function pins search_path = '';
--   * no security-definer function is executable by everyone (PUBLIC) or signed-out visitors,
--     except the ones a signed-out page needs;
--   * signed-out visitors can call only the public functions sign-up needs.
do $$
declare
  r record;
  anon_ok text[] := array['signup_teams'];
begin
  for r in select p.oid::regprocedure as f from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef loop
    raise exception 'FAIL: % is security definer in public: move it to private and use private.expose()', r.f;
  end loop;
  for r in select p.oid::regprocedure as f from pg_proc p
            where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and p.prosecdef
              and not ('search_path=""' = any (coalesce(p.proconfig, '{}'))) loop
    raise exception 'FAIL: % is security definer without set search_path = ''''', r.f;
  end loop;
  for r in select p.oid::regprocedure as f from pg_proc p
            where p.pronamespace = 'private'::regnamespace and p.prosecdef and has_function_privilege('public', p.oid, 'execute') loop
    raise exception 'FAIL: everyone (PUBLIC) can execute %: revoke it', r.f;
  end loop;
  for r in select p.oid::regprocedure as f from pg_proc p
            where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and p.prokind = 'f'
              and has_function_privilege('anon', p.oid, 'execute') and not (p.proname = any (anon_ok)) loop
    raise exception 'FAIL: signed-out visitors can execute %', r.f;
  end loop;
end $$;

-- private.expose() refuses an unsafe function
create function private.zz_unsafe_probe() returns int language sql as $$ select 1 $$;
do $$
begin
  perform private.expose('private.zz_unsafe_probe()');
  raise exception 'FAIL: expose() accepted a function that is not security definer';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
end $$;
drop function private.zz_unsafe_probe();
