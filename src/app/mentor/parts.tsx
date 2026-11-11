// Pieces the mentor pages share: player tiles, the training she has added (grouped, so a
// session for a whole group comes off in one go), and loading her players' names and photos.
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonStyles } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { signedPhotoUrls } from "@/lib/player-photos";
import { playerName, type Player } from "@/lib/softball";
import type { createClient } from "@/lib/supabase/server";
import { removeMentorTraining } from "./actions";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MenteeCard = { player: Player; jersey: string | null; team: string | null; photo: string | null };

/** Her players' profiles, jersey numbers, teams and photos, by last name. */
export async function loadMentees(supabase: Supabase, ids: string[]): Promise<Map<string, MenteeCard>> {
  if (ids.length === 0) return new Map();
  const [{ data: playerRows }, { data: spotRows }] = await Promise.all([
    supabase.from("players").select("*").in("id", ids),
    supabase.from("roster_entries").select("player_id, jersey_number, team:teams(name)").in("player_id", ids).eq("active", true),
  ]);
  const players = ((playerRows ?? []) as Player[]).sort((a, b) => a.last_name.localeCompare(b.last_name));
  const photos = await signedPhotoUrls(supabase, players.map((p) => p.photo_path));
  const spots = (spotRows ?? []) as { player_id: string; jersey_number: string | null; team: { name: string } | null }[];
  return new Map(
    players.map((p) => {
      const spot = spots.find((s) => s.player_id === p.id);
      return [p.id, { player: p, jersey: spot?.jersey_number ?? null, team: spot?.team?.name ?? null, photo: p.photo_path ? (photos.get(p.photo_path) ?? null) : null }];
    }),
  );
}

export function PlayerTiles({ cards }: { cards: MenteeCard[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(({ player: p, jersey, team, photo }) => (
        <li key={p.id}>
          <Link
            href={`/mentor/players/${p.id}`}
            className="flex items-center gap-4 rounded-2xl border border-navy-600 p-4 transition hover:border-pink hover:bg-navy-800"
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
              <img src={photo} alt="" className="size-14 shrink-0 rounded-full border-2 border-neon object-cover" />
            ) : (
              <span className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-navy-600 font-display text-xl font-bold text-highlight">
                {jersey ?? p.primary_position ?? "–"}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-display text-xl font-bold tracking-wide uppercase">{playerName(p)}</span>
              <span className="block truncate font-mono text-xs text-muted">{[jersey && `#${jersey}`, p.primary_position, team].filter(Boolean).join(" · ")}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type TrainingRow = { id: string; player_id: string; title: string; details: string | null; days: number[]; starts_on: string; ends_on: string | null };

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Training she added from today on, one line per session (all the players it went to). */
export function TrainingList({ rows, nameOf }: { rows: TrainingRow[]; nameOf: (id: string) => string }) {
  const groups = new Map<string, TrainingRow[]>();
  for (const r of rows) {
    const key = [r.title, r.details, r.starts_on, r.ends_on, r.days.join(",")].join("|");
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  if (groups.size === 0) return <p className="text-sm text-muted">Nothing coming up.</p>;
  return (
    <ul className="divide-y divide-navy-700 rounded-xl border border-navy-700">
      {[...groups.values()].map((g) => {
        const r = g[0];
        const weekly = r.ends_on && r.ends_on !== r.starts_on;
        const when = weekly
          ? `${r.days.map((d) => DAY_NAMES[d]).join(", ")} · ${formatDay(r.starts_on)} to ${formatDay(r.ends_on!)}`
          : formatDay(r.starts_on);
        const who = g.length === 1 ? nameOf(r.player_id) : `${g.length} players: ${g.map((x) => nameOf(x.player_id)).join(", ")}`;
        return (
          <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3 text-sm">
            <span className="w-full font-display text-muted tabular-nums sm:w-56 sm:shrink-0">{when}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{r.title}</span>
              <span className="block text-xs text-muted">{who}</span>
              {r.details && <span className="block text-xs text-muted">{r.details}</span>}
            </span>
            <ActionForm action={removeMentorTraining} className="flex flex-wrap items-center gap-2">
              {g.map((x) => (
                <input key={x.id} type="hidden" name="activity_id" value={x.id} />
              ))}
              <ConfirmSubmit
                message={g.length === 1 ? `Remove "${r.title}" from ${nameOf(r.player_id)}'s week?` : `Remove "${r.title}" for all ${g.length} players?`}
                confirmLabel="Remove"
                tone="danger"
                className={buttonStyles("link", "text-muted")}
              >
                Remove
              </ConfirmSubmit>
            </ActionForm>
          </li>
        );
      })}
    </ul>
  );
}

/** The training she added that hasn't ended yet. */
export async function loadTraining(supabase: Supabase, mentorId: string, playerIds?: string[]): Promise<TrainingRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase
    .from("player_activities")
    .select("id, player_id, title, details, days, starts_on, ends_on")
    .eq("source", "mentor")
    .eq("created_by", mentorId)
    .gte("ends_on", today)
    .order("starts_on");
  if (playerIds) q = q.in("player_id", playerIds);
  const { data } = await q;
  return (data ?? []) as TrainingRow[];
}
