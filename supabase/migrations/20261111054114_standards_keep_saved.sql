-- =============================================================================
-- GGG.Cafe — Saving Team Standards never drops saved ones (user's report, 2026-11-11)
-- The save used to replace a team's whole list with the form's rows, so a form opened
-- before other standards were saved (another tab, the phone app) wiped them when a coach
-- added one. Now each standard is kept by its id, and only the ones a coach removed go:
--   items: [{ "id"?: uuid, "title": text, "detail"?: text, "remove"?: true }, ...] in order
--   - an item with an id (or the same title as a saved standard) updates that standard
--   - an item without either is a new standard
--   - only an item with "remove": true (or an id and a blank title) deletes one
--   - saved standards the form didn't mention stay, after the form's list, in their order
-- Same name and arguments as before, so grants are unchanged.
-- =============================================================================

create or replace function public.save_team_dugout(p_team_id uuid, p_headline text, p_statement text, p_standards jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_item    jsonb;
  v_id      uuid;
  v_title   text;
  v_removed uuid[] := '{}';
  v_used    uuid[] := '{}';
  v_final   jsonb := '[]'::jsonb;
  v_row     record;
  v_pos     smallint := 0;
begin
  if not (select private.can_edit()) then
    raise exception 'only coaches and admins can change team standards' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_standards, '[]'::jsonb)) <> 'array' then
    raise exception 'standards must be a list' using errcode = '22023';
  end if;

  insert into public.team_culture (team_id, headline, statement, updated_by, updated_at)
  values (p_team_id, nullif(trim(p_headline), ''), nullif(trim(p_statement), ''), auth.uid(), now())
  on conflict (team_id) do update
    set headline = excluded.headline, statement = excluded.statement,
        updated_by = excluded.updated_by, updated_at = now();

  -- the team's saved standards, locked while we work
  perform 1 from public.team_standards where team_id = p_team_id for update;

  -- 1. what the coach removed
  for v_item in select * from jsonb_array_elements(coalesce(p_standards, '[]'::jsonb)) loop
    v_id := nullif(v_item ->> 'id', '')::uuid;
    if v_id is not null and (coalesce((v_item ->> 'remove')::boolean, false) or coalesce(trim(v_item ->> 'title'), '') = '') then
      v_removed := v_removed || v_id;
    end if;
  end loop;

  -- 2. the form's list, in its order: saved standards by id or by title, then new ones
  for v_item in select * from jsonb_array_elements(coalesce(p_standards, '[]'::jsonb)) loop
    continue when coalesce((v_item ->> 'remove')::boolean, false);
    v_title := trim(coalesce(v_item ->> 'title', ''));
    continue when v_title = '';
    v_id := nullif(v_item ->> 'id', '')::uuid;
    select s.id, s.created_at into v_row from public.team_standards s
     where s.team_id = p_team_id and not (s.id = any (v_used)) and not (s.id = any (v_removed))
       and (s.id = v_id or (v_id is null and s.title = v_title))
     order by (s.id = v_id) desc nulls last, s.position
     limit 1;
    if v_row.id is not null then
      v_used := v_used || v_row.id;
      v_final := v_final || jsonb_build_object('id', v_row.id, 'created_at', v_row.created_at, 'title', v_title, 'detail', nullif(trim(v_item ->> 'detail'), ''));
    else
      v_final := v_final || jsonb_build_object('id', gen_random_uuid(), 'created_at', now(), 'title', v_title, 'detail', nullif(trim(v_item ->> 'detail'), ''));
    end if;
  end loop;

  -- 3. saved standards the form didn't know about stay, after the form's list
  for v_row in select s.id, s.created_at, s.title, s.detail from public.team_standards s
                where s.team_id = p_team_id and not (s.id = any (v_used)) and not (s.id = any (v_removed))
                order by s.position loop
    v_final := v_final || jsonb_build_object('id', v_row.id, 'created_at', v_row.created_at, 'title', v_row.title, 'detail', v_row.detail);
  end loop;

  if jsonb_array_length(v_final) > 25 then
    raise exception 'a team can have up to 25 standards' using errcode = '22023';
  end if;

  -- 4. write the list back in order (same ids, so nothing that points at a standard breaks)
  delete from public.team_standards where team_id = p_team_id;
  for v_item in select * from jsonb_array_elements(v_final) loop
    v_pos := v_pos + 1;
    insert into public.team_standards (id, team_id, position, title, detail, created_at)
    values ((v_item ->> 'id')::uuid, p_team_id, v_pos, v_item ->> 'title', v_item ->> 'detail', (v_item ->> 'created_at')::timestamptz);
  end loop;
end;
$$;
