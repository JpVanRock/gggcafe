"use client";

import { useActionState } from "react";
import { Field, FormMessage, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import {
  BATS, BATS_LABEL, FORMATS, FORMAT_LABEL, POSITIONS, POSITION_LABEL, THROWS, THROWS_LABEL,
  type Team,
} from "@/lib/softball";
import {
  addExistingPlayerToRoster, addNewPlayerToRoster, createSeason, createTeam, updateRosterEntry, updateTeam,
} from "./actions";

export function TeamForm({ team }: { team?: Team }) {
  const [state, action, pending] = useActionState(team ? updateTeam : createTeam, initialFormState);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {team && <input type="hidden" name="id" value={team.id} />}

      <fieldset className="flex flex-wrap gap-4 sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">This team is</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="is_own_team" value="true" defaultChecked={team ? team.is_own_team : true} />
          One of our teams
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="is_own_team" value="false" defaultChecked={team ? !team.is_own_team : false} />
          An opponent
        </label>
      </fieldset>

      <Field label="Team name">
        <input name="name" required defaultValue={team?.name ?? ""} placeholder="GGG Gold 14U" className={inputClass} />
      </Field>
      <Field label="Short name" hint="Shown in tight spaces, like box scores">
        <input name="short_name" defaultValue={team?.short_name ?? ""} placeholder="GGG" className={inputClass} />
      </Field>
      <Field label="Age group">
        <input name="age_group" defaultValue={team?.age_group ?? ""} placeholder="14U, Varsity…" className={inputClass} />
      </Field>
      <Field label="Format">
        <select name="format" defaultValue={team?.format ?? "fastpitch"} className={inputClass}>
          {FORMATS.map((f) => (
            <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
          ))}
        </select>
      </Field>
      <Field label="Organization">
        <input name="organization" defaultValue={team?.organization ?? ""} className={inputClass} />
      </Field>
      <Field label="Home field">
        <input name="home_field" defaultValue={team?.home_field ?? ""} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes">
          <textarea name="notes" rows={3} defaultValue={team?.notes ?? ""} className={inputClass} />
        </Field>
      </div>

      <div className="flex items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : team ? "Save changes" : "Add team"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function SeasonForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState(createSeason, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="team_id" value={teamId} />
      <Field label="Season name">
        <input name="name" required placeholder="Spring 2027" className={inputClass} />
      </Field>
      <Field label="Starts">
        <input type="date" name="start_date" className={inputClass} />
      </Field>
      <Field label="Ends">
        <input type="date" name="end_date" className={inputClass} />
      </Field>
      <div className="flex items-center gap-4 sm:col-span-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Creating…" : "Create season"}
        </button>
        <FormMessage error={state.error} />
      </div>
    </form>
  );
}

export function NewRosterPlayerForm({ teamId, seasonId }: { teamId: string; seasonId: string }) {
  const [state, action, pending] = useActionState(addNewPlayerToRoster, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-4">
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="season_id" value={seasonId} />
      <div className="sm:col-span-2">
        <Field label="First name">
          <input name="first_name" required autoComplete="off" className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Last name">
          <input name="last_name" required autoComplete="off" className={inputClass} />
        </Field>
      </div>
      <Field label="Jersey #">
        <input name="jersey_number" inputMode="numeric" maxLength={2} className={inputClass} />
      </Field>
      <Field label="Position">
        <select name="primary_position" defaultValue="" className={inputClass}>
          <option value="">—</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>{p} · {POSITION_LABEL[p]}</option>
          ))}
        </select>
      </Field>
      <Field label="Bats">
        <select name="bats" defaultValue="" className={inputClass}>
          <option value="">—</option>
          {BATS.map((b) => (
            <option key={b} value={b}>{BATS_LABEL[b]}</option>
          ))}
        </select>
      </Field>
      <Field label="Throws">
        <select name="throws" defaultValue="" className={inputClass}>
          <option value="">—</option>
          {THROWS.map((t) => (
            <option key={t} value={t}>{THROWS_LABEL[t]}</option>
          ))}
        </select>
      </Field>
      <Field label="Grad year">
        <input name="grad_year" inputMode="numeric" maxLength={4} placeholder="2030" className={inputClass} />
      </Field>
      <div className="flex items-end gap-4 sm:col-span-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Adding…" : "Add to roster"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function ExistingRosterPlayerForm({
  teamId,
  seasonId,
  players,
}: {
  teamId: string;
  seasonId: string;
  players: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(addExistingPlayerToRoster, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-4">
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="season_id" value={seasonId} />
      <div className="sm:col-span-2">
        <Field label="Player">
          <select name="player_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose a player…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Jersey #">
        <input name="jersey_number" inputMode="numeric" maxLength={2} className={inputClass} />
      </Field>
      <div className="flex items-end">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Adding…" : "Add to roster"}
        </button>
      </div>
      <div className="sm:col-span-4">
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function RosterEntryEditor({
  id,
  jersey,
  active,
}: {
  id: string;
  jersey: string | null;
  active: boolean;
}) {
  const [state, action, pending] = useActionState(updateRosterEntry, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="jersey_number"
        aria-label="Jersey number"
        defaultValue={jersey ?? ""}
        inputMode="numeric"
        maxLength={2}
        className={`${inputClass} w-16 py-1`}
      />
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" name="active" defaultChecked={active} /> Active
      </label>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        {pending ? "…" : "Save"}
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
