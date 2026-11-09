-- One definition of a team's current season for the app too: the app calls this instead
-- of re-implementing "latest season with a roster" in TypeScript (src/lib/roster.ts).
create function public.team_current_season(p_team_id uuid) returns uuid
language sql stable security invoker set search_path = '' as $$ select private.team_current_season(p_team_id) $$;
revoke all on function public.team_current_season(uuid) from public, anon;
grant execute on function public.team_current_season(uuid) to authenticated;
