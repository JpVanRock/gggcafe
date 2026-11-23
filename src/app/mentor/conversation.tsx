// A mentor's conversations (user, 2026-11-23: "send message to players as a free form field. Also allow to send
// summary messages to parents as a separate field", "Allow parents and girls to submit responses and maintain as a
// conversation or thread", "like a streaming platform or inbox"). Each player has two: with her (text, a photo, a
// drill; she answers) and with her parents (summaries; they answer; emailed; she never sees it). Loading one, and the
// open conversation on the mentor's Messages page.
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ChatScroll } from "@/components/chat-scroll";
import { ConversationPane } from "@/components/inbox";
import { MarkSeen } from "@/components/mark-seen";
import { MessageThread } from "@/components/message-thread";
import { ReplyForm } from "@/components/reply-form";
import { SubmitButton } from "@/components/submit-button";
import { RECENT_LIMIT } from "@/components/ui";
import { MESSAGE_COLUMNS, signedMessagePhotoUrls, type MentorMessage } from "@/lib/message-photos";
import type { Audience } from "@/lib/mentors";
import type { SwitchKey } from "@/lib/switchboard";
import type { createClient } from "@/lib/supabase/server";
import { markConversationRead, sendParentMessage, setMessageSharing } from "./actions";
import { MessageForm, RemoveMessage, type LibraryDrill } from "./mentor-client";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type Thread = { messages: MentorMessage[]; total: number; photoUrls: Map<string, string> };

/** One conversation (the latest RECENT_LIMIT, or all), oldest first, with photo links. */
export async function loadThread(supabase: Supabase, mentorId: string, playerId: string, audience: Audience, all: boolean): Promise<Thread> {
  const { data, count } = await supabase
    .from("mentor_messages")
    .select(MESSAGE_COLUMNS, { count: "exact" })
    .eq("mentor_id", mentorId)
    .eq("player_id", playerId)
    .eq("audience", audience)
    .order("created_at", { ascending: false })
    .limit(all ? 1000 : RECENT_LIMIT);
  const messages = ((data ?? []) as MentorMessage[]).slice().reverse();
  const photoUrls = await signedMessagePhotoUrls(supabase, messages.map((m) => m.photo_path));
  return { messages, total: count ?? messages.length, photoUrls };
}

export function MentorConversation({
  mentorId,
  player,
  audience,
  thread,
  drills,
  off,
  back,
  showAllHref,
}: {
  mentorId: string;
  player: { id: string; first: string; name: string };
  audience: Audience;
  thread: Thread;
  drills: LibraryDrill[];
  /** what her head coach turned off for mentors */
  off: Set<SwitchKey>;
  back: string;
  /** this conversation with every message */
  showAllHref: string;
}) {
  const toParents = audience === "parents";
  const sharing = (m: MentorMessage) =>
    m.author_role === "mentor" &&
    (toParents ? (
      <RemoveMessage id={m.id} who="Her parents" />
    ) : (
      <>
        <ActionForm action={setMessageSharing} className="flex items-center gap-2">
          <input type="hidden" name="message_id" value={m.id} />
          <input type="hidden" name="shared" value={m.shared_with_coaches ? "0" : "1"} />
          <SubmitButton variant="link" pendingLabel="Saving…" className="text-xs">
            {m.shared_with_coaches ? "Stop sharing" : "Share with coaches"}
          </SubmitButton>
        </ActionForm>
        <RemoveMessage id={m.id} />
      </>
    ));
  const composer = toParents ? (
    off.has("mentor.parent_messages") ? (
      <p className="text-sm text-muted">Her head coach turned off messages to parents for now.</p>
    ) : (
      <ReplyForm
        action={sendParentMessage.bind(null, player.id)}
        label="Summary for her parents"
        hint="Her approved parents read it here and get it by email. They can answer."
        placeholder={`Good week with ${player.first}: her drop ball is landing low now. Next: the same drill with a target.`}
        sendLabel="Send to her parents"
      />
    )
  ) : off.has("mentor.messages") ? (
    <p className="text-sm text-muted">Her head coach turned off messages to players for now.</p>
  ) : (
    <MessageForm playerId={player.id} mentorId={mentorId} playerName={player.first} drills={drills} />
  );
  return (
    <ConversationPane
      back={{ href: back, label: "All conversations" }}
      title={toParents ? `${player.first}'s parents` : player.name}
      tag={toParents ? "Her parents · emailed to them" : "Player"}
      note={
        toParents
          ? `Only you, her approved parents and the site admins read this. ${player.first} doesn't see it.`
          : `${player.first} answers here. Her parents and the site admins read it; her coaches read what you share.`
      }
      aside={
        <Link href={`/mentor/players/${player.id}`} className="text-sm font-semibold text-link hover:underline">
          Her page <span aria-hidden="true">→</span>
        </Link>
      }
      composer={composer}
    >
      <MarkSeen action={markConversationRead.bind(null, player.id, audience)} />
      {thread.total > thread.messages.length && (
        <p className="mb-2 text-xs text-muted">
          Showing the latest {thread.messages.length} of {thread.total}.{" "}
          <Link href={showAllHref} className="font-semibold text-link hover:underline">
            Show all
          </Link>
        </p>
      )}
      <ChatScroll count={thread.messages.length} label={`Messages with ${toParents ? `${player.first}'s parents` : player.first}`} className="max-h-[60vh] p-1">
        <MessageThread
          messages={thread.messages}
          viewer="mentor"
          me={mentorId}
          photoUrls={thread.photoUrls}
          controls={sharing}
          label={toParents ? `Your conversation with ${player.first}'s parents` : `Your conversation with ${player.first}`}
          empty={
            toParents
              ? "Nothing yet. Send her parents a summary: how sessions are going, what she's working on, what's next."
              : `Nothing yet. Write to ${player.first}: she answers here.`
          }
        />
      </ChatScroll>
    </ConversationPane>
  );
}
