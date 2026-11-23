"use client";

// The team boxes on a mentor's calendar (user, 2026-11-23: "check and uncheck team schedules they are mentoring"):
// her calendar starts with only what she added (training, video calls); each team she checks adds its practices,
// events and games. A box changes at once and the calendar fills in when the server answers; a refusal puts it back.
import { useOptimistic, useState, useTransition } from "react";
import { groupLabelClass } from "@/components/ui";
import { setCalendarTeam } from "../actions";

export type CalendarTeam = { team_id: string; team_name: string; shown: boolean; off: boolean };

export function TeamBoxes({ teams }: { teams: CalendarTeam[] }) {
  const [shown, setShown] = useOptimistic(new Set(teams.filter((t) => t.shown).map((t) => t.team_id)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(teamId: string, on: boolean) {
    setError(null);
    startTransition(async () => {
      const next = new Set(shown);
      if (on) next.add(teamId);
      else next.delete(teamId);
      setShown(next);
      const res = await setCalendarTeam(teamId, on);
      if (res.error) setError(res.error);
    });
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-2xl border border-navy-700 bg-navy-900/70 p-4" aria-busy={pending}>
      <legend className={`px-1 text-pink-soft ${groupLabelClass}`}>Team schedules</legend>
      <p className="text-sm text-muted">Your calendar shows your training and video calls. Check a team to add its practices, events and games.</p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {teams.map((t) => (
          <label key={t.team_id} className={`flex min-h-10 items-center gap-2 text-sm ${t.off ? "text-muted" : ""}`}>
            <input
              type="checkbox"
              checked={!t.off && shown.has(t.team_id)}
              disabled={t.off}
              onChange={(e) => toggle(t.team_id, e.target.checked)}
              className="size-4 accent-pink"
            />
            <span>
              {t.team_name}
              {t.off && <span className="block text-xs">Its head coach keeps the team calendar off for mentors.</span>}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
