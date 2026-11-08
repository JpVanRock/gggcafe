import "server-only";
// Coaches Dugout → Training: the team's roadmap, team routines, testing and draft.
import type { createClient } from "@/lib/supabase/server";
import { lineupSeason } from "@/lib/gameday-data";
import type { TrainingCategory } from "@/lib/achievements";
import type { PhaseKind, SquadRow } from "@/lib/training-plan";
import { playerName } from "@/lib/softball";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type RosterPlayer = { id: string; name: string; jersey: string | null };
export type PhaseRow = { id: string; kind: PhaseKind; name: string; starts_on: string; ends_on: string; focus: string | null };
export type TeamRoutineRow = {
  id: string;
  phase_id: string | null;
  title: string;
  details: string | null;
  category: TrainingCategory;
  drill_id: string | null;
  days: number[];
  starts_on: string;
  ends_on: string | null;
  copies: { count: number }[];
};
export type LibraryDrill = { id: string; name: string; category: TrainingCategory; focus: string | null };

/** The team's current roster (latest season, active), by number then name. */
export async function loadTeamRoster(supabase: Supabase, teamId: string): Promise<RosterPlayer[]> {
  const season = await lineupSeason(supabase, teamId, null);
  if (!season) return [];
  const { data } = await supabase
    .from("roster_entries")
    .select("jersey_number, player:players(id, first_name, preferred_name, last_name)")
    .eq("team_id", teamId)
    .eq("season_id", season)
    .eq("active", true);
  return ((data ?? []) as unknown as { jersey_number: string | null; player: { id: string; first_name: string; preferred_name: string | null; last_name: string } | null }[])
    .filter((r) => r.player)
    .map((r) => ({ id: r.player!.id, name: playerName(r.player!), jersey: r.jersey_number }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadTeamAge(supabase: Supabase, teamId: string): Promise<string | null> {
  const { data } = await supabase.from("teams").select("age_group").eq("id", teamId).maybeSingle();
  return ((data as { age_group: string | null } | null)?.age_group ?? null) as string | null;
}

export async function loadRoadmap(supabase: Supabase, teamId: string) {
  const [phases, routines, library, scripts] = await Promise.all([
    supabase.from("training_phases").select("id, kind, name, starts_on, ends_on, focus").eq("team_id", teamId).order("starts_on"),
    supabase
      .from("team_routines")
      .select("id, phase_id, title, details, category, drill_id, days, starts_on, ends_on, copies:player_activities(count)")
      .eq("team_id", teamId)
      .order("starts_on", { ascending: false }),
    supabase.from("drills").select("id, name, category, focus").not("category", "is", null).order("name"),
    supabase.from("bullpen_scripts").select("id, name").eq("team_id", teamId).order("name"),
  ]);
  return {
    phases: (phases.data ?? []) as PhaseRow[],
    routines: (routines.data ?? []) as unknown as TeamRoutineRow[],
    library: (library.data ?? []) as LibraryDrill[],
    scripts: (scripts.data ?? []) as { id: string; name: string }[],
  };
}

export type ResultRow = { player_id: string; metric_key: string; value: number; measured_on: string };

/** Every testing-pack measurement for these players (newest first) and the coaches' band edits. */
export async function loadTesting(supabase: Supabase, playerIds: string[], keys: string[]) {
  const [results, bands] = await Promise.all([
    playerIds.length
      ? supabase
          .from("measurements")
          .select("player_id, metric_key, value, measured_on")
          .in("player_id", playerIds)
          .in("metric_key", keys)
          .order("measured_on", { ascending: false })
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("test_bands").select("metric_key, age_group, cutoffs"),
  ]);
  return {
    results: ((results.data ?? []) as ResultRow[]).map((r) => ({ ...r, value: Number(r.value) })),
    bands: ((bands.data ?? []) as { metric_key: string; age_group: string; cutoffs: number[] }[]).map((b) => ({ ...b, cutoffs: b.cutoffs.map(Number) })),
  };
}

export async function loadSquads(supabase: Supabase, teamId: string): Promise<SquadRow[]> {
  const { data } = await supabase.rpc("team_squads", { p_team_id: teamId });
  return (data ?? []) as SquadRow[];
}
