// Chat in a video call (user, 2026-11-23: "should be able to chat with players during video call ... a live chat in
// the video call back that is saved"): beside the video, kept with the call. The people on the call write while it's
// open; afterwards it reads back here. Live: a new message shows for everyone as it's sent.
import { APP_TIME_ZONE } from "@/lib/dates";
import { CALL_CHAT_MAX, formatCallClock } from "@/lib/video-calls";
import { createClient } from "@/lib/supabase/server";
import { ChatScroll } from "@/components/chat-scroll";
import { Live } from "@/components/live";
import { ReplyForm } from "@/components/reply-form";
import { eyebrowClass } from "@/components/ui";
import { sendCallMessage } from "../actions";

const ROLE: Record<string, string> = { host: "Host", mentor: "Mentor", coach: "Coach", player: "Player", parent: "Parent", guest: "Guest" };

export async function CallChat({ callId, me, open }: { callId: string; me: string; open: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("video_call_messages")
    .select("id, author_id, author_name, author_role, body, created_at")
    .eq("call_id", callId)
    .order("created_at")
    .limit(500);
  const messages = data ?? [];
  if (!open && messages.length === 0) return null;
  return (
    <section aria-labelledby="call-chat" className="flex min-w-0 flex-col rounded-2xl border border-navy-700 bg-navy-900/70">
      <Live table="video_call_messages" column="call_id" value={callId} />
      <header className="border-b border-navy-700 px-4 py-3">
        <h2 id="call-chat" className="font-display text-lg leading-tight font-bold tracking-wide text-highlight uppercase">
          Chat
        </h2>
        <p className="text-xs text-muted">
          {open ? "Everyone on the call reads it, and it's saved with the call. Zoom's own chat isn't saved." : "Saved with the call."}
        </p>
      </header>
      <ChatScroll count={messages.length} label="Call chat" className="max-h-[50vh] min-h-32 p-3 xl:max-h-[56vh]">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">No messages yet.</p>
        ) : (
          <ol aria-label="Messages in the call" className="flex flex-col gap-2.5">
            {messages.map((m) => {
              const mine = m.author_id === me;
              return (
                <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[92%] rounded-2xl border px-3 py-2 text-sm ${mine ? "border-pink/50 bg-pink/10" : "border-navy-600 bg-navy-800/70"}`}>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold text-ink">{mine ? "You" : m.author_name}</span>
                      {!mine && <span className={eyebrowClass}>{ROLE[m.author_role] ?? "Guest"}</span>}
                      <span className="font-display text-xs text-muted tabular-nums">{formatCallClock(m.created_at, APP_TIME_ZONE)}</span>
                    </p>
                    <p className="whitespace-pre-wrap text-ink/90">{m.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </ChatScroll>
      {open ? (
        <div className="border-t border-navy-700 p-3">
          <ReplyForm action={sendCallMessage.bind(null, callId)} label="Message the call" placeholder="Can everyone hear me?" maxLength={CALL_CHAT_MAX} rows={2} />
        </div>
      ) : (
        <p className="border-t border-navy-700 px-4 py-3 text-xs text-muted">The chat is closed. It opens 10 minutes before a call and closes 15 minutes after it ends.</p>
      )}
    </section>
  );
}
