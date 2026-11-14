// A list of video calls (user, 2026-11-12; docs/features/video-calls.md): when, what about, who,
// where it stands, Join while it's ahead, and Cancel for whoever may cancel it.
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { badgeClass } from "@/components/ui";
import { APP_TIME_ZONE } from "@/lib/dates";
import { playerName } from "@/lib/softball";
import { CALL_STATE_LABEL, callState, formatCallTime, isComing, type CallTimes } from "@/lib/video-calls";
import { cancelVideoCall } from "@/app/calls/actions";

export type VideoCallRow = CallTimes & {
  id: string;
  player_id: string;
  host_id: string;
  host_kind: string;
  host_name: string;
  topic: string;
  /** which calendars show it besides the host's own (lib/video-calls CALL_CALENDARS) */
  calendars: string[];
  player?: { first_name: string; preferred_name: string | null; last_name: string } | null;
};

/** The columns VideoCallList reads (with the player's name). */
export const VIDEO_CALL_COLUMNS =
  "id, player_id, host_id, host_kind, host_name, topic, starts_at, minutes, cancelled_at, calendars, player:players(first_name, preferred_name, last_name)" as const;

export function VideoCallList({
  calls,
  showPlayer = false,
  canCancel = () => false,
  empty,
}: {
  calls: VideoCallRow[];
  showPlayer?: boolean;
  canCancel?: (call: VideoCallRow) => boolean;
  empty?: string;
}) {
  if (!calls.length) return empty ? <p className="text-sm text-muted">{empty}</p> : null;
  const now = new Date();
  return (
    <ul className="flex flex-col divide-y divide-navy-800">
      {calls.map((c) => {
        const state = callState(c, now);
        const coming = isComing(c, now);
        return (
          <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            {/* on phones the time sits on its own line above the call */}
            <span className="w-full shrink-0 font-display text-sm text-muted tabular-nums sm:w-40">{formatCallTime(c.starts_at, APP_TIME_ZONE)}</span>
            <span className="w-full min-w-0 sm:w-auto sm:flex-1">
              <span className={`block font-semibold ${coming ? "" : "text-muted"}`}>{c.topic}</span>
              <span className="block text-xs text-muted">
                {showPlayer && c.player ? `${playerName(c.player)} · ` : ""}
                {c.host_name} ({c.host_kind === "mentor" ? "mentor" : "head coach"}) · {c.minutes} min
              </span>
            </span>
            <span className={badgeClass(state === "open" ? "neon" : state === "cancelled" ? "danger" : "neutral")}>{CALL_STATE_LABEL[state]}</span>
            {coming && (
              <Link href={`/calls/${c.id}`} className="text-sm font-semibold text-link hover:underline">
                {state === "open" ? "Join now →" : "Call page →"}
              </Link>
            )}
            {coming && canCancel(c) && (
              <ActionForm action={cancelVideoCall}>
                <input type="hidden" name="call_id" value={c.id} />
                <ConfirmSubmit message="Cancel this call? Everyone invited is told." confirmLabel="Cancel the call" className="text-xs text-muted hover:text-danger">
                  Cancel
                </ConfirmSubmit>
              </ActionForm>
            )}
          </li>
        );
      })}
    </ul>
  );
}
