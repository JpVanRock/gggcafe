-- =============================================================================
-- GGG.Cafe — Verified parental consent for players under 13 (user, 2026-11-11)
--
-- The children's privacy rule (COPPA) needs verifiable parental consent, by a method
-- the FTC recognizes, before we collect information from a child under 13. A parent
-- making her login used to count as consent; now a GGG.Cafe admin (our staff) checks
-- one of two methods first:
--   * signed_form: the parent downloads the consent form, signs it by hand and
--     uploads a photo or scan of it (private bucket consent-forms); or
--   * video_call:  the parent asks for a short video call with a GGG.Cafe admin.
-- Until a player under 13 has verified consent:
--   * her parent can't create her login (create_player_login), and
--   * nobody can approve a profile claim for her (trigger on player_claims), which
--     also catches a child who signed herself up with the wrong age.
-- A parent-made login now also needs her birth date on her profile, so we know her age.
-- A parent can withdraw consent at any time: her parent-made login is deleted and her
-- approved claims are declined, so she can't sign in any more.
--
-- RLS exception (not apply_staff_rls): a consent record holds a parent's signature and
-- identity. Only that parent, the player's other approved parents and admins read it;
-- coaches don't. Every write goes through the functions below.
-- =============================================================================

create table public.parental_consents (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.players (id) on delete cascade,
  parent_id      uuid not null references auth.users (id) on delete cascade,
  method         text not null check (method in ('signed_form', 'video_call')),
  status         text not null default 'pending' check (status in ('pending', 'verified', 'declined', 'withdrawn')),
  parent_name    text not null check (char_length(parent_name) between 2 and 120),
  relationship   text not null check (relationship in ('parent', 'guardian')),
  form_path      text check (form_path is null or form_path ~ '^[0-9a-f-]{36}/[0-9]{10,16}\.(jpg|png|webp|pdf)$'),
  -- the version of the consent notice the parent agreed to (the Terms' version date)
  notice_version text not null check (notice_version ~ '^\d{4}-\d{2}-\d{2}$'),
  submitted_at   timestamptz not null default now(),
  reviewed_by    uuid references auth.users (id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text check (review_note is null or char_length(review_note) <= 500),
  withdrawn_at   timestamptz,
  check (method <> 'signed_form' or form_path is not null)
);
create index parental_consents_player_idx on public.parental_consents (player_id, status);
create index parental_consents_parent_idx on public.parental_consents (parent_id);
create index parental_consents_reviewer_idx on public.parental_consents (reviewed_by);
-- one open request or verified consent per player at a time
create unique index parental_consents_open_idx on public.parental_consents (player_id) where status in ('pending', 'verified');
comment on table public.parental_consents is
  'Verified parental consent (COPPA) for players under 13: the parent''s signed form or video call, checked by an admin. Written only by the consent functions.';

alter table public.parental_consents enable row level security;
create policy "her parents and admins read consents" on public.parental_consents for select to authenticated
  using (parent_id = (select auth.uid()) or (select private.is_parent_of(player_id)) or (select private.is_admin()));

-- Under 13 by her birth date; null when it isn't on her profile.
create function private.player_is_under_13(p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p.birth_date > (current_date - interval '13 years') from public.players p where p.id = p_player_id
$$;
create function private.has_parental_consent(p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.parental_consents c where c.player_id = p_player_id and c.status = 'verified')
$$;
revoke all on function private.player_is_under_13(uuid), private.has_parental_consent(uuid) from public;

-- Signed forms: private; a parent uploads to her own folder; she and admins read; admins remove.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consent-forms', 'consent-forms', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy "parents upload signed consent forms" on storage.objects for insert to authenticated
  with check (bucket_id = 'consent-forms' and split_part(name, '/', 1) = (select auth.uid())::text
              and name ~ '^[0-9a-f-]{36}/[0-9]{10,16}\.(jpg|png|webp|pdf)$');
create policy "consent forms: the parent and admins" on storage.objects for select to authenticated
  using (bucket_id = 'consent-forms' and (split_part(name, '/', 1) = (select auth.uid())::text or (select private.is_admin())));
create policy "admins remove consent forms" on storage.objects for delete to authenticated
  using (bucket_id = 'consent-forms' and (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- A parent asks: her signed form, or a video call
-- -----------------------------------------------------------------------------
create function private.submit_parental_consent(
  p_player_id uuid, p_method text, p_parent_name text, p_relationship text, p_form_path text, p_notice_version text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  v_name text := trim(coalesce(p_parent_name, ''));
  v_id   uuid;
begin
  if v_uid is null or not (select private.is_parent_of(p_player_id)) then
    raise exception 'only her approved parent can give consent' using errcode = '42501';
  end if;
  if not coalesce(private.player_is_under_13(p_player_id), false) then
    raise exception 'consent is only needed for players under 13' using errcode = '22023';
  end if;
  if p_method is null or p_method not in ('signed_form', 'video_call') then
    raise exception 'choose the signed form or a video call' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'enter your full name' using errcode = '22023';
  end if;
  if p_relationship is null or p_relationship not in ('parent', 'guardian') then
    raise exception 'say whether you are her parent or legal guardian' using errcode = '22023';
  end if;
  if coalesce(p_notice_version, '') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'unknown consent notice' using errcode = '22023';
  end if;
  if p_method = 'signed_form' and (
       p_form_path is null
       or split_part(p_form_path, '/', 1) <> v_uid::text
       or not exists (select 1 from storage.objects o where o.bucket_id = 'consent-forms' and o.name = p_form_path)) then
    raise exception 'upload the signed form first' using errcode = '22023';
  end if;
  if exists (select 1 from public.parental_consents c where c.player_id = p_player_id and c.status in ('pending', 'verified')) then
    raise exception 'consent is already on file or waiting to be checked' using errcode = '23505';
  end if;
  insert into public.parental_consents (player_id, parent_id, method, parent_name, relationship, form_path, notice_version)
  values (p_player_id, v_uid, p_method, v_name, p_relationship,
          case when p_method = 'signed_form' then p_form_path end, p_notice_version)
  returning id into v_id;
  return v_id;
end $$;
select private.expose('private.submit_parental_consent(uuid,text,text,text,text,text)');

-- The parent's view: each approved daughter, whether she's under 13, and her latest consent.
create function private.parent_consent_status()
returns table (
  player_id uuid, birth_date date, under_13 boolean, consent_id uuid, status text, method text,
  parent_name text, submitted_at timestamptz, reviewed_at timestamptz, review_note text
)
language sql stable security definer set search_path = '' as $$
  select l.player_id, p.birth_date,
         coalesce(p.birth_date > (current_date - interval '13 years'), false),
         c.id, c.status, c.method, c.parent_name, c.submitted_at, c.reviewed_at, c.review_note
    from (select distinct pl.player_id from public.parent_links pl
           where pl.parent_id = (select auth.uid()) and pl.status = 'approved' and pl.player_id is not null) l
    join public.players p on p.id = l.player_id
    left join lateral (select c2.* from public.parental_consents c2
                        where c2.player_id = l.player_id
                        order by c2.submitted_at desc limit 1) c on true
$$;
select private.expose('private.parent_consent_status()');

-- -----------------------------------------------------------------------------
-- An admin checks it (our staff): verified or declined (a reason is required to
-- decline, and a verified video call notes when it happened and with whom)
-- -----------------------------------------------------------------------------
create function private.review_parental_consent(p_id uuid, p_verify boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_note   text := nullif(trim(coalesce(p_note, '')), '');
  v_method text;
begin
  if not (select private.is_admin()) then
    raise exception 'only a GGG.Cafe admin checks consent' using errcode = '42501';
  end if;
  if char_length(coalesce(v_note, '')) > 500 then
    raise exception 'keep the note to 500 characters' using errcode = '22023';
  end if;
  select c.method into v_method from public.parental_consents c where c.id = p_id and c.status = 'pending';
  if v_method is null then
    raise exception 'that request was already decided' using errcode = 'P0002';
  end if;
  if not p_verify and v_note is null then
    raise exception 'say why it was declined' using errcode = '22023';
  end if;
  if p_verify and v_method = 'video_call' and v_note is null then
    raise exception 'note when the video call happened and who you spoke with' using errcode = '22023';
  end if;
  update public.parental_consents
     set status = case when p_verify then 'verified' else 'declined' end,
         reviewed_by = (select auth.uid()), reviewed_at = now(), review_note = v_note
   where id = p_id;
end $$;
select private.expose('private.review_parental_consent(uuid,boolean,text)');

-- Requests waiting for an admin (others get none, so the waiting count stays 0 for them).
create function private.pending_parental_consents()
returns table (
  id uuid, player_id uuid, player_name text, birth_date date, team_name text, parent_name text,
  parent_account text, parent_email text, relationship text, method text, form_path text, submitted_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then
    return;
  end if;
  return query
    select c.id, c.player_id, coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name, p.birth_date,
           (select t.name from public.roster_entries r join public.teams t on t.id = r.team_id
             where r.player_id = c.player_id and r.active order by r.created_at desc limit 1),
           c.parent_name, pa.display_name, u.email::text, c.relationship, c.method, c.form_path, c.submitted_at
      from public.parental_consents c
      join public.players p on p.id = c.player_id
      left join public.parent_accounts pa on pa.user_id = c.parent_id
      left join auth.users u on u.id = c.parent_id
     where c.status = 'pending'
     order by c.submitted_at;
end $$;
select private.expose('private.pending_parental_consents()');

-- -----------------------------------------------------------------------------
-- A parent withdraws consent: she can't sign in any more
-- -----------------------------------------------------------------------------
create function private.withdraw_parental_consent(p_player_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_login uuid;
begin
  if not (select private.is_parent_of(p_player_id)) then
    raise exception 'only her approved parent can withdraw consent' using errcode = '42501';
  end if;
  update public.parental_consents
     set status = 'withdrawn', withdrawn_at = now()
   where player_id = p_player_id and status in ('pending', 'verified');
  if not found then
    raise exception 'there is no consent to withdraw' using errcode = 'P0002';
  end if;
  select l.user_id into v_login from public.player_logins l where l.player_id = p_player_id;
  if v_login is not null then
    delete from auth.users where id = v_login;
  end if;
  update public.player_claims c
     set status = 'declined', decided_by = (select auth.uid()), decided_at = now()
   where c.status = 'approved'
     and c.roster_entry_id in (select r.id from public.roster_entries r where r.player_id = p_player_id);
end $$;
select private.expose('private.withdraw_parental_consent(uuid)');

-- -----------------------------------------------------------------------------
-- No claim approved for a player under 13 without verified consent
-- -----------------------------------------------------------------------------
create function private.claims_need_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_player uuid;
begin
  if new.status = 'approved' and new.roster_entry_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'approved' or old.roster_entry_id is distinct from new.roster_entry_id) then
    select r.player_id into v_player from public.roster_entries r where r.id = new.roster_entry_id;
    if coalesce(private.player_is_under_13(v_player), false) and not private.has_parental_consent(v_player) then
      raise exception 'she is under 13: her parent gives verified consent first, then makes her login' using errcode = 'P0008';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.claims_need_consent() from public;
create trigger claims_need_consent before insert or update of status, roster_entry_id on public.player_claims
  for each row execute function private.claims_need_consent();

-- -----------------------------------------------------------------------------
-- create_player_login: as before (20261108210100_account_types), plus her birth date
-- must be on her profile and, under 13, verified consent must be on file.
-- -----------------------------------------------------------------------------
create or replace function private.create_player_login(p_player_id uuid, p_username text, p_password text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_parent uuid := (select auth.uid());
  v_team   uuid;
  v_entry  public.roster_entries;
  v_player public.players;
  v_name   text := lower(trim(coalesce(p_username, '')));
  v_email  text;
  v_user   uuid := gen_random_uuid();
begin
  if v_parent is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select l.team_id into v_team
    from public.parent_links l
   where l.parent_id = v_parent and l.player_id = p_player_id and l.status = 'approved'
   order by l.decided_at desc nulls last
   limit 1;
  if v_team is null then
    raise exception 'only her approved parent can create her login' using errcode = '42501';
  end if;
  select r.* into v_entry
    from public.roster_entries r
   where r.team_id = v_team and r.player_id = p_player_id and r.active
     and r.season_id = private.team_current_season(v_team);
  if v_entry.id is null then
    raise exception 'she isn''t on the team''s current roster' using errcode = 'P0006';
  end if;
  if exists (select 1 from public.player_logins where player_id = p_player_id) then
    raise exception 'she already has a login' using errcode = '23505';
  end if;
  if exists (select 1 from public.player_claims c where c.roster_entry_id = v_entry.id and c.status = 'approved') then
    raise exception 'she already has her own account' using errcode = 'P0007';
  end if;
  if v_name !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception 'usernames are 3 to 30 letters, numbers, dots, dashes or underscores' using errcode = '22023';
  end if;
  perform private.check_player_password(p_password);
  v_email := private.player_login_email(v_name);
  if exists (select 1 from public.player_logins where username = v_name)
     or exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'that username is taken' using errcode = '23505';
  end if;
  select * into v_player from public.players where id = p_player_id;
  if v_player.birth_date is null then
    raise exception 'her birth date isn''t on her profile yet' using errcode = 'P0009';
  end if;
  if private.player_is_under_13(p_player_id) and not private.has_parental_consent(p_player_id) then
    raise exception 'she is under 13: verified parental consent comes first' using errcode = 'P0008';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
          '', '', '', '',
          '{"provider": "email", "providers": ["email"]}'::jsonb,
          jsonb_build_object('display_name', coalesce(v_player.preferred_name, v_player.first_name) || ' ' || v_player.last_name,
                             'role', 'player', 'username', v_name),
          now(), now());
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_user::text, v_user,
          jsonb_build_object('sub', v_user::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now());
  insert into public.player_logins (user_id, player_id, username, created_by)
  values (v_user, p_player_id, v_name, v_parent);
  insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status, decided_by, decided_at)
  values (v_user, v_team, v_entry.season_id, v_entry.id,
          coalesce(v_player.preferred_name, v_player.first_name) || ' ' || v_player.last_name,
          case when v_entry.jersey_number ~ '^\d{1,2}$' then v_entry.jersey_number end,
          'approved', v_parent, now());
  return v_name;
end;
$$;
