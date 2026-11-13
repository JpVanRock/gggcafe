import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid, playerName, type Player } from "@/lib/softball";
import { seasonOrCurrent } from "@/lib/roster";
import { signedPhotoUrls } from "@/lib/player-photos";
import { Card } from "@/components/ui";
import { loadDugoutTeam } from "../../../data";
import { NoOwnTeam } from "../../../team-picker";
import { PlayerForm } from "../../../../players/player-form";
import { RosterEntryEditor } from "../../../../teams/forms";

export const metadata: Metadata = { title: "Edit player · Roster · Coaches Dugout · GGG.Cafe" };

// Edit a player from the Roster tab (user, 2026-11-13): coaches and admins change her name and
// profile (the same form as "Edit profile" on her Pop Report), plus her jersey number and whether
// she's active on this team's roster for the season.
export default async function EditRosterPlayerPage({ params, searchParams }: PageProps<"/dugout/roster/players/[playerId]">) {
  const user = await requireStaffPage();
  if (!canEdit(user.staff.role)) notFound();
  const [{ playerId }, { team: teamParam, season: seasonParam }] = await Promise.all([params, searchParams]);
  if (!isUuid(playerId)) notFound();
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { team } = dugout;
  const seasonId = await seasonOrCurrent(supabase, team.id, isUuid(seasonParam) ? seasonParam : null);

  const [{ data }, { data: entry }] = await Promise.all([
    supabase.from("players").select("*").eq("id", playerId).maybeSingle(),
    seasonId
      ? supabase.from("roster_entries").select("id, jersey_number, active").eq("team_id", team.id).eq("season_id", seasonId).eq("player_id", playerId).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const player = data as Player | null;
  if (!player) notFound();
  const photoUrl = player.photo_path ? ((await signedPhotoUrls(supabase, [player.photo_path])).get(player.photo_path) ?? null) : null;
  const back = `/dugout/roster?team=${team.id}${seasonId ? `&season=${seasonId}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={back} className="text-sm text-link hover:underline">
          ← Roster
        </Link>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-highlight uppercase">{playerName(player)}</h2>
        <p className="mt-1 text-sm text-muted">
          Edit her name and profile. Changes show everywhere she appears.{" "}
          <Link href={`/players/${player.id}`} className="text-link underline-offset-2 hover:underline">
            Open her dashboard
          </Link>
        </p>
      </div>

      {entry && (
        <Card title={`${team.name} roster`}>
          <RosterEntryEditor id={entry.id} jersey={entry.jersey_number} active={entry.active} />
          <p className="mt-2 text-xs text-muted">Jersey number, and whether she&apos;s on the active roster this season.</p>
        </Card>
      )}

      <Card title="Profile">
        <PlayerForm player={player} photoUrl={photoUrl} />
      </Card>
    </div>
  );
}
