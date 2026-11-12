-- =============================================================================
-- GGG.Cafe — Admins see what a parent or a mentor sees (user, 2026-11-12: to
-- troubleshoot their questions)
--
-- admin_view_parent(user) and admin_view_mentor(user) return, in one read, everything that
-- person's home page shows. Nobody signs in as anyone: for the length of this one read-only
-- call the database answers as that person (request.jwt.claims carries their id), so their
-- own access rules and functions decide what comes back, exactly as on their page. Only an
-- admin can call them, checked before anything else; they only read, and the setting
-- applies to this call's transaction alone and is put back before returning.
-- private.admin_account(user) adds what helps troubleshooting and the person can't see
-- (email, when the account was made and confirmed, last sign-in).
-- =============================================================================

create function private.admin_account(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_row jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'only admins' using errcode = '42501';
  end if;
  select to_jsonb(u) into v_row from auth.users u where u.id = p_user;
  if v_row is null then
    return null;
  end if;
  return jsonb_build_object(
    'id', p_user,
    'email', v_row ->> 'email',
    'created_at', v_row ->> 'created_at',
    'confirmed_at', v_row ->> 'email_confirmed_at',
    'last_sign_in_at', v_row ->> 'last_sign_in_at',
    'display_name', v_row -> 'raw_user_meta_data' ->> 'display_name',
    'signed_up_as', v_row -> 'raw_user_meta_data' ->> 'role'
  );
end $$;
select private.expose('private.admin_account(uuid)');

-- -----------------------------------------------------------------------------
-- A parent's family page, as they see it
-- -----------------------------------------------------------------------------
create function public.admin_view_parent(p_user uuid) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_claims  text := current_setting('request.jwt.claims', true);
  v_account jsonb;
  v_teams   uuid[];
  v_out     jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'only admins can see what someone else sees' using errcode = '42501';
  end if;
  v_account := private.admin_account(p_user);
  if v_account is null then
    raise exception 'no such account' using errcode = 'P0002';
  end if;

  -- from here to the end, the database answers as this parent
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select array_agg(distinct h.team_id) into v_teams from public.parent_home() h where h.status = 'approved';
  v_out := jsonb_build_object(
    'account', v_account,
    'profile', (select to_jsonb(p) from public.parent_accounts p where p.user_id = p_user),
    'links', coalesce((select jsonb_agg(to_jsonb(h)) from public.parent_home() h), '[]'::jsonb),
    'daughters', coalesce((
      select jsonb_agg(to_jsonb(d) || jsonb_build_object(
               'questionnaire', public.parent_questionnaire(d.player_id),
               'medical', public.parent_medical_card(d.player_id)))
        from public.parent_player_logins() d), '[]'::jsonb),
    'consent', coalesce((select jsonb_agg(to_jsonb(c)) from public.parent_consent_status() c), '[]'::jsonb),
    'packet', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'team_id', i.team_id, 'kind', i.kind, 'title', i.title) order by i.position)
                          from public.parent_packet_items i), '[]'::jsonb),
    'packet_read', coalesce((select jsonb_agg(r.item_id) from public.parent_packet_reads r where r.parent_id = p_user), '[]'::jsonb),
    'mentor_links', coalesce((select jsonb_agg(jsonb_build_object('mentor_id', l.mentor_id, 'team_id', l.team_id, 'player_id', l.player_id, 'status', l.status))
                                from public.mentor_links l where l.status <> 'declined'), '[]'::jsonb),
    'mentors', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'display_name', m.display_name, 'specialty', m.specialty))
                           from public.mentors m), '[]'::jsonb),
    'budgets', coalesce((select jsonb_agg(public.team_budget_summary(t)) from unnest(v_teams) t), '[]'::jsonb),
    'yearbook_teams', coalesce((select jsonb_agg(t) from unnest(v_teams) t where public.yearbook_access(t) is not null), '[]'::jsonb),
    'logos', coalesce((select jsonb_agg(to_jsonb(x)) from public.parent_team_logos() x), '[]'::jsonb)
  );
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return v_out;
end $$;
revoke all on function public.admin_view_parent(uuid) from public, anon;
grant execute on function public.admin_view_parent(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- A mentor's home page, as they see it
-- -----------------------------------------------------------------------------
create function public.admin_view_mentor(p_user uuid) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_claims  text := current_setting('request.jwt.claims', true);
  v_account jsonb;
  v_out     jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'only admins can see what someone else sees' using errcode = '42501';
  end if;
  v_account := private.admin_account(p_user);
  if v_account is null then
    raise exception 'no such account' using errcode = 'P0002';
  end if;

  -- from here to the end, the database answers as this mentor
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  v_out := jsonb_build_object(
    'account', v_account,
    'mentor', (select jsonb_build_object('display_name', m.display_name, 'specialty', m.specialty, 'approved_at', m.created_at)
                 from public.mentors m where m.user_id = p_user),
    'links', coalesce((select jsonb_agg(to_jsonb(l)) from public.my_mentor_links() l), '[]'::jsonb),
    -- the players and teams her access rules let her read
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'name', coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name,
               'position', p.primary_position,
               'team', (select t.name from public.roster_entries r join public.teams t on t.id = r.team_id
                         where r.player_id = p.id and r.active order by r.created_at desc limit 1),
               'jersey', (select r.jersey_number from public.roster_entries r
                           where r.player_id = p.id and r.active order by r.created_at desc limit 1))
             order by p.last_name, p.first_name)
        from public.players p), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
        from (select m.player_id, m.body, m.drill_name, m.photo_path is not null as has_photo, m.created_at, m.read_at, m.shared_with_coaches
                from public.mentor_messages m where m.sender_id = p_user order by m.created_at desc limit 20) x), '[]'::jsonb),
    'training', coalesce((
      select jsonb_agg(jsonb_build_object('player_id', a.player_id, 'title', a.title, 'starts_on', a.starts_on, 'ends_on', a.ends_on) order by a.starts_on)
        from public.player_activities a
       where a.source = 'mentor' and a.created_by = p_user and a.ends_on >= current_date), '[]'::jsonb),
    'notes', (select count(*) from public.mentor_notes n where n.mentor_id = p_user),
    'focus', (select count(*) from public.mentor_focus f where f.mentor_id = p_user)
  );
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return v_out;
end $$;
revoke all on function public.admin_view_mentor(uuid) from public, anon;
grant execute on function public.admin_view_mentor(uuid) to authenticated;
