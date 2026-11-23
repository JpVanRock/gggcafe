import type { Metadata } from "next";
import { getPlayerFeaturesOff, requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { APP_TIME_ZONE } from "@/lib/dates";
import { MESSAGE_COLUMNS, signedMessagePhotoUrls, type MentorMessage } from "@/lib/message-photos";
import { inboxWhen, messagePreview, threadSummaries } from "@/lib/mentors";
import { isUuid } from "@/lib/softball";
import type { SwitchKey } from "@/lib/switchboard";
import { ChatScroll } from "@/components/chat-scroll";
import { ConversationPane, Inbox, InboxList, InboxPlaceholder } from "@/components/inbox";
import { Live } from "@/components/live";
import { MarkSeen } from "@/components/mark-seen";
import { MessageThread } from "@/components/message-thread";
import { ReplyForm } from "@/components/reply-form";
import { EmptyState } from "@/components/ui";
import { answerMentor, markMentorThreadRead } from "../../messages-actions";
import { firstName, loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "Messages · GGG.Cafe" };

// Her messages (user, 2026-11-23: "players do not have email so is there a way to have a ongoing dialogue like a
// chat", "like a streaming platform or inbox"): a conversation with each mentor, newest first, the open one as a live
// chat where she answers. Only her own conversations: a mentor's conversation with her parents never shows here, not
// even to a parent viewing as her. `?mentor=` opens one; with only one mentor it's open already.
export default async function MessagesPage({ params, searchParams }: PageProps<"/players/[playerId]/messages">) {
  const { playerId } = await params;
  const { mentor: mentorParam } = await searchParams;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const [{ data }, off] = await Promise.all([
    supabase.from("mentor_messages").select(MESSAGE_COLUMNS).eq("player_id", player.id).eq("audience", "player").order("created_at", { ascending: false }).limit(500),
    access.isSelf ? getPlayerFeaturesOff(player.id) : Promise.resolve(new Set<SwitchKey>()),
  ]);
  const messages = (data ?? []) as MentorMessage[];
  const threads = threadSummaries(messages, (m) => m.author_role === "player");
  const selected =
    typeof mentorParam === "string" && isUuid(mentorParam) && threads.some((t) => t.last.mentor_id === mentorParam)
      ? mentorParam
      : threads.length === 1
        ? threads[0].last.mentor_id
        : null;
  const thread = selected ? messages.filter((m) => m.mentor_id === selected).reverse() : [];
  const photos = await signedMessagePhotoUrls(supabase, thread.map((m) => m.photo_path));
  const nameOf = (mentorId: string) => messages.find((m) => m.mentor_id === mentorId && m.author_role === "mentor")?.sender_name ?? "Your mentor";
  const first = firstName(player);
  const base = `/players/${player.id}/messages`;
  const now = new Date().toISOString();

  return (
    <SectionShell title="Messages" subtitle={access.isSelf ? "You and your mentors" : `${first} and her mentors`}>
      <Live table="mentor_messages" column="player_id" value={player.id} />
      {threads.length === 0 ? (
        <EmptyState>No messages yet. When a mentor writes to you, it shows up here, in your notifications and at the top of your menu, and you can answer.</EmptyState>
      ) : (
        <Inbox
          open={Boolean(selected)}
          placeholder={<InboxPlaceholder>Pick a mentor to open your conversation.</InboxPlaceholder>}
          list={
            <InboxList
              label="Conversations"
              empty=""
              items={threads.map((t) => {
                const name = nameOf(t.last.mentor_id);
                return {
                  key: t.key,
                  href: `${base}?mentor=${t.last.mentor_id}`,
                  title: name,
                  tag: "Mentor",
                  preview: `${t.last.author_role === "player" ? (access.isSelf ? "You: " : `${first}: `) : ""}${messagePreview(t.last)}`,
                  when: inboxWhen(t.last.created_at, now, APP_TIME_ZONE),
                  unread: access.isSelf ? t.unread : 0,
                  active: t.last.mentor_id === selected,
                  initials: name
                    .split(/\s+/)
                    .map((w) => w[0] ?? "")
                    .join("")
                    .slice(0, 2)
                    .toUpperCase(),
                };
              })}
            />
          }
        >
          {selected && (
            <ConversationPane
              back={{ href: base, label: "All conversations" }}
              title={nameOf(selected)}
              tag="Mentor"
              note={
                access.isSelf
                  ? "Your parents can read your messages with your mentors too."
                  : "Coaches see the messages a mentor shares with them. Her parents and the site admins read every message, and her answers."
              }
              composer={
                access.isSelf &&
                (off.has("mentor.messages") ? (
                  <p className="text-sm text-muted">Your head coach turned off mentor messages for now.</p>
                ) : (
                  <ReplyForm
                    action={answerMentor.bind(null, player.id, selected)}
                    label={`Message ${nameOf(selected)}`}
                    placeholder="Thanks! Felt better on the drop ball today. Can we work on my rise next time?"
                    sendLabel="Send"
                  />
                ))
              }
            >
              {access.isSelf && <MarkSeen action={markMentorThreadRead.bind(null, player.id, selected)} />}
              <ChatScroll count={thread.length} label={`Messages with ${nameOf(selected)}`} className="max-h-[60vh] p-1">
                <MessageThread
                  messages={thread}
                  viewer={access.isSelf ? "player" : "staff"}
                  me={access.user.id}
                  photoUrls={photos}
                  label={`Your conversation with ${nameOf(selected)}`}
                  empty="No messages yet."
                />
              </ChatScroll>
            </ConversationPane>
          )}
        </Inbox>
      )}
    </SectionShell>
  );
}
