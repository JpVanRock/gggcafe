"use client";

// Booking a video call (user, 2026-11-12; docs/features/video-calls.md): a mentor on her page, or
// a head coach on the Dugout Calendar (pick the player). The day and time are in the booker's own
// time zone; the browser turns them into an exact time for the server. "Show on calendars" (user,
// 2026-11-14) picks which calendars list it; the booker's own always does. With a list of players, any
// number of them can be ticked for a group call (user, 2026-11-14), all on one team, up to 20 (12 until 2026-11-22).
import { useActionState, useState } from "react";
import { Field, FormMessage, inputClass, groupLabelClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { initialFormState } from "@/lib/form";
import { CALL_CALENDARS, CALL_MAX_PLAYERS, CALL_MINUTES, TOPIC_MAX, type CallCalendar } from "@/lib/video-calls";
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
  /** the Dugout Calendar's roster, or a mentor's players (with their team): tick one or several */
  players?: { id: string; name: string; team?: string }[];
}) {
  const [state, action] = useActionState(scheduleVideoCall, initialFormState);
  const [when, setWhen] = useState("");
  // a head coach books on the Dugout (teamId); their own calendar is the Dugout's, so that one isn't a choice
  const booker = teamId ? "coach" : "mentor";
  const choices = CALL_CALENDARS.filter((c) => !(booker === "coach" && c.key === "coaches"));
  const [shown, setShown] = useState<Set<CallCalendar>>(() => new Set(choices.map((c) => c.key)));
  // ticked players; a call is for one team, so once one is ticked the other teams' players are greyed out
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const teamOf = new Map((players ?? []).map((p) => [p.id, p.team ?? ""]));
  const pickedTeam = picked.size ? teamOf.get([...picked][0]) : undefined;
  const teamNames = [...new Set((players ?? []).map((p) => p.team ?? ""))];
  // "Select all" (user, 2026-11-22: "so don't have to check one by one") ticks a team's players, up to the
  // call's limit, and clears any other team's; with everyone on, it clears them. The player boxes stay
  // uncontrolled (see their onChange), so it sets the boxes and then reads them back.
  const selectAll = (team: string) => {
    const onTeam = (players ?? []).filter((p) => (p.team ?? "") === team);
    if (onTeam.length < 2) return null;
    const ticked = onTeam.filter((p) => picked.has(p.id)).length;
    const allOn = ticked > 0 && ticked === Math.min(onTeam.length, CALL_MAX_PLAYERS);
    const lockedOut = pickedTeam !== undefined && team !== pickedTeam;
    const tooMany = onTeam.length > CALL_MAX_PLAYERS;
    return (
      <label className={`flex items-center gap-2.5 border-b border-navy-700 pb-2 ${lockedOut ? "opacity-50" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          checked={allOn}
          disabled={lockedOut}
          // part of the team ticked: the box shows a dash
          ref={(el) => {
            if (el) el.indeterminate = ticked > 0 && !allOn;
          }}
          onChange={(e) => {
            const boxes = [...(e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="player_id"]') ?? [])];
            let n = 0;
            for (const b of boxes) b.checked = !allOn && b.dataset.team === team && n++ < CALL_MAX_PLAYERS;
            setPicked(new Set(boxes.filter((b) => b.checked).map((b) => b.value)));
          }}
          className="size-5 shrink-0 accent-pink"
        />
        <span className="text-sm font-semibold">
          {tooMany ? `Select the first ${CALL_MAX_PLAYERS}` : "Select all"}
          <span className="ml-1.5 text-xs font-normal text-muted">
            {onTeam.length} players{tooMany && `; a call holds up to ${CALL_MAX_PLAYERS}`}
          </span>
        </span>
      </label>
    );
  };
  const summary = [booker === "coach" ? "Coaches Dugout (yours)" : "Your calendar", ...choices.filter((c) => shown.has(c.key)).map((c) => c.label)].join(", ");
  const startsAt = (() => {
    const d = when ? new Date(when) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toISOString() : "";
  })();
  return (
    // after a booking the form resets: every calendar ticked again
    <form
      action={action}
      onReset={() => {
        setShown(new Set(choices.map((c) => c.key)));
        setPicked(new Set());
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {teamId && <input type="hidden" name="team_id" value={teamId} />}
      <input type="hidden" name="starts_at" value={startsAt} />
      {player ? (
        <input type="hidden" name="player_id" value={player.id} />
      ) : (
        <fieldset className="flex min-w-0 flex-col gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">
            With <span className="ml-1.5 text-xs font-normal text-muted">Required</span>
          </legend>
          <p className="text-xs text-muted">
            Tick one player, or several for a group call (up to {CALL_MAX_PLAYERS}, one team). Every player&apos;s parents are invited.
            {picked.size > 0 && ` ${picked.size} picked.`}
          </p>
          {teamNames.map((team) => (
            <div key={team || "team"} className="flex flex-col gap-2">
              {teamNames.length > 1 && <p className={`text-pink-soft ${groupLabelClass}`}>{team}</p>}
              {selectAll(team)}
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {(players ?? [])
                  .filter((p) => (p.team ?? "") === team)
                  .map((p) => {
                    const otherTeam = pickedTeam !== undefined && (p.team ?? "") !== pickedTeam;
                    const full = picked.size >= CALL_MAX_PLAYERS && !picked.has(p.id);
                    return (
                      <label key={p.id} className={`flex items-center gap-2.5 ${otherTeam || full ? "opacity-50" : "cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          name="player_id"
                          value={p.id}
                          data-team={p.team ?? ""}
                          disabled={otherTeam || full}
                          // read every box, so the count and the team lock match them even after a tick made before the page was ready
                          onChange={(e) => {
                            const boxes = e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="player_id"]') ?? [];
                            setPicked(new Set([...boxes].filter((b) => b.checked).map((b) => b.value)));
                          }}
                          className="size-5 shrink-0 accent-pink"
                        />
                        <span className="min-w-0 truncate text-sm">{p.name}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          ))}
        </fieldset>
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
      <fieldset className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">Show on calendars</legend>
        <details className="group">
          <summary className={`${inputClass} flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden`}>
            <span className="min-w-0 truncate">{summary}</span>
            <span aria-hidden="true" className="shrink-0 text-muted transition group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="mt-2 flex flex-col gap-3 rounded-md border border-navy-600 bg-navy-900 p-3">
            <p className="text-xs text-muted">{booker === "coach" ? "Always on the Coaches Dugout calendar (yours)." : "Always on your own calendar."}</p>
            {choices.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  name="calendars"
                  value={c.key}
                  defaultChecked
                  // read every box, so the summary matches them even after a tick made before the page was ready
                  onChange={(e) => {
                    const boxes = e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="calendars"]') ?? [];
                    setShown(new Set([...boxes].filter((b) => b.checked).map((b) => b.value as CallCalendar)));
                  }}
                  className="mt-0.5 size-5 shrink-0 accent-pink"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{c.label}</span>
                  <span className="block text-xs text-muted">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </details>
        <span className="text-xs text-muted">Wherever it shows, her parents are still told about the call and can join.</span>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Booking…">Schedule the call</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}
