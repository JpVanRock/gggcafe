-- =============================================================================
-- pg_net out of the public schema (Supabase best-practice review, 2026-11-21)
-- The jobs outbox (migration 20261113124214) created pg_net without a schema, so it was
-- recorded in public, which Supabase's Security Advisor flags (extension_in_public). Its
-- functions live in the net schema either way; only the extension's home changes.
-- pg_net can't be moved with ALTER EXTENSION ... SET SCHEMA, so it is dropped and created again
-- in extensions. Nothing depends on it (checked 2026-11-21: no dependent objects, an empty
-- request queue); the job worker's calls (net.http_post) resolve when they run, and any job that
-- was due is picked up by the next minute's kick. Supabase's issue_pg_net_access event trigger
-- grants access again when it is created.
-- If this role isn't allowed to drop it, nothing changes and the notice says so: then switch it
-- off and on again under Database → Extensions in the dashboard, choosing the extensions schema.
-- The local test database has no pg_net and skips this.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net' and extnamespace = 'public'::regnamespace) then
    begin
      drop extension pg_net;
      create extension pg_net schema extensions;
      begin
        perform net.worker_restart();  -- so its background worker reads the new queue table
      exception when others then
        null;  -- older pg_net without it, or not allowed: the worker picks the table up itself
      end;
    exception when others then
      raise notice 'pg_net stays in public (%): move it under Database → Extensions', sqlerrm;
    end;
  end if;
end $$;
