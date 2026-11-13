"use client";

// Booking a video call (user, 2026-11-12; docs/features/video-calls.md): a mentor on her page, or
// a head coach on the Dugout Calendar (pick the player). The day and time are in the booker's own
// time zone; the browser turns them into an exact time for the server.
import { useActionState, useState } from "react";
import { Field, FormMessage, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { initialFormState } from "@/lib/form";
import { CALL_MINUTES, TOPIC_MAX } from "@/lib/video-calls";
import { scheduleVideoCall } from "@/app/calls/actions";

export function VideoCallForm({
  teamId,
  player,
  players,
}: {
  /** a head coach books on this team */
  teamId?: string;
  /** a mentor's page: the call is with her */
  player?: { id: string; name: string };
  /** the Dugout Calendar: pick from the roster */
  players?: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(scheduleVideoCall, initialFormState);
  const [when, setWhen] = useState("");
  const startsAt = (() => {
    const d = when ? new Date(when) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toISOString() : "";
  })();
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {teamId && <input type="hidden" name="team_id" value={teamId} />}
      <input type="hidden" name="starts_at" value={startsAt} />
      {player ? (
        <input type="hidden" name="player_id" value={player.id} />
      ) : (
        <Field label="With" required>
          <select name="player_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Pick a player
            </option>
            {(players ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Day and time" hint="In your time zone." required>
        <input type="datetime-local" name="when" required value={when} onChange={(e) => setWhen(e.target.value)} className={inputClass} />
      </Field>
      <Field label="How long" required>
        <select name="minutes" defaultValue="30" className={inputClass}>
          {CALL_MINUTES.map((m) => (
            <option key={m} value={m}>
              {m} minutes
            </option>
          ))}
        </select>
      </Field>
      <Field label="What it's about" required>
        <input name="topic" required maxLength={TOPIC_MAX} placeholder="Drop ball: the release point" className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Booking…">Schedule the call</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}
