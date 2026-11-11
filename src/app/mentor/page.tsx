import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getMentor, getMentorAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Badge, Card, Disclosure, EmptyState, PageHeader, buttonStyles } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { playerName } from "@/lib/softball";
import { RequestForm, TrainingForm, type TrainingGroup } from "./mentor-client";
import { withdrawMentorLink } from "./actions";
import { PlayerTiles, TrainingList, loadMentees, loadTraining } from "./parts";

export const metadata: Metadata = { title: "My players · Mentor · GGG.Cafe" };

type MyLink = { id: string; team_id: string | null; team_name: string | null; player_id: string | null; player_name: string | null; status: "pending" | "approved" | "declined"; requested_at: string };

const heading = "mb-3 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

export default async function MentorHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const [mentor, access, { data: linkRows }, { data: claims }] = await Promise.all([
    getMentor(),
    getMentorAccess(),
    supabase.rpc("my_mentor_links"),
    supabase.auth.getClaims(),
  ]);
  const links = (linkRows ?? []) as MyLink[];
  // what she typed on the sign-up page fills in the request form
  const meta = (claims?.claims?.user_metadata ?? {}) as { display_name?: string; team_code?: string; mentor_player?: string };
  const defaults = { code: meta.team_code, scope: meta.team_code && !meta.mentor_player ? ("team" as const) : ("player" as const), player: meta.mentor_player };

  if (!mentor && links.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={meta.display_name ? `Welcome, ${meta.display_name.split(" ")[0]}` : "Welcome, mentor"} description="GGG.Cafe mentor" />
        {user.staff ? (
          <p className="max-w-2xl rounded-2xl border border-pink/50 bg-pink/5 p-5">
            This is the mentor area. Mentors ask with a team code here; a player&apos;s parents approve a mentor for her, and a head coach approves one for the
            whole team (Coaches Dugout → Mentors).
          </p>
        ) : (
          <Card title="Ask to work with a player or a team">
            <p className="mb-4 max-w-2xl text-sm text-muted">
              Enter the team code. For one player, her parents approve you; for the whole team, the head coach does. You see the players you&apos;re approved for once
              they say yes.
            </p>
            <RequestForm defaults={defaults} />
          </Card>
        )}
      </div>
    );
  }

  const [cards, training, { data: teamRows }, { data: sent }] = await Promise.all([
    loadMentees(supabase, access.menteeIds),
    mentor ? loadTraining(supabase, mentor.userId) : Promise.resolve([]),
    access.teamIds.length ? supabase.from("teams").select("id, name").in("id", access.teamIds).order("name") : Promise.resolve({ data: [] }),
    mentor
      ? supabase
          .from("mentor_messages")
          .select("id, player_id, body, photo_path, drill_name, created_at, read_at, shared_with_coaches")
          .eq("sender_id", mentor.userId)
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
  ]);
  const teams = (teamRows ?? []) as { id: string; name: string }[];
  const nameOf = (id: string) => {
    const c = cards.get(id);
    return c ? playerName(c.player) : "A player";
  };
  const label = (id: string) => {
    const c = cards.get(id);
    return c ? [c.jersey && `#${c.jersey}`, playerName(c.player)].filter(Boolean).join(" ") : "A player";
  };
  // players her parents approved, unless she's already on a team the mentor works with
  const onTeams = new Set(access.rosters.flatMap((r) => r.players.map((p) => p.id)));
  const individual = access.playerIds.filter((id) => cards.has(id) && !onTeams.has(id));
  const groups: TrainingGroup[] = [
    ...access.rosters.map((r) => ({ name: teams.find((t) => t.id === r.teamId)?.name ?? "Team", players: r.players.map((p) => ({ id: p.id, label: label(p.id) })) })),
    ...(individual.length ? [{ name: access.teamIds.length ? "My players" : "Your players", players: individual.map((id) => ({ id, label: label(id) })) }] : []),
  ];
  const waiting = links.filter((l) => l.status !== "approved");
  const total = access.menteeIds.length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Welcome, ${(mentor?.displayName ?? meta.display_name ?? "mentor").split(" ")[0]}`}
        description={`${mentor?.specialty ?? "Mentor"} · ${total} player${total === 1 ? "" : "s"}`}
      />

      {waiting.length > 0 && (
        <section aria-label="Your requests" className="rounded-2xl border border-pink/50 bg-pink/5 p-4 sm:p-5">
          <h2 className={heading}>Your requests</h2>
          <ul className="flex flex-col gap-2">
            {waiting.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold">{l.player_id ? l.player_name : `${l.team_name}: the whole team`}</span>
                {l.player_id && l.team_name && <span className="text-muted">{l.team_name}</span>}
                <Badge tone={l.status === "pending" ? "pink" : "neutral"}>
                  {l.status === "pending" ? (l.player_id ? "Waiting for her parents" : "Waiting for the head coach") : "Not approved"}
                </Badge>
                <span className="font-mono text-2xs tracking-wider text-muted uppercase">Asked {formatDay(l.requested_at.slice(0, 10))}</span>
                <ActionForm action={withdrawMentorLink} className="ml-auto flex items-center gap-2">
                  <input type="hidden" name="link_id" value={l.id} />
                  <ConfirmSubmit message="Withdraw this request?" confirmLabel="Withdraw" className={buttonStyles("link", "text-muted")}>
                    {l.status === "pending" ? "Withdraw" : "Clear"}
                  </ConfirmSubmit>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      {total === 0 && waiting.length > 0 && <EmptyState>Once you&apos;re approved, your players show up here.</EmptyState>}

      {teams.map((t) => {
        const roster = access.rosters.find((r) => r.teamId === t.id)?.players ?? [];
        return (
          <section key={t.id} aria-label={t.name}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-2xl leading-tight font-bold tracking-wide text-highlight uppercase">
                {t.name} <span className="font-mono text-xs tracking-wider text-muted normal-case">· whole team · {roster.length} players</span>
              </h2>
              <Link href={`/mentor/teams/${t.id}`} className={buttonStyles("link")}>
                Team focus &amp; notes →
              </Link>
            </div>
            {roster.length === 0 ? (
              <p className="text-sm text-muted">No one on the roster yet.</p>
            ) : (
              <PlayerTiles cards={roster.flatMap((p) => (cards.has(p.id) ? [cards.get(p.id)!] : []))} />
            )}
          </section>
        );
      })}

      {individual.length > 0 && (
        <section aria-label="Your players">
          <h2 className="mb-3 text-2xl leading-tight font-bold tracking-wide text-highlight uppercase">{teams.length ? "My players" : "Your players"}</h2>
          <PlayerTiles cards={individual.map((id) => cards.get(id)!)} />
        </section>
      )}

      {total > 0 && (
        <Card title="Training on their weeks">
          <p className="mb-4 text-sm text-muted">Tick one player or a group. It shows in their This Week in Softball on those days, marked as from you.</p>
          <Disclosure summary="+ Add training">
            <TrainingForm groups={groups} />
          </Disclosure>
          <div className="mt-4">
            <TrainingList rows={training} nameOf={nameOf} />
          </div>
        </Card>
      )}

      {(sent ?? []).length > 0 && (
        <section>
          <h2 className={heading}>What you sent lately</h2>
          <ul className="divide-y divide-navy-700 rounded-xl border border-navy-700">
            {((sent ?? []) as { id: string; player_id: string; body: string | null; photo_path: string | null; drill_name: string | null; created_at: string; read_at: string | null; shared_with_coaches: boolean }[]).map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-semibold">{nameOf(m.player_id)}</span>
                <span className="min-w-0 flex-1 truncate text-muted">
                  {[m.body, m.drill_name && `Drill: ${m.drill_name}`, m.photo_path && "Photo"].filter(Boolean).join(" · ")}
                </span>
                {m.shared_with_coaches && <Badge tone="pink">Shared with coaches</Badge>}
                <span className="font-mono text-2xs tracking-wider text-muted uppercase">{m.read_at ? "Seen" : "Not seen yet"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Disclosure summary="Ask to work with another player or team">
        <RequestForm />
      </Disclosure>
    </div>
  );
}
