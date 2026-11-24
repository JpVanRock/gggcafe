import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getMentor, getMentorAccess, getPlayerFeaturesOff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { APP_TIME_ZONE } from "@/lib/dates";
import { inboxWhen, messagePreview, teamSends, threadSummaries, type Audience } from "@/lib/mentors";
import { isUuid, playerName } from "@/lib/softball";
import { PillNav } from "@/components/pill-nav";
import { ConversationPane, Inbox, InboxList, InboxPlaceholder, type InboxItem } from "@/components/inbox";
import { Live } from "@/components/live";
import { PageHeader, buttonStyles, eyebrowClass, inputClass, pillQuietClass } from "@/components/ui";
import { formatCallTime } from "@/lib/video-calls";
import Link from "next/link";
import { loadMentees, type MenteeCard } from "../parts";
import { MentorConversation, loadThread } from "../conversation";
import { MessageForm, type LibraryDrill } from "../mentor-client";

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

const BOXES = [
  { key: "all", label: "All" },
  { key: "unread", label: "New" },
  { key: "player", label: "Players" },
  { key: "parents", label: "Parents" },
] as const;
type Box = (typeof BOXES)[number]["key"];

// A mentor's messaging center (user, 2026-11-23: "like a streaming platform or inbox", "an ongoing dialogue like a
// chat"): every conversation on the left, newest first (one with each player, a separate one with her parents), the
// open one on the right, live. `?player=&with=player|parents` opens one (a new one too, from "New message");
// `box=` filters the list; `all=1` shows a whole conversation. `?team=` (user, 2026-11-23: "message the whole team"):
// a whole-team mentor writes once to every player on the team, each in her own conversation.
export default async function MentorMessagesPage({ searchParams }: PageProps<"/mentor/messages">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const mentor = await getMentor();
  if (!mentor) redirect("/mentor");
  const { player: playerParam, with: withParam, box: boxParam, all, team: teamParam } = await searchParams;
  const box: Box = BOXES.some((b) => b.key === boxParam) ? (boxParam as Box) : "all";
  const audience: Audience = withParam === "parents" ? "parents" : "player";
  const selected = typeof playerParam === "string" ? playerParam : null;
  const access = await getMentorAccess();
  if (selected && (!isUuid(selected) || !access.menteeIds.includes(selected))) notFound();
  const teamOpen = !selected && typeof teamParam === "string" ? teamParam : null;
  if (teamOpen && (!isUuid(teamOpen) || !access.teamIds.includes(teamOpen))) notFound();

  const supabase = await createClient();
  const [cards, { data }, open, { data: teamRows }, teamDrills] = await Promise.all([
    loadMentees(supabase, access.menteeIds),
    supabase
      .from("mentor_messages")
      .select("id, player_id, mentor_id, audience, author_role, sender_name, body, photo_path, drill_name, read_at, created_at")
      .eq("mentor_id", mentor.userId)
      .order("created_at", { ascending: false })
      .limit(1000),
    selected
      ? Promise.all([
          loadThread(supabase, mentor.userId, selected, audience, all === "1"),
          audience === "player" ? supabase.from("practice_drills").select("id, name, video_url").order("name") : Promise.resolve({ data: [] }),
          getPlayerFeaturesOff(selected),
        ])
      : null,
    // the teams she mentors as a whole: one message to every player (user, 2026-11-23)
    access.teamIds.length ? supabase.from("teams").select("id, name").in("id", access.teamIds).order("name") : Promise.resolve({ data: [] }),
    teamOpen ? supabase.from("practice_drills").select("id, name, video_url").order("name") : Promise.resolve({ data: [] }),
  ]);
  const wholeTeams = (teamRows ?? []) as { id: string; name: string }[];

  const now = new Date().toISOString();
  const first = (c: MenteeCard) => c.player.preferred_name || c.player.first_name;
  const qs = (params: Record<string, string | null>) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
    return `/mentor/messages${q.size ? `?${q}` : ""}`;
  };
  const boxQ = box === "all" ? null : box;
  const threads = threadSummaries((data ?? []) as Row[], (m) => m.author_role === "mentor").filter((t) => cards.has(t.last.player_id));
  const shown = threads.filter((t) => (box === "unread" ? t.unread > 0 : box === "all" ? true : t.last.audience === box));
  const item = (playerId: string, a: Audience, t?: (typeof threads)[number]): InboxItem => {
    const c = cards.get(playerId)!;
    return {
      key: `${playerId}:${a}`,
      href: qs({ player: playerId, with: a === "parents" ? "parents" : null, box: boxQ }),
      title: a === "parents" ? `${first(c)}'s parents` : playerName(c.player),
      tag: a === "parents" ? `Parents${c.team ? ` · ${c.team}` : ""}` : `Player${c.team ? ` · ${c.team}` : ""}`,
      preview: t ? `${t.last.author_role === "mentor" ? "You: " : ""}${messagePreview(t.last)}` : "",
      when: t ? inboxWhen(t.last.created_at, now, APP_TIME_ZONE) : null,
      unread: t?.unread ?? 0,
      active: selected === playerId && audience === a,
      photo: a === "player" ? c.photo : null,
      initials: a === "parents" ? "P" : (c.jersey ?? `${c.player.first_name[0] ?? ""}${c.player.last_name[0] ?? ""}`),
    };
  };
  const items = shown.map((t) => item(t.last.player_id, t.last.audience, t));
  // a conversation opened from "New message" that has nothing in it yet
  if (selected && !items.some((i) => i.active)) items.unshift(item(selected, audience));
  const unread = threads.reduce((n, t) => n + t.unread, 0);
  const players = [...cards.values()].sort((a, b) => playerName(a.player).localeCompare(playerName(b.player)));

  const newMessage = players.length > 0 && (
    <details className="group">
      <summary className={buttonStyles("pill", "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
        <span aria-hidden="true">+</span> New message
      </summary>
      {/* a plain link-form: it opens that conversation, where you write */}
      <form action="/mentor/messages" method="get" className="mt-3 flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">To</span>
          <select name="player" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Pick a player
            </option>
            {players.map((c) => (
              <option key={c.player.id} value={c.player.id}>
                {playerName(c.player)}
                {c.team ? ` · ${c.team}` : ""}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <legend className="sr-only">Who reads it</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="with" value="player" defaultChecked className="size-4 accent-pink" /> Her
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="with" value="parents" className="size-4 accent-pink" /> Her parents
          </label>
        </fieldset>
        <button type="submit" className={buttonStyles("primary", "self-start")}>
          Open
        </button>
      </form>
    </details>
  );

  const card = selected ? cards.get(selected) : null;
  return (
    <div className="flex flex-col gap-6">
      <Live table="mentor_messages" column="mentor_id" value={mentor.userId} />
      <PageHeader
        title="Messages"
        description="A conversation with each player, and a separate one with her parents. Players answer here (they have no email); parents answer here and get yours by email."
        back={{ href: "/mentor", label: "Mentor menu" }}
      />
      <Inbox
        open={Boolean((selected && card && open) || teamOpen)}
        placeholder={
          <InboxPlaceholder>
            {threads.length === 0 ? "No conversations yet. Start one with New message." : `Pick a conversation.${unread ? ` ${unread} new.` : ""}`}
          </InboxPlaceholder>
        }
        list={
          <InboxList
            label="Conversations"
            items={items}
            empty={box === "all" ? "No conversations yet." : "None here."}
            top={
              <>
                <PillNav label="Show" size="sm" current={box} items={BOXES.map((b) => ({ key: b.key, label: b.label, href: qs({ box: b.key === "all" ? null : b.key }) }))} />
                {newMessage}
                {wholeTeams.map((t) => (
                  <Link
                    key={t.id}
                    href={qs({ team: t.id, box: boxQ })}
                    aria-current={teamOpen === t.id ? "page" : undefined}
                    className={`${pillQuietClass} self-start ${teamOpen === t.id ? "border-pink text-ink" : ""}`}
                  >
                    Message everyone on {t.name}
                  </Link>
                ))}
              </>
            }
          />
        }
      >
        {teamOpen && (
          <TeamMessage
            mentorId={mentor.userId}
            team={wholeTeams.find((t) => t.id === teamOpen) ?? { id: teamOpen, name: "the team" }}
            roster={access.rosters.find((r) => r.teamId === teamOpen)?.players.map((p) => p.id) ?? []}
            messages={(data ?? []) as Row[]}
            drills={(teamDrills.data ?? []) as LibraryDrill[]}
            back={qs({ box: boxQ })}
          />
        )}
        {selected && card && open && (
          <MentorConversation
            mentorId={mentor.userId}
            player={{ id: selected, first: first(card), name: playerName(card.player) }}
            audience={audience}
            thread={open[0]}
            drills={(open[1].data ?? []) as LibraryDrill[]}
            off={open[2]}
            back={qs({ box: boxQ })}
            showAllHref={qs({ player: selected, with: audience === "parents" ? "parents" : null, box: boxQ, all: "1" })}
          />
        )}
      </Inbox>
    </div>
  );
}

/** One message to the whole team: what went out before (with how many have read it), then the form. */
function TeamMessage({
  mentorId,
  team,
  roster,
  messages,
  drills,
  back,
}: {
  mentorId: string;
  team: { id: string; name: string };
  roster: string[];
  messages: Row[];
  drills: LibraryDrill[];
  back: string;
}) {
  const sends = teamSends(
    messages.filter((m) => m.audience === "player" && m.author_role === "mentor"),
    roster,
  ).slice(0, 10);
  return (
    <ConversationPane
      back={{ href: back, label: "All conversations" }}
      title={`Everyone on ${team.name}`}
      tag={`Whole team · ${roster.length} player${roster.length === 1 ? "" : "s"}`}
      note="Each player gets her own copy in her conversation with you and in the banner on her page, and can answer you there. Her parents read it too."
      composer={<MessageForm playerId={team.id} mentorId={mentorId} playerName={`everyone on ${team.name}`} drills={drills} team={team} />}
    >
      {sends.length === 0 ? (
        <p className="text-sm text-muted">No team messages yet. Write one below: every player on the roster gets it.</p>
      ) : (
        <ol aria-label="Team messages you sent" className="flex flex-col gap-3">
          {sends.map((t) => (
            <li key={t.at} className="flex flex-col items-end gap-1">
              <div className="flex max-w-[min(36rem,92%)] flex-col gap-1.5 rounded-2xl border border-pink/50 bg-pink/10 px-4 py-3 text-sm">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">You</span>
                  <span className={eyebrowClass}>To the team</span>
                  <span className="font-display text-xs text-muted tabular-nums">{formatCallTime(t.at, APP_TIME_ZONE)}</span>
                </p>
                {t.first.body && <p className="whitespace-pre-wrap text-ink/90">{t.first.body}</p>}
                {t.first.drill_name && <p className="text-pink-soft">Drill: {t.first.drill_name}</p>}
                {t.first.photo_path && <p className="text-muted">With a photo</p>}
              </div>
              <p className="px-1 font-sans text-2xs tracking-wider text-muted uppercase">
                Sent to {t.players} · seen by {t.seen}
              </p>
            </li>
          ))}
        </ol>
      )}
    </ConversationPane>
  );
}
