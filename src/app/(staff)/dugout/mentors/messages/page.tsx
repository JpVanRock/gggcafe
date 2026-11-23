import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHeadCoachPage } from "@/lib/auth";
import { APP_TIME_ZONE } from "@/lib/dates";
import { MESSAGE_COLUMNS, signedMessagePhotoUrls, type MentorMessage } from "@/lib/message-photos";
import { inboxWhen, messagePreview, threadSummaries, type Audience } from "@/lib/mentors";
import { loadRoster } from "@/lib/roster";
import { isUuid } from "@/lib/softball";
import { createClient } from "@/lib/supabase/server";
import { formatCallTime } from "@/lib/video-calls";
import { ActionForm } from "@/components/action-form";
import { ChatScroll } from "@/components/chat-scroll";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ConversationPane, Inbox, InboxList, InboxPlaceholder } from "@/components/inbox";
import { Live } from "@/components/live";
import { MessageThread } from "@/components/message-thread";
import { PillNav } from "@/components/pill-nav";
import { RECENT_LIMIT, buttonStyles } from "@/components/ui";
import { loadDugoutTeam } from "../../data";
import { NoOwnTeam, TeamPicker } from "../../team-picker";
import { removeMentorMessage } from "../actions";

export const metadata: Metadata = { title: "Message center · Coaches Dugout · GGG.Cafe" };

type Trail = { message_id: string; notified: { name: string; read_at: string | null }[]; email: string; email_note: string | null; email_at: string | null };

const BOXES = [
  { key: "all", label: "All" },
  { key: "player", label: "With players" },
  { key: "parents", label: "With parents" },
] as const;

// The admins' message center (user, 2026-11-23: "allow the admin role to actually see what happens when a message is
// sent", "like a streaming platform or inbox"): every mentor conversation about a team's players, read only, as an
// inbox. Under each message, what happened: who was notified (and opened it), the email for the parents'
// conversation (sent, skipped and why, failing, waiting) and when it was read (admin_message_trail).
// `?thread=<mentor>.<player>.<player|parents>` opens one.
export default async function MessageCenterPage({ searchParams }: PageProps<"/dugout/mentors/messages">) {
  const user = await requireHeadCoachPage();
  if (user.staff.role !== "admin") notFound();
  const { team: teamParam, thread: threadParam, box: boxParam, all } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const box = BOXES.some((b) => b.key === boxParam) ? (boxParam as (typeof BOXES)[number]["key"]) : "all";

  const roster = await loadRoster(supabase, team.id);
  const ids = roster.map((p) => p.id);
  const [{ data: rows }, { data: mentorRows }] = await Promise.all([
    ids.length
      ? supabase
          .from("mentor_messages")
          .select("id, player_id, mentor_id, audience, author_role, sender_name, body, photo_path, drill_name, read_at, created_at")
          .in("player_id", ids)
          .order("created_at", { ascending: false })
          .limit(1000)
      : Promise.resolve({ data: [] }),
    supabase.from("mentors").select("user_id, display_name"),
  ]);
  const messages = (rows ?? []) as Pick<MentorMessage, "id" | "player_id" | "mentor_id" | "audience" | "author_role" | "sender_name" | "body" | "photo_path" | "drill_name" | "read_at" | "created_at">[];
  const mentorName = (id: string) =>
    (mentorRows ?? []).find((m) => m.user_id === id)?.display_name ?? messages.find((m) => m.mentor_id === id && m.author_role === "mentor")?.sender_name ?? "Mentor";
  const playerOf = (id: string) => roster.find((p) => p.id === id);
  // "Avery Lopez" is the preferred first name and last name
  const firstOf = (id: string) => playerOf(id)?.name.split(" ")[0] ?? "Player";
  const nameOf = (id: string) => playerOf(id)?.name ?? "A player";
  const threads = threadSummaries(messages, () => true).filter((t) => box === "all" || t.last.audience === box);

  // the open conversation
  const [mentorId, playerId, audienceParam] = typeof threadParam === "string" ? threadParam.split(".") : [];
  const audience: Audience | null = audienceParam === "player" || audienceParam === "parents" ? audienceParam : null;
  const open = isUuid(mentorId ?? "") && isUuid(playerId ?? "") && ids.includes(playerId!) && audience ? { mentorId: mentorId!, playerId: playerId!, audience } : null;
  const loaded = open
    ? await supabase
        .from("mentor_messages")
        .select(MESSAGE_COLUMNS, { count: "exact" })
        .eq("mentor_id", open.mentorId)
        .eq("player_id", open.playerId)
        .eq("audience", open.audience)
        .order("created_at", { ascending: false })
        .limit(all === "1" ? 500 : RECENT_LIMIT)
    : null;
  const thread = ((loaded?.data ?? []) as MentorMessage[]).slice().reverse();
  const [photos, { data: trailRows }] = await Promise.all([
    signedMessagePhotoUrls(supabase, thread.map((m) => m.photo_path)),
    thread.length ? supabase.rpc("admin_message_trail", { p_message_ids: thread.map((m) => m.id) }) : Promise.resolve({ data: [] }),
  ]);
  const trail = new Map(((trailRows ?? []) as unknown as Trail[]).map((t) => [t.message_id, t]));

  const base = (params: Record<string, string | null>) => {
    const q = new URLSearchParams(Object.entries({ team: team.id, ...params }).filter((e): e is [string, string] => Boolean(e[1])));
    return `/dugout/mentors/messages?${q}`;
  };
  const boxQ = box === "all" ? null : box;
  const now = new Date().toISOString();
  const title = (t: { mentor_id: string; player_id: string; audience: Audience }) =>
    `${mentorName(t.mentor_id)} · ${t.audience === "parents" ? `${firstOf(t.player_id)}'s parents` : nameOf(t.player_id)}`;

  return (
    <div className="flex flex-col gap-6">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/mentors/messages" />
      <div>
        <Link href={`/dugout/mentors?team=${team.id}`} className="text-sm text-muted hover:text-ink">
          <span aria-hidden="true">←</span> Mentors
        </Link>
        <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">Message center</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Every conversation between {team.name}&apos;s players, their parents and their mentors, as they happen. Read only. Under each message: who was
          notified, the email (only the parents&apos; conversations are emailed: players have no email), and when it was read. Admins only.
        </p>
      </div>
      {open && <Live table="mentor_messages" column="player_id" value={open.playerId} />}
      <Inbox
        open={Boolean(open)}
        placeholder={<InboxPlaceholder>{threads.length ? "Pick a conversation to see its messages and what happened to each." : "No mentor messages on this team yet."}</InboxPlaceholder>}
        list={
          <InboxList
            label="Conversations"
            empty={box === "all" ? "No mentor messages on this team yet." : "None here."}
            top={<PillNav label="Show" size="sm" current={box} items={BOXES.map((b) => ({ key: b.key, label: b.label, href: base({ box: b.key === "all" ? null : b.key }) }))} />}
            items={threads.map((t) => ({
              key: t.key,
              href: base({ box: boxQ, thread: `${t.last.mentor_id}.${t.last.player_id}.${t.last.audience}` }),
              title: title(t.last),
              tag: t.last.audience === "parents" ? "Mentor and parents" : "Mentor and player",
              preview: `${t.last.sender_name}: ${messagePreview(t.last)}`,
              when: inboxWhen(t.last.created_at, now, APP_TIME_ZONE),
              unread: 0,
              active: open?.mentorId === t.last.mentor_id && open.playerId === t.last.player_id && open.audience === t.last.audience,
              initials: t.last.audience === "parents" ? "P" : (playerOf(t.last.player_id)?.number ?? "–"),
            }))}
          />
        }
      >
        {open && (
          <ConversationPane
            back={{ href: base({ box: boxQ }), label: "All conversations" }}
            title={title({ mentor_id: open.mentorId, player_id: open.playerId, audience: open.audience })}
            tag={open.audience === "parents" ? "Mentor and parents · emailed both ways" : "Mentor and player · in the site only"}
            note={
              open.audience === "parents"
                ? `${firstOf(open.playerId)} doesn't see this conversation.`
                : `${firstOf(open.playerId)}'s parents read this conversation; coaches read only what the mentor shares.`
            }
          >
            {(loaded?.count ?? 0) > thread.length && (
              <p className="mb-2 text-xs text-muted">
                Showing the latest {thread.length} of {loaded?.count}.{" "}
                <Link href={base({ box: boxQ, thread: `${open.mentorId}.${open.playerId}.${open.audience}`, all: "1" })} className="font-semibold text-link hover:underline">
                  Show all
                </Link>
              </p>
            )}
            <ChatScroll count={thread.length} label={`Messages: ${title({ mentor_id: open.mentorId, player_id: open.playerId, audience: open.audience })}`} className="max-h-[65vh] p-1">
              <MessageThread
                messages={thread}
                viewer="staff"
                me={user.id}
                photoUrls={photos}
                label="The conversation"
                empty="No messages."
                controls={(m) => (
                  <>
                    <WhatHappened m={m} t={trail.get(m.id)} player={firstOf(m.player_id)} mentor={mentorName(m.mentor_id)} right={m.sender_id === user.id} />
                    <ActionForm action={removeMentorMessage} className="flex items-center">
                      <input type="hidden" name="message_id" value={m.id} />
                      <ConfirmSubmit
                        message="Remove this message? Nobody will see it any more."
                        confirmLabel="Remove"
                        tone="danger"
                        label={`Remove the message from ${m.sender_name}`}
                        className={buttonStyles("removeQuiet")}
                      >
                        Remove
                      </ConfirmSubmit>
                    </ActionForm>
                  </>
                )}
              />
            </ChatScroll>
          </ConversationPane>
        )}
      </Inbox>
    </div>
  );
}

