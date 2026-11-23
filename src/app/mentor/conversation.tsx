// A mentor's two conversations about one player (user, 2026-11-23: "send message to players as a free form field.
// Also allow to send summary messages to parents as a separate field", then "Allow parents and girls to submit
// responses and maintain as a conversation or thread"): her thread with the player (text, a photo, a drill; the
// player answers) and her thread with the player's parents (summaries; they answer; emailed; the player never sees
// it). On the mentor's Messages page and her player page.
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { MarkSeen } from "@/components/mark-seen";
import { MessageThread } from "@/components/message-thread";
import { ReplyForm } from "@/components/reply-form";
import { SubmitButton } from "@/components/submit-button";
import { RECENT_LIMIT, eyebrowClass } from "@/components/ui";
import { MESSAGE_COLUMNS, signedMessagePhotoUrls, type MentorMessage } from "@/lib/message-photos";
import type { Audience } from "@/lib/mentors";
import type { SwitchKey } from "@/lib/switchboard";
import type { createClient } from "@/lib/supabase/server";
import { markConversationsRead, sendParentMessage, setMessageSharing } from "./actions";
import { MessageForm, RemoveMessage, type LibraryDrill } from "./mentor-client";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Thread = { messages: MentorMessage[]; total: number };
export type Conversation = { player: Thread; parents: Thread; photoUrls: Map<string, string>; drills: LibraryDrill[] };

/** Both threads with one player (the latest RECENT_LIMIT of each, or all), oldest first, with photo links. */
export async function loadConversation(supabase: Supabase, mentorId: string, playerId: string, all: boolean): Promise<Conversation> {
  const thread = (audience: Audience) =>
    supabase
      .from("mentor_messages")
      .select(MESSAGE_COLUMNS, { count: "exact" })
      .eq("mentor_id", mentorId)
      .eq("player_id", playerId)
      .eq("audience", audience)
      .order("created_at", { ascending: false })
      .limit(all ? 1000 : RECENT_LIMIT);
  const [mine, theirs, { data: drills }] = await Promise.all([
    thread("player"),
    thread("parents"),
    supabase.from("practice_drills").select("id, name, video_url").order("name"),
  ]);
  const asThread = (r: { data: unknown; count: number | null }): Thread => {
    const messages = ((r.data ?? []) as MentorMessage[]).slice().reverse();
    return { messages, total: r.count ?? messages.length };
  };
  const player = asThread(mine);
  const photoUrls = await signedMessagePhotoUrls(supabase, player.messages.map((m) => m.photo_path));
  return { player, parents: asThread(theirs), photoUrls, drills: (drills ?? []) as LibraryDrill[] };
}

export function MentorConversation({
  mentorId,
  player,
  conversation: c,
  off,
  first = "player",
  showAllHref,
}: {
  mentorId: string;
  player: { id: string; first: string };
  conversation: Conversation;
  /** what her head coach turned off for mentors */
  off: Set<SwitchKey>;
  /** which thread comes first (a notice opens the one it's about) */
  first?: Audience;
  /** the same page with every message (`?all=1`) */
  showAllHref: string;
}) {
  const sharing = (m: MentorMessage) =>
    m.author_role === "mentor" && (
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
    );
  const withPlayer = (
    <section key="player" aria-labelledby={`with-${player.id}`} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-navy-700 bg-navy-900/70 p-4 sm:p-5">
      <header>
        <h2 id={`with-${player.id}`} className="font-display text-xl leading-tight font-bold tracking-wide text-highlight uppercase">
          With {player.first}
        </h2>
        <p className={`mt-1 ${eyebrowClass}`}>She answers here · her parents read it too</p>
      </header>
      <Earlier thread={c.player} href={showAllHref} />
      <MessageThread
        messages={c.player.messages}
        viewer="mentor"
        me={mentorId}
        photoUrls={c.photoUrls}
        controls={sharing}
        label={`Your conversation with ${player.first}`}
        empty={`Nothing yet. Write to ${player.first}: she answers here.`}
      />
      {off.has("mentor.messages") ? (
        <p className="text-sm text-muted">Her head coach turned off messages to players for now.</p>
      ) : (
        <div className="border-t border-navy-700 pt-4">
          <MessageForm playerId={player.id} mentorId={mentorId} playerName={player.first} drills={c.drills} />
        </div>
      )}
    </section>
  );
  const withParents = (
    <section key="parents" aria-labelledby={`parents-${player.id}`} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-pink/40 bg-navy-900/70 p-4 sm:p-5">
      <header>
        <h2 id={`parents-${player.id}`} className="font-display text-xl leading-tight font-bold tracking-wide text-highlight uppercase">
          With {player.first}&apos;s parents
        </h2>
        <p className={`mt-1 ${eyebrowClass}`}>Only her parents · they get it by email · {player.first} doesn&apos;t see it</p>
      </header>
      <Earlier thread={c.parents} href={showAllHref} />
      <MessageThread
        messages={c.parents.messages}
        viewer="mentor"
        me={mentorId}
        controls={(m) => m.author_role === "mentor" && <RemoveMessage id={m.id} who="Her parents" />}
        label={`Your conversation with ${player.first}'s parents`}
        empty="Nothing yet. Send her parents a summary: how sessions are going, what she's working on, what's next."
      />
      {off.has("mentor.parent_messages") ? (
        <p className="text-sm text-muted">Her head coach turned off messages to parents for now.</p>
      ) : (
        <div className="border-t border-navy-700 pt-4">
          <ReplyForm
            action={sendParentMessage.bind(null, player.id)}
            label="Summary for her parents"
            hint="Her approved parents read it here and get it by email. They can answer."
            placeholder={`Good week with ${player.first}: her drop ball is landing low now. Next: the same drill with a target.`}
            sendLabel="Send to her parents"
          />
        </div>
      )}
    </section>
  );
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <MarkSeen action={markConversationsRead.bind(null, player.id)} />
      {first === "parents" ? [withParents, withPlayer] : [withPlayer, withParents]}
    </div>
  );
}

/** "Showing the latest 30 of 41": a link to the whole thread. */
function Earlier({ thread, href }: { thread: Thread; href: string }) {
  if (thread.total <= thread.messages.length) return null;
  return (
    <p className="text-xs text-muted">
      Showing the latest {thread.messages.length} of {thread.total}.{" "}
      <Link href={href} className="font-semibold text-link hover:underline">
        Show all
      </Link>
    </p>
  );
}
