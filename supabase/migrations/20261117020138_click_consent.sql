-- =============================================================================
-- GGG.Cafe — Parental consent by clicking Accept (user, 2026-11-16)
--   "Please remove the physical consent sign form process. They should be able to click accept to
--   provide consent. The database can record the IP address and timestamp with email they
--   registered with as proof. Remove the Can't print section as well."
--   The user chose this knowing it likely isn't a COPPA-recognized method of verifiable consent
--   (signed form, video call, card check, ID check); see docs/features/legal.md.
--
--   * accept_parental_consent: her approved parent reads the notice, ticks the statement and clicks
--     Accept. The consent is on file at once (method 'online', status 'verified', no admin check),
--     with the proof: the parent's sign-in email, the time, and the IP address and browser the app
--     saw (the server action passes them; the database can't see the visitor itself).
--   * A request the parent sent earlier (a signed form or a video call) that's still waiting is
--     withdrawn when they accept online. Older forms already checked stay as they are.
--   * The signed-form and video-call functions stay for records made before this change.
-- =============================================================================

alter table public.parental_consents drop constraint parental_consents_method_check;
alter table public.parental_consents add constraint parental_consents_method_check
  check (method in ('signed_form', 'video_call', 'online'));
alter table public.parental_consents
  add column consent_email      text check (consent_email is null or char_length(consent_email) <= 320),
  add column consent_ip         text check (consent_ip is null or char_length(consent_ip) <= 64),
  add column consent_user_agent text check (consent_user_agent is null or char_length(consent_user_agent) <= 500);
comment on column public.parental_consents.consent_email is 'Online consent: the parent''s sign-in email when they accepted.';
comment on column public.parental_consents.consent_ip is 'Online consent: the IP address the parent accepted from (as the app server saw it).';
comment on column public.parental_consents.consent_user_agent is 'Online consent: the browser the parent accepted from.';
comment on table public.parental_consents is
  'Parental consent (COPPA) for players under 13: accepted online (with email, time, IP and browser as the record) or, before 2026-11-16, a signed form or video call checked by an admin. Written only by the consent functions.';

create function private.accept_parental_consent(
  p_player_id uuid, p_parent_name text, p_relationship text, p_notice_version text, p_ip text, p_user_agent text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_name  text := trim(coalesce(p_parent_name, ''));
  v_email text;
  v_id    uuid;
begin
  if v_uid is null or not (select private.is_parent_of(p_player_id)) then
    raise exception 'only her approved parent can give consent' using errcode = '42501';
  end if;
  if not coalesce(private.player_is_under_13(p_player_id), false) then
    raise exception 'consent is only needed for players under 13' using errcode = '22023';
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
  if exists (select 1 from public.parental_consents c where c.player_id = p_player_id and c.status = 'verified') then
    raise exception 'consent is already on file' using errcode = '23505';
  end if;
  -- a signed form or video call request still waiting: this replaces it
  update public.parental_consents set status = 'withdrawn', withdrawn_at = now()
   where player_id = p_player_id and status = 'pending';

  select u.email::text into v_email from auth.users u where u.id = v_uid;
  insert into public.parental_consents (player_id, parent_id, method, status, parent_name, relationship, notice_version,
                                        reviewed_at, consent_email, consent_ip, consent_user_agent)
  values (p_player_id, v_uid, 'online', 'verified', v_name, p_relationship, p_notice_version, now(), v_email,
          nullif(left(trim(coalesce(p_ip, '')), 64), ''), nullif(left(trim(coalesce(p_user_agent, '')), 500), ''))
  returning id into v_id;
  return v_id;
end $$;
select private.expose('private.accept_parental_consent(uuid,text,text,text,text,text)');