const when = (iso: string) => formatCallTime(iso, APP_TIME_ZONE);

/** What happened to one message: notices, the email, read. */
function WhatHappened({ m, t, player, mentor, right }: { m: MentorMessage; t: Trail | undefined; player: string; mentor: string; right: boolean }) {
  const toWhom = m.author_role !== "mentor" ? mentor : m.audience === "parents" ? `${player}'s parents` : player;
  const notified = t?.notified ?? [];
  const email: Record<string, string> = {
    none: "",
    not_sent: "No email: no approved parent to send it to",
    waiting: "Email waiting to send",
    retrying: `Email failed, trying again${t?.email_note ? ` (${t.email_note})` : ""}`,
    done: `Emailed${t?.email_at ? ` ${when(t.email_at)}` : ""}`,
    skipped: `Email not sent: ${t?.email_note ?? "skipped"}`,
    dead: `Email failed${t?.email_note ? `: ${t.email_note}` : ""}`,
  };
  const lines = [
    notified.length
      ? `Notified ${notified.map((n) => `${n.name}${n.read_at ? " (opened)" : ""}`).join(", ")}`
      : m.author_role === "mentor" && m.audience === "player"
        ? "Alert on her menu (no login to notify)"
        : "Nobody to notify",
    t ? email[t.email] : "",
    m.read_at ? `Read by ${toWhom} ${when(m.read_at)}` : `Not read by ${toWhom} yet`,
  ].filter(Boolean);
  return (
    // under the message, on its side
    <span className={`flex basis-full flex-col gap-0.5 text-xs text-muted ${right ? "items-end text-right" : "items-start"}`}>
      {lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </span>
  );
}
