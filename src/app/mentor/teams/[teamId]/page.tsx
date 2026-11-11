import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getMentor, getMentorAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid, playerName } from "@/lib/softball";
import { Disclosure } from "@/components/ui";
import { FocusBoard, FocusControls, FocusForm, NoteForm, NotesThread, RemoveNote, type FocusItem, type MentorNote } from "@/components/mentor-work";
import { addMentorFocus, addMentorNote, removeMentorFocus, removeMentorNote, setMentorFocus } from "../../actions";
import { TrainingForm } from "../../mentor-client";
import { PlayerTiles, TrainingList, loadMentees, loadTraining } from "../../parts";

export const metadata: Metadata = { title: "Team · Mentor · GGG.Cafe" };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-navy-700 bg-navy-900/70 p-5 sm:p-6">
      <h2 className="text-2xl leading-tight font-bold tracking-wide text-highlight uppercase">{title}</h2>
      {children}
    </section>
  );
}

/** A team the head coach approved her for: its roster, team focus areas and notes with the coaches, team training. */
export default async function MentorTeamPage({ params }: PageProps<"/mentor/teams/[teamId]">) {
  const { teamId } = await params;
  if (!isUuid(teamId)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const mentor = await getMentor();
  if (!mentor) redirect("/mentor");
  const access = await getMentorAccess();
  // whole-team approvals only
  if (!access.teamIds.includes(teamId)) notFound();
  const roster = access.rosters.find((r) => r.teamId === teamId)?.players ?? [];
  const ids = roster.map((p) => p.id);

  const supabase = await createClient();
  const [{ data: team }, cards, training, { data: focusRows }, { data: noteRows }] = await Promise.all([
    supabase.from("teams").select("id, name").eq("id", teamId).maybeSingle(),
    loadMentees(supabase, ids),
    loadTraining(supabase, mentor.userId, ids),
    supabase.from("mentor_focus").select("id, title, details, status, updated_at").eq("team_id", teamId).eq("mentor_id", mentor.userId).order("created_at"),
    supabase
      .from("mentor_notes")
      .select("id, kind, discussed_on, body, author_id, author_name, author_role, created_at")
      .eq("team_id", teamId)
      .eq("mentor_id", mentor.userId)
      .order("created_at"),
  ]);
  if (!team) notFound();
  const nameOf = (id: string) => {
    const c = cards.get(id);
    return c ? playerName(c.player) : "A player";
  };
  const label = (id: string) => {
    const c = cards.get(id);
    return c ? [c.jersey && `#${c.jersey}`, playerName(c.player)].filter(Boolean).join(" ") : "A player";
  };

  return (
    <div className="flex flex-col gap-8">
      <Link href="/mentor" className="self-start text-sm text-muted hover:text-ink">
        ← My players
      </Link>
      <header>
        <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">Whole team · {roster.length} players</p>
        <h1 className="mt-1 text-4xl leading-none font-bold tracking-tight text-highlight uppercase sm:text-5xl">{team.name}</h1>
      </header>

      {roster.length > 0 && <PlayerTiles cards={roster.flatMap((p) => (cards.has(p.id) ? [cards.get(p.id)!] : []))} />}

      <Panel title="Working with the coaches">
        <p className="-mt-2 text-sm text-muted">
          Team-wide: what you&apos;re working on with the whole team, what&apos;s working, and what you talked about with the coaches. The coaches read this; players
          don&apos;t. Notes about one player go on her page.
        </p>
        <FocusBoard
          items={(focusRows ?? []) as FocusItem[]}
          empty="No team focus areas yet."
          controls={(item) => <FocusControls item={item} move={setMentorFocus} remove={removeMentorFocus} />}
        />
        <FocusForm action={addMentorFocus} hidden={{ team_id: teamId }} />
        <h3 className="mt-2 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Notes with the coaches</h3>
        <NotesThread
          notes={(noteRows ?? []) as MentorNote[]}
          empty="No notes yet. After you talk with the coaches, add a discussion summary."
          controls={(n) => (n.author_id === mentor.userId ? <RemoveNote id={n.id} action={removeMentorNote} /> : null)}
        />
        <NoteForm action={addMentorNote} hidden={{ team_id: teamId }} placeholder="Met with the head coach: two-strike approach is the team focus through December." />
      </Panel>

      <Panel title="Team training">
        <p className="-mt-2 text-sm text-muted">Shows in each player&apos;s This Week in Softball, marked as from you. Untick anyone it isn&apos;t for.</p>
        <Disclosure summary="+ Add training">
          <TrainingForm groups={[{ name: team.name, players: roster.map((p) => ({ id: p.id, label: label(p.id) })) }]} preset={ids} />
        </Disclosure>
        <TrainingList rows={training} nameOf={nameOf} />
      </Panel>
    </div>
  );
}
