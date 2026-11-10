-- =============================================================================
-- GGG.Cafe — Terms of Service agreements (user, 2026-11-09)
-- Every account agrees to the Terms of Service and the Privacy & Security Notice: at sign-up (a
-- checkbox; the version rides in the new account's metadata and the trigger below records it) or
-- on /terms/accept (accounts made before the Terms, player logins a parent made, and everyone
-- after a new version). One row per account and version, stamped by the database, never edited.
-- =============================================================================

create table public.terms_acceptances (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  version     text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);

-- Not apply_staff_rls: every account (players, parents and mentors too) records its own agreement,
-- and only admins read anyone else's. Rows are a permanent record: no updates or deletes through
-- the API, and the account and time always come from the database (only `version` is writable).
alter table public.terms_acceptances enable row level security;
create policy "see own agreements; admins see all" on public.terms_acceptances
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "record own agreement" on public.terms_acceptances
  for insert to authenticated with check (user_id = (select auth.uid()));
revoke all on public.terms_acceptances from anon, authenticated;
grant select on public.terms_acceptances to authenticated;
grant insert (version) on public.terms_acceptances to authenticated;

-- Sign-up: the form puts the agreed version in the new account's metadata; record it as the
-- account is created (Supabase Auth inserts the auth.users row).
create function private.record_signup_terms() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data ->> 'terms_version' ~ '^\d{4}-\d{2}-\d{2}$' then
    insert into public.terms_acceptances (user_id, version, accepted_at)
    values (new.id, new.raw_user_meta_data ->> 'terms_version', coalesce(new.created_at, now()))
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function private.record_signup_terms() from public;
create trigger record_signup_terms after insert on auth.users
  for each row execute function private.record_signup_terms();
