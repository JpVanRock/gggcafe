// A mentor conversation (user, 2026-11-23: "maintain as a conversation or thread"): one thread between a mentor and a
// player, or between a mentor and the player's parents, oldest first. What the signed-in user wrote sits on the right
// and says whether the other side has read it; what was written to them and is still unread stands out. Used on the
// mentor's Messages page and player page, the player's Messages page and the family's mentors page.
import type { ReactNode } from "react";
import { APP_TIME_ZONE } from "@/lib/dates";
import type { MentorMessage } from "@/lib/message-photos";
import { formatCallTime } from "@/lib/video-calls";
import { badgeClass, eyebrowClass } from "@/components/ui";

export type ThreadViewer = "mentor" | "player" | "parent" | "staff";

const ROLE: Record<MentorMessage["author_role"], string> = { mentor: "Mentor", player: "Player", parent: "Parent" };

export function MessageThread({
  messages,
  viewer,
  me,
  photoUrls,
  controls,
  empty,
  label,
}: {
  /** oldest first */
  messages: MentorMessage[];
  /** whose page it is: what was written to this side and not read yet stands out ("staff": someone reading along) */
  viewer: ThreadViewer;
  /** the signed-in user: what they sent sits on the right as "You" (two parents share one conversation) */
  me: string;
  photoUrls?: Map<string, string>;
  /** extra buttons under a message (share, remove) */
  controls?: (m: MentorMessage) => ReactNode;
  empty: string;
  /** names the list for screen readers */
  label: string;
}) {
  if (messages.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ol aria-label={label} className="flex flex-col gap-3">
      {messages.map((m) => {
        const mine = m.sender_id === me;
        const fresh = viewer !== "staff" && m.author_role !== viewer && !m.read_at;
        const photo = m.photo_path ? photoUrls?.get(m.photo_path) : undefined;
        const extra = controls?.(m);
        return (
          <li key={m.id} className={`flex flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}>
            <div
              className={`flex max-w-[min(36rem,92%)] flex-col gap-2 rounded-2xl border px-4 py-3 text-sm ${
                mine ? "border-pink/50 bg-pink/10" : fresh ? "border-neon-edge/70 bg-neon/5" : "border-navy-600 bg-navy-800/70"
              }`}
            >
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-semibold text-ink">{mine ? "You" : m.sender_name}</span>
                {!mine && <span className={eyebrowClass}>{ROLE[m.author_role]}</span>}
                <span className="font-display text-xs text-muted tabular-nums">{formatCallTime(m.created_at, APP_TIME_ZONE)}</span>
              </p>
              {m.body && <p className="whitespace-pre-wrap text-ink/90">{m.body}</p>}
              {photo && (
                <a href={photo} target="_blank" rel="noopener noreferrer" className="self-start">
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL */}
                  <img src={photo} alt={`Photo from ${m.sender_name}`} className="max-h-64 rounded-lg object-contain" />
                </a>
              )}
              {m.drill_name && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-pink/40 bg-pink/5 px-3 py-2">
                  <span className={eyebrowClass}>Drill to try</span>
                  <span className="font-semibold">{m.drill_name}</span>
                  {m.drill_video_url && (
                    <a href={m.drill_video_url} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
                      Watch the drill ↗
                    </a>
                  )}
                </p>
              )}
            </div>
            {(mine || m.shared_with_coaches || extra) && (
              <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-1 ${mine ? "justify-end" : ""}`}>
                {m.shared_with_coaches && <span className={badgeClass("pink")}>Shared with coaches</span>}
                {mine && <span className="font-sans text-2xs tracking-wider text-muted uppercase">{m.read_at ? "Seen" : "Not seen yet"}</span>}
                {extra}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
