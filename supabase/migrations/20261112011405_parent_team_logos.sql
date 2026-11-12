-- =============================================================================
-- GGG.Cafe — The team logo at the top left for parents (user, 2026-11-12)
--
-- When a team has a logo, coaches' and parents' pages show it next to the GGG.Cafe logo
-- in the header. Staff read teams directly; parents can't (they read no app tables), so
-- this returns just the name and logo path of the teams they're approved for, logos
-- first. The logo file itself stays in the private team-logos bucket and is shown through
-- a short-lived signed link, as everywhere else.
-- =============================================================================

create function private.parent_team_logos()
returns table (team_id uuid, team_name text, logo_path text)
language sql stable security definer set search_path = '' as $$
  select distinct on (t.name, t.id) t.id, t.name, t.logo_path
    from public.parent_links l
    join public.teams t on t.id = l.team_id
   where l.parent_id = (select auth.uid()) and l.status = 'approved' and t.logo_path is not null
   order by t.name, t.id
$$;
select private.expose('private.parent_team_logos()');
