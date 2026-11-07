"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { initialFormState, type FormState } from "@/lib/form";
import { createPlayer } from "./actions";
import { PlayerFields } from "./player-fields";

export type IntakeTeam = { id: string; name: string; age_group: string | null };

/**
 * Player intake form: name, current team, date of birth, jersey number, class
 * year, batting and throwing hand, positions; optional profile picture and
 * walk-up songs. On a team page the team is fixed and the form clears after
 * each player so the next one can be added.
 */
export function IntakeForm({ teams, fixedTeam }: { teams: IntakeTeam[]; fixedTeam?: { id: string; seasonId: string } }) {
  const [round, setRound] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await createPlayer(prev, fd);
    if (result.saved) setRound((r) => r + 1);
    return result;
  }, initialFormState);

  const teamFields = (
    <>
      {fixedTeam ? (
        <>
          <input type="hidden" name="team_id" value={fixedTeam.id} />
          <input type="hidden" name="season_id" value={fixedTeam.seasonId} />
          <input type="hidden" name="stay" value="1" />
        </>
      ) : (
        <div className="sm:col-span-4">
          <Field label="Current team">
            <select name="team_id" required defaultValue={teams.length === 1 ? teams[0].id : ""} className={inputClass}>
              <option value="">Choose her team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.age_group && !t.name.includes(t.age_group) ? ` · ${t.age_group}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <div className="sm:col-span-2">
        <Field label="Jersey number">
          <input name="jersey_number" required inputMode="numeric" maxLength={2} placeholder="7" autoComplete="off" className={inputClass} />
        </Field>
      </div>
    </>
  );

  return (
    <form key={round} action={action} className="grid gap-6 sm:grid-cols-6">
      <PlayerFields required teamFields={teamFields} />
      <div className="flex flex-wrap items-center gap-4 sm:col-span-6">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : fixedTeam ? "Add to roster" : "Add player"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
