-- =============================================================================
-- GGG.Cafe — Password reset: at most 4 reset emails per address every 20 minutes
-- (user, 2026-11-09). The forgot-password page asks allow_password_reset() before
-- Supabase sends the email. Only a SHA-256 fingerprint of the address is kept (never the
-- address), for a day; it counts for any address, so it doesn't reveal who has an account.
-- Supabase's own limits still apply on top (one email per address per minute, and the
-- project's emails per hour).
-- =============================================================================

create table private.password_reset_requests (
  email_hash   text not null,
  requested_at timestamptz not null default now()
);
create index password_reset_requests_recent on private.password_reset_requests (email_hash, requested_at);
revoke all on private.password_reset_requests from public, anon, authenticated;

-- True (and counted) when this address has had fewer than 4 requests in the last 20 minutes.
-- Signed-out visitors call it from the forgot-password page, so there's no caller to check.
create function private.allow_password_reset(p_email text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_hash   text := encode(sha256(convert_to(lower(trim(coalesce(p_email, ''))), 'UTF8')), 'hex');
  v_recent int;
begin
  -- one request at a time per address, so two quick clicks can't both slip under the limit
  perform pg_advisory_xact_lock(hashtext(v_hash));
  delete from private.password_reset_requests where requested_at < now() - interval '1 day';
  select count(*) into v_recent
    from private.password_reset_requests
   where email_hash = v_hash and requested_at > now() - interval '20 minutes';
  if v_recent >= 4 then
    return false;
  end if;
  insert into private.password_reset_requests (email_hash) values (v_hash);
  return true;
end $$;
select private.expose('private.allow_password_reset(text)', array['anon', 'authenticated']);
