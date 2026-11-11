import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHeadCoachPage } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { loadRoster } from "@/lib/roster";
import { isUuid } from "@/lib/softball";
import { Badge } from "@/components/ui";
import { FocusBoard, NoteForm, NotesThread, RemoveNote, type FocusItem, type MentorNote } from "@/components/mentor-work";
import { loadDugoutTeam } from "../../data";
import { NoOwnTeam } from "../../team-picker";
import { addCoachNote, removeCoachNote } from "../actions";

export const metadata: Metadata = { title: "Mentor notes · Coaches Dugout · GGG.Cafe" };

type Scoped<T> = T & { player_id: string | null; team_id: string | null };

/** The team or one player: her focus areas and the notes thread, with a reply box. */
function Scope({
  title,
  subtitle,
  hidden,
  items,
  thread,
  first,
  mentorId,
  userId,
}: {
  title: string;
  subtitle?: string;
  hidden: Record<string, string>;
  items: FocusItem[];
  thread: MentorNote[];
  first: string;
  mentorId: string;
  userId: string;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-navy-700 bg-navy-900/70 p-5 sm:p-6" aria-label={title}>
      <div>
        <h3 className="text-2xl leading-tight font-bold tracking-wide text-highlight uppercase">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <FocusBoard items={items} empty={`${first} hasn't added focus areas yet.`} />
      <h4 className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Notes</h4>
      <NotesThread
        notes={thread}
        controls={(n) => (n.author_id === userId ? <RemoveNote id={n.id} action={removeCoachNote} /> : null)}
        empty={`No notes yet. ${first} adds discussion summaries here; you can reply.`}
      />
      <NoteForm action={addCoachNote} hidden={{ mentor_id: mentorId, ...hidden }} kinds={["note"]} placeholder="Thanks. We'll work on it at practice this week too." />
    </section>
  );
}

/** One mentor's work with this team: the whole team and each player, focus areas and notes, with a reply box. */
export default async function MentorNotesPage({ params, searchParams }: PageProps<"/dugout/mentors/[mentorId]">) {
  const user = await requireHeadCoachPage();
  const { mentorId } = await params;
  const { team: teamParam } = await searchParams;
  if (!isUuid(mentorId)) notFound();
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { team } = dugout;
  const roster = await loadRoster(supabase, team.id, { order: "name" });
  const ids = roster.map((p) => p.id);
  const [{ data: mentor }, { data: linkRows }, { data: focusRows }, { data: noteRows }, { data: msgRows }] = await Promise.all([
    supabase.from("mentors").select("user_id, display_name, specialty").eq("user_id", mentorId).maybeSingle(),
    supabase.from("mentor_links").select("team_id, player_id").eq("mentor_id", mentorId).eq("status", "approved"),
    supabase.from("mentor_focus").select("id, title, details, status, updated_at, player_id, team_id").eq("mentor_id", mentorId).order("created_at"),
    supabase
      .from("mentor_notes")
      .select("id, kind, discussed_on, body, author_id, author_name, author_role, created_at, player_id, team_id")
      .eq("mentor_id", mentorId)
      .order("created_at"),
    // RLS: the messages she shared with the coaches (every one for admins)
    ids.length
      ? supabase
          .from("mentor_messages")
          .select("id, player_id, body, drill_name, photo_path, created_at, shared_with_coaches")
          .eq("sender_id", mentorId)
          .in("player_id", ids)
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
  ]);
  if (!mentor) notFound();
  const links = linkRows ?? [];
  const wholeTeam = links.some((l) => !l.player_id && l.team_id === team.id);
  const focus = (focusRows ?? []) as Scoped<FocusItem>[];
  const notes = (noteRows ?? []) as Scoped<MentorNote>[];
  const messages = msgRows ?? [];
  // players on this roster she works with or has written about
  const playerIds = ids.filter(
    (id) => links.some((l) => l.player_id === id) || focus.some((f) => f.player_id === id) || notes.some((n) => n.player_id === id),
  );
  const first = mentor.display_name.split(" ")[0];
  const scope = { first, mentorId, userId: user.id };

  return (
    <div className="flex flex-col gap-8">
      <Link href={`/dugout/mentors?team=${team.id}`} className="self-start text-sm text-muted hover:text-ink">
        ← Mentors
      </Link>
      <header>
        <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">{team.name}</p>
        <h2 className="mt-1 text-4xl leading-none font-bold tracking-tight text-highlight uppercase">{mentor.display_name}</h2>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          {mentor.specialty ?? "Mentor"}
          {wholeTeam && <Badge tone="neon">Whole team</Badge>}
        </p>
      </header>

      {(wholeTeam || focus.some((f) => f.team_id === team.id) || notes.some((n) => n.team_id === team.id)) && (
        <Scope
          {...scope}
          title="The whole team"
          hidden={{ team_id: team.id }}
          items={focus.filter((f) => f.team_id === team.id)}
          thread={notes.filter((n) => n.team_id === team.id)}
        />
      )}

      {playerIds.length === 0 && !wholeTeam && <p className="text-sm text-muted">{first} doesn&apos;t work with anyone on this team right now.</p>}
      {playerIds.map((id) => {
        const p = roster.find((x) => x.id === id)!;
        return (
          <Scope
            {...scope}
            key={id}
            title={p.name}
            subtitle={[p.number && `#${p.number}`, p.positions.join(", ")].filter(Boolean).join(" · ")}
            hidden={{ player_id: id }}
            items={focus.filter((f) => f.player_id === id)}
            thread={notes.filter((n) => n.player_id === id)}
          />
        );
      })}
      {wholeTeam && playerIds.length < roster.length && (
        <p className="text-xs text-muted">Players {first} hasn&apos;t written about yet don&apos;t show here.</p>
      )}

      <section>
        <h3 className="mb-3 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">
          {user.staff.role === "admin" ? `${first}'s messages to players` : `Messages ${first} shared with you`}
        </h3>
        {messages.length === 0 ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          <ul className="divide-y divide-navy-700 rounded-xl border border-navy-700">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="w-24 shrink-0 font-display text-muted tabular-nums">{formatDay(m.created_at.slice(0, 10))}</span>
                <span className="font-semibold">{roster.find((p) => p.id === m.player_id)?.name ?? "A player"}</span>
                <span className="min-w-0 flex-1 truncate text-muted">
                  {[m.body, m.drill_name && `Drill: ${m.drill_name}`, m.photo_path && "Photo"].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
