"use client";

import { useActionState } from "react";
import { Field, FormMessage, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { movePlayer } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export type MoveTeam = { id: string; name: string; organization: string | null; age_group: string | null; is_own_team: boolean };
export type MoveSeason = { id: string; name: string };
export type MovePlayer = { id: string; label: string };

/**
 * Coaches move a player to another team; her history stays on her profile. It lives on the Dugout's
 * Roster tab (user, 2026-11-11: coaches' pages only, never her profile), where the coach picks her
 * from the roster.
 */
export function MoveTeamForm({ players, teams, seasons }: { players: MovePlayer[]; teams: MoveTeam[]; seasons: MoveSeason[] }) {
  const [state, action] = useActionState(movePlayer, initialFormState);
  const ours = teams.filter((t) => t.is_own_team);
  const others = teams.filter((t) => !t.is_own_team);
  const label = (t: MoveTeam) => [t.name, t.age_group && !t.name.includes(t.age_group) ? t.age_group : null, t.organization].filter(Boolean).join(" · ");
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-6">
      <div className="sm:col-span-3">
        <Field label="Player">
          <select name="player_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose a player
            </option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-3">
        <Field label="New team">
          <select name="team_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose a team
            </option>
            {ours.length > 0 && (
              <optgroup label="Our teams">
                {ours.map((t) => (
                  <option key={t.id} value={t.id}>
                    {label(t)}
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label="Other teams and organizations">
                {others.map((t) => (
                  <option key={t.id} value={t.id}>
                    {label(t)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-3">
        <Field label="Season">
          <select name="season_id" required defaultValue={seasons[0]?.id ?? ""} className={inputClass}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-1">
        <Field label="Jersey #">
          <input name="jersey_number" inputMode="numeric" maxLength={2} className={inputClass} />
        </Field>
      </div>
      <p className="text-xs text-muted sm:col-span-6">
        Her spots on her current teams become inactive but stay in her history. Stats, goals and awards stay with her. If she has a
        player account, she claims her new spot when she signs in.
      </p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton pendingLabel="Moving…">Move to this team</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
      <p className="text-xs text-muted sm:col-span-6">Need a team that isn&apos;t listed? Add it on the Teams page first.</p>
    </form>
  );
}
