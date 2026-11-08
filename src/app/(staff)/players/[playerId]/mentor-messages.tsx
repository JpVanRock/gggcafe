// Mentor messages on her side: the alerts at the top of her player menu, and the
// full list on her Messages page. Text, a photo, a suggested drill (with its video).
import Link from "next/link";
import { SpeedStripes } from "@/components/athletic";
import { formatDay } from "@/lib/dates";
import type { MentorMessage } from "@/lib/message-photos";
import { GotIt } from "./messages-client";

export function MessageCard({
  message: m,
  photoUrl,
  playerId,
  canDismiss,
}: {
  message: MentorMessage;
  photoUrl: string | null;
  playerId: string;
  canDismiss: boolean;
}) {
  return (
    <article className={`flex flex-col gap-2 rounded-xl border p-4 ${m.read_at ? "border-navy-700" : "border-neon/60 bg-neon/5"}`}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-ink">{m.sender_name}</span>
        <span className="font-mono text-[10px] tracking-wider text-muted uppercase">{formatDay(m.created_at.slice(0, 10))}</span>
        {!m.read_at && <span className="rounded bg-neon px-1.5 py-px font-mono text-[10px] font-bold tracking-wider text-on-accent uppercase">New</span>}
        {canDismiss && !m.read_at && (
          <span className="ml-auto">
            <GotIt playerId={playerId} ids={[m.id]} />
          </span>
        )}
      </p>
      {m.body && <p className="whitespace-pre-wrap text-sm text-ink/90">{m.body}</p>}
      {photoUrl && (
        <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="self-start">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL */}
          <img src={photoUrl} alt={`Photo from ${m.sender_name}`} className="max-h-72 rounded-lg object-contain" />
        </a>
      )}
      {m.drill_name && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-pink/40 bg-pink/5 px-3 py-2 text-sm">
          <span className="font-mono text-[10px] tracking-wider text-pink-soft uppercase">Drill to try</span>
          <span className="font-semibold">{m.drill_name}</span>
          {m.drill_video_url && (
            <a href={m.drill_video_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-pink hover:underline">
              Watch the drill ↗
            </a>
          )}
        </p>
      )}
    </article>
  );
}

/** The alerts at the top of her menu: new messages, or a slim link when she's caught up. */
export function MentorAlerts({
  playerId,
  unread,
  total,
  photoUrls,
  canDismiss,
}: {
  playerId: string;
  unread: MentorMessage[];
  total: number;
  photoUrls: Map<string, string>;
  canDismiss: boolean;
}) {
  if (total === 0) return null;
  const href = `/players/${playerId}/messages`;
  if (unread.length === 0) {
    return (
      <Link href={href} className="flex items-center justify-between gap-3 rounded-2xl border border-navy-700 px-4 py-2.5 text-sm transition hover:border-pink">
        <span className="font-mono text-[0.75rem] leading-4 tracking-[0.25em] text-pink-soft uppercase">From your mentors</span>
        <span className="text-muted">
          {total} message{total === 1 ? "" : "s"} · all caught up →
        </span>
      </Link>
    );
  }
  return (
    <section aria-label="From your mentors" className="flex flex-col gap-3 rounded-2xl border-2 border-neon/70 bg-navy-900/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-3 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.25em] text-pink-soft uppercase">
          <SpeedStripes className="h-3 w-8 text-pink" />
          From your mentors · {unread.length} new
        </p>
        <span className="flex items-center gap-3">
          {canDismiss && unread.length > 1 && <GotIt playerId={playerId} ids={unread.map((m) => m.id)} label="Got them all" />}
          <Link href={href} className="text-sm text-pink hover:underline">
            All messages →
          </Link>
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {unread.slice(0, 4).map((m) => (
          <MessageCard key={m.id} message={m} photoUrl={m.photo_path ? (photoUrls.get(m.photo_path) ?? null) : null} playerId={playerId} canDismiss={canDismiss} />
        ))}
      </div>
    </section>
  );
}
