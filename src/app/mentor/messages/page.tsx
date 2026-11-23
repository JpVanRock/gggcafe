import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getMentor, getMentorAccess, getPlayerFeaturesOff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { APP_TIME_ZONE } from "@/lib/dates";
import { threadSummaries, type Audience } from "@/lib/mentors";
import { isUuid, playerName } from "@/lib/softball";
import { formatCallTime } from "@/lib/video-calls";
import { CountBadge, EmptyState, PageHeader, eyebrowClass } from "@/components/ui";
import { loadMentees, type MenteeCard } from "../parts";
import { MentorConversation, loadConversation } from "../conversation";

export const metadata: Metadata = { title: "Messages · Mentor · GGG.Cafe" };

type Row = {
  id: string;
  player_id: string;
  mentor_id: string;
  audience: Audience;
  author_role: "mentor" | "player" | "parent";
  sender_name: string;
  body: string | null;
  photo_path: string | null;
  drill_name: string | null;
  read_at: string | null;
  created_at: string;
};

// A mentor's messages (user, 2026-11-23): every player she works with, each with two conversations, one with the
// player and one with her parents. `?player=` opens both; `&with=parents` puts the parents' first (their notices
// link there); `&all=1` shows every message.
export default async function MentorMessagesPage({ searchParams }: PageProps<"/mentor/messages">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const mentor = await getMentor();
  if (!mentor) redirect("/mentor");
  const { player: playerParam, with: withParam, all } = await searchParams;
  const access = await getMentorAccess();
  const supabase = await createClient();

  // one player's two conversations
  if (typeof playerParam === "string") {
    if (!isUuid(playerParam) || !access.menteeIds.includes(playerParam)) notFound();
    const [cards, conversation, off] = await Promise.all([
      loadMentees(supabase, [playerParam]),
      loadConversation(supabase, mentor.userId, playerParam, all === "1"),
      getPlayerFeaturesOff(playerParam),
    ]);
    const card = cards.get(playerParam);
    if (!card) notFound();
    const first = card.player.preferred_name || card.player.first_name;
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={playerName(card.player)} description={[card.team, "Messages"].filter(Boolean).join(" · ")} back={{ href: "/mentor/messages", label: "All messages" }}>
          <Link href={`/mentor/players/${playerParam}`} className="text-sm font-semibold text-link hover:underline">
            Her page <span aria-hidden="true">→</span>
          </Link>
        </PageHeader>
        <MentorConversation
          mentorId={mentor.userId}
          player={{ id: playerParam, first }}
          conversation={conversation}
          off={off}
          first={withParam === "parents" ? "parents" : "player"}
          showAllHref={`/mentor/messages?player=${playerParam}${withParam === "parents" ? "&with=parents" : ""}&all=1`}
        />
      </div>
    );
  }

  // every player she works with, the ones with the newest messages first
  const [cards, { data }] = await Promise.all([
    loadMentees(supabase, access.menteeIds),
    supabase
      .from("mentor_messages")
      .select("id, player_id, mentor_id, audience, author_role, sender_name, body, photo_path, drill_name, read_at, created_at")
      .eq("mentor_id", mentor.userId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const threads = threadSummaries((data ?? []) as Row[], (m) => m.author_role === "mentor");
  const threadOf = (playerId: string, audience: Audience) => threads.find((t) => t.last.player_id === playerId && t.last.audience === audience);
  const latest = (id: string) => [threadOf(id, "player"), threadOf(id, "parents")].reduce((a, t) => (t && t.last.created_at > a ? t.last.created_at : a), "");
  const players = [...cards.values()].sort((a, b) => latest(b.player.id).localeCompare(latest(a.player.id)) || a.player.last_name.localeCompare(b.player.last_name));
  const unread = threads.reduce((n, t) => n + t.unread, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Messages"
        description="A conversation with each player, and a separate one with her parents. She answers in hers; they answer in theirs, and get yours by email. She never sees her parents' conversation."
        back={{ href: "/mentor", label: "Mentor menu" }}
      />
      {players.length === 0 ? (
        <EmptyState>Once you&apos;re approved for a player, you can message her and her parents here.</EmptyState>
      ) : (
        <>
          {unread > 0 && (
            <p className="font-sans text-xs font-bold tracking-[0.2em] text-pink-soft uppercase">
              {unread} new {unread === 1 ? "answer" : "answers"}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {players.map((c) => (
              <PlayerRow key={c.player.id} card={c} player={threadOf(c.player.id, "player")} parents={threadOf(c.player.id, "parents")} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type Summary = { last: Row; unread: number } | undefined;

function PlayerRow({ card: { player: p, team, photo, jersey }, player, parents }: { card: MenteeCard; player: Summary; parents: Summary }) {
  const first = p.preferred_name || p.first_name;
  return (
    <li>
      <Link
        href={`/mentor/messages?player=${p.id}`}
        className="grid gap-3 rounded-2xl border border-navy-700 bg-navy-900/70 p-4 transition hover:border-pink sm:grid-cols-[minmax(0,14rem)_1fr_1fr] sm:items-start sm:gap-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
            <img src={photo} alt="" className="size-11 shrink-0 rounded-full border-2 border-neon-edge object-cover" />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-navy-600 font-display text-lg font-bold text-highlight">
              {jersey ?? p.primary_position ?? "–"}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-bold tracking-wide uppercase">{playerName(p)}</span>
            {team && <span className="block truncate text-xs text-muted">{team}</span>}
          </span>
        </span>
        <ThreadLine label={`With ${first}`} summary={player} />
        <ThreadLine label="With her parents" summary={parents} />
      </Link>
    </li>
  );
}

function ThreadLine({ label, summary }: { label: string; summary: Summary }) {
  const last = summary?.last;
  const preview = last ? last.body || (last.drill_name ? `Drill: ${last.drill_name}` : last.photo_path ? "Photo" : "") : "";
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-2">
        <span className={eyebrowClass}>{label}</span>
        <CountBadge count={summary?.unread ?? 0} label={`${summary?.unread ?? 0} new`} />
      </span>
      {last ? (
        <>
          <span className="line-clamp-2 text-sm text-ink/90">
            <span className="font-semibold">{last.author_role === "mentor" ? "You" : last.sender_name}:</span> {preview}
          </span>
          <span className="font-display text-xs text-muted tabular-nums">{formatCallTime(last.created_at, APP_TIME_ZONE)}</span>
        </>
      ) : (
        <span className="text-sm text-muted">Nothing yet</span>
      )}
    </span>
  );
}
