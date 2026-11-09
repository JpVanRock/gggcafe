-- =============================================================================
-- One way to publish a privileged function (refactoring roadmap step 8)
--   private.expose(fn, roles) writes the public, security-invoker wrapper for a private
--   security-definer function and all of its grants, after checking the function is
--   set up safely (security definer + search_path = ''). Template:
--   supabase/templates/definer-function.sql; check: tests/db/zz_functions.test.sql.
--   The four functions that still ran with elevated rights from the public schema move
--   to private behind generated wrappers (same names and arguments: the app is unchanged),
--   and signed-out visitors lose functions they never needed.
-- =============================================================================

create function private.expose(p_fn regprocedure, p_roles text[] default array['authenticated']) returns void
language plpgsql set search_path = '' as $$
declare
  v_name   text;
  v_args   text;
  v_ident  text;
  v_result text;
  v_set    boolean;
  v_vol    text;
  v_call   text;
  v_role   text;
begin
  select p.proname, pg_get_function_arguments(p.oid), pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid),
         p.proretset or pg_get_function_result(p.oid) like 'TABLE(%',
         case p.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end
    into v_name, v_args, v_ident, v_result, v_set, v_vol
    from pg_proc p
   where p.oid = p_fn and p.pronamespace = 'private'::regnamespace;
  if not found then
    raise exception 'private.expose: % is not a function in the private schema', p_fn;
  end if;
  if not exists (select 1 from pg_proc p where p.oid = p_fn and p.prosecdef and 'search_path=""' = any (coalesce(p.proconfig, '{}'))) then
    raise exception 'private.expose: % must be security definer with set search_path = ''''', p_fn;
  end if;
  -- pass every input argument through by name
  select string_agg(format('%1$I => %1$I', a.n), ', ' order by a.o) into v_call
    from pg_proc p
    cross join lateral unnest(coalesce(p.proargnames, '{}'), coalesce(p.proargmodes::text[], array_fill('i'::text, array[coalesce(cardinality(p.proargnames), 0)])))
           with ordinality as a(n, m, o)
   where p.oid = p_fn and a.m in ('i', 'b', 'v');

  execute format(
    'create or replace function public.%I(%s) returns %s language sql %s security invoker set search_path = '''' as $wrap$ select %s private.%I(%s) $wrap$',
    v_name, v_args, v_result, v_vol, case when v_set then '* from' else '' end, v_name, coalesce(v_call, ''));
  execute format('comment on function public.%I(%s) is %L', v_name, v_ident, 'Wrapper made by private.expose for private.' || v_name || '.');
  execute format('revoke all on function public.%I(%s) from public, anon', v_name, v_ident);
  execute format('revoke all on function %s from public, anon', p_fn);
  foreach v_role in array p_roles loop
    execute format('grant execute on function public.%I(%s) to %I', v_name, v_ident, v_role);
    execute format('grant execute on function %s to %I', p_fn, v_role);
  end loop;
end $$;
revoke all on function private.expose(regprocedure, text[]) from public;

-- Private functions everyone (PUBLIC) could execute keep that right for signed-in users only,
-- so signed-out visitors can be let into the schema for exactly what they're granted.
do $$
declare
  v_fn regprocedure;
begin
  for v_fn in select p.oid::regprocedure from pg_proc p
               where p.pronamespace = 'private'::regnamespace and has_function_privilege('public', p.oid, 'execute') loop
    execute format('revoke execute on function %s from public', v_fn);
    execute format('grant execute on function %s to authenticated, service_role', v_fn);
  end loop;
end $$;
grant usage on schema private to anon;

-- The four public security-definer functions move behind generated wrappers.
alter function public.start_iq_level(uuid, public.iq_track, smallint, boolean, public.field_position) set schema private;
alter function public.finish_iq_level(uuid) set schema private;
alter function public.iq_review_status(uuid) set schema private;
alter function public.signup_teams() set schema private;
alter function private.start_iq_level(uuid, public.iq_track, smallint, boolean, public.field_position) set search_path = '';
alter function private.finish_iq_level(uuid) set search_path = '';
alter function private.iq_review_status(uuid) set search_path = '';
alter function private.signup_teams() set search_path = '';
select private.expose('private.start_iq_level(uuid, public.iq_track, smallint, boolean, public.field_position)');
select private.expose('private.finish_iq_level(uuid)');
select private.expose('private.iq_review_status(uuid)');
-- the sign-up page lists teams before anyone has an account
select private.expose('private.signup_teams()', array['anon', 'authenticated']);

-- Only signed-in users need these.
revoke all on function public.team_leaderboard(uuid) from public, anon;
grant execute on function public.team_leaderboard(uuid) to authenticated;
revoke all on function public.unread_notifications() from public, anon;
grant execute on function public.unread_notifications() to authenticated;
do $$
declare
  v_fn regprocedure;
begin
  for v_fn in select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'pa\_%' loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;
