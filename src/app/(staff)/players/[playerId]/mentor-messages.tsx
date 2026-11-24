// The latest from her mentors (user, 2026-11-23: "add a banner on players page the most recent message a mentor
// sends"): a banner at the top of her menu with the newest message a mentor sent her, read or not: who, when, the
// text, a drill or a photo. "Answer" opens that conversation on her Messages page; "Got it" marks the new ones read.
// Only her own conversations (audience player): never a mentor's conversation with her parents.
import Link from "next/link";
import { SpeedStripes } from "@/components/athletic";
import { APP_TIME_ZONE } from "@/lib/dates";
import type { MentorMessage } from "@/lib/message-photos";
import { formatCallTime } from "@/lib/video-calls";
import { GotIt } from "./messages-client";
import { badgeClass, buttonStyles, eyebrowClass } from "@/components/ui";

export function MentorBanner({
  playerId,
  latest,
  unread,
  photoUrl,
  isSelf,
}: {
  playerId: string;
  /** the newest message a mentor sent her */
  latest: MentorMessage;
  /** the mentors' messages she hasn't marked read */
  unread: MentorMessage[];
  photoUrl: string | null;
  /** her own page: "your", Answer and Got it (her parents and coaches read it) */
  isSelf: boolean;
}) {
  const fresh = !latest.read_at;
  const others = unread.filter((m) => m.id !== latest.id).length;
  return (
    <section
      aria-labelledby="mentor-banner"
      className={`flex flex-col gap-3 rounded-2xl border-2 p-4 sm:p-5 ${fresh ? "border-neon-edge/70 bg-neon/5" : "border-navy-700 bg-navy-900/60"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="mentor-banner" className="flex items-center gap-3 font-sans text-2xs font-bold tracking-[0.25em] text-pink-soft uppercase">
          <SpeedStripes className="h-3 w-8 text-link" />
          Latest from {isSelf ? "your" : "her"} mentors
          {/* for her parents and coaches: she hasn't opened it yet */}
          {fresh && <span className={badgeClass("neon")}>{isSelf ? "New" : "Not seen yet"}</span>}
        </h2>
        <span className="font-display text-xs text-muted tabular-nums">{formatCallTime(latest.created_at, APP_TIME_ZONE)}</span>
      </div>
      <div className="flex gap-4">
        {photoUrl && (
          <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL */}
            <img src={photoUrl} alt={`Photo from ${latest.sender_name}`} className="size-16 rounded-lg object-cover sm:size-20" />
          </a>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-display text-lg leading-tight font-bold tracking-wide uppercase">{latest.sender_name}</p>
          {latest.body && <p className="line-clamp-3 text-sm whitespace-pre-wrap text-ink/90">{latest.body}</p>}
          {latest.drill_name && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className={eyebrowClass}>Drill to try</span>
              <span className="font-semibold">{latest.drill_name}</span>
              {latest.drill_video_url && (
                <a href={latest.drill_video_url} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
                  Watch the drill ↗
                </a>
              )}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/players/${playerId}/messages?mentor=${latest.mentor_id}`} className={buttonStyles("pill")}>
          {isSelf ? "Answer" : "Open the conversation"} <span aria-hidden="true">→</span>
        </Link>
        {isSelf && unread.length > 0 && <GotIt playerId={playerId} ids={unread.map((m) => m.id)} label={unread.length > 1 ? "Got them all" : "Got it"} />}
        {isSelf && others > 0 && (
          <Link href={`/players/${playerId}/messages`} className="text-sm text-link hover:underline">
            {others} {fresh ? "more " : ""}new {others === 1 ? "message" : "messages"} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </section>
  );
}
