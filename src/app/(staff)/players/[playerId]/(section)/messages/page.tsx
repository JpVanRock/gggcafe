import type { Metadata } from "next";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MESSAGE_COLUMNS, signedMessagePhotoUrls, type MentorMessage } from "@/lib/message-photos";
import { threadSummaries } from "@/lib/mentors";
import { EmptyState, eyebrowClass } from "@/components/ui";
import { MessageThread } from "@/components/message-thread";
import { ReplyForm } from "@/components/reply-form";
import { GotIt } from "../../messages-client";
import { answerMentor } from "../../messages-actions";
import { firstName, loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "Messages · GGG.Cafe" };

// Her conversations with her mentors (user, 2026-11-23: "Allow parents and girls to submit responses and maintain as
// a conversation or thread"): one thread per mentor, newest activity first; she answers in each. Only her own threads:
// a mentor's conversation with her parents never shows here, not even to a parent viewing as her.
export default async function MessagesPage({ params }: PageProps<"/players/[playerId]/messages">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const { data } = await supabase
    .from("mentor_messages")
    .select(MESSAGE_COLUMNS)
    .eq("player_id", player.id)
    .eq("audience", "player")
    .order("created_at", { ascending: false })
    .limit(300);
  const messages = (data ?? []) as MentorMessage[];
  const photos = await signedMessagePhotoUrls(supabase, messages.map((m) => m.photo_path));
  const threads = threadSummaries(messages, (m) => m.author_role === "player");
  const unread = messages.filter((m) => m.author_role === "mentor" && !m.read_at);
  const first = firstName(player);
  return (
    <SectionShell title="Messages" subtitle={access.isSelf ? "Your mentors" : `${first} and her mentors`}>
      <div className="flex flex-col gap-6">
        {access.isSelf && unread.length > 1 && (
          <div className="self-end">
            <GotIt playerId={player.id} ids={unread.map((m) => m.id)} label="Got them all" />
          </div>
        )}
        {threads.length === 0 ? (
          <EmptyState>No messages yet. When a mentor writes to you, it shows up here and at the top of your menu, and you can answer.</EmptyState>
        ) : (
          threads.map((t) => {
            const thread = messages.filter((m) => m.mentor_id === t.last.mentor_id).reverse();
            const mentorName = thread.findLast((m) => m.author_role === "mentor")?.sender_name ?? "Your mentor";
            return (
              <section
                key={t.key}
                aria-labelledby={`mentor-${t.last.mentor_id}`}
                className="flex flex-col gap-4 rounded-2xl border border-navy-700 bg-navy-900/70 p-4 sm:p-5"
              >
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id={`mentor-${t.last.mentor_id}`} className="font-display text-xl leading-tight font-bold tracking-wide text-highlight uppercase">
                    {mentorName}
                  </h2>
                  {access.isSelf && t.unread > 0 && <span className={eyebrowClass}>{t.unread} new</span>}
                </header>
                <MessageThread
                  messages={thread}
                  viewer={access.isSelf ? "player" : "staff"}
                  me={access.user.id}
                  photoUrls={photos}
                  label={`Messages with ${mentorName}`}
                  empty="No messages yet."
                  controls={(m) => access.isSelf && m.author_role === "mentor" && !m.read_at && <GotIt playerId={player.id} ids={[m.id]} />}
                />
                {access.isSelf && (
                  <div className="border-t border-navy-700 pt-4">
                    <ReplyForm
                      action={answerMentor.bind(null, player.id, t.last.mentor_id)}
                      label={`Answer ${mentorName}`}
                      placeholder="Thanks! Felt better on the drop ball today. Can we work on my rise next time?"
                      hint="Your parents can read your messages with your mentors too."
                    />
                  </div>
                )}
              </section>
            );
          })
        )}
        {!access.isSelf && (
          <p className="text-xs text-muted">
            Coaches see the messages a mentor shares with them. Her parents and the site admins read every message, and her answers.
          </p>
        )}
      </div>
    </SectionShell>
  );
}
