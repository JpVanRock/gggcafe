"use client";

import { useActionState } from "react";
import { Field, FormMessage, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import type { Player } from "@/lib/softball";
import { updatePlayer } from "./actions";
import { PlayerFields } from "./player-fields";
import { SubmitButton } from "@/components/submit-button";

/** "Edit profile" on her Pop Report, and the Roster tab's Edit page (dugout/roster/players/[playerId]). */
export function PlayerForm({ player, photoUrl }: { player: Player; photoUrl?: string | null }) {
  const [state, action] = useActionState(updatePlayer, initialFormState);

  return (
    <form action={action} className="grid gap-6 sm:grid-cols-6">
      <input type="hidden" name="id" value={player.id} />
      <PlayerFields player={player} photoUrl={photoUrl} />

      <fieldset className="grid gap-4 sm:col-span-6">
        <legend className="mb-1 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Coach notes</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_slapper" defaultChecked={player.is_slapper} />
          Slapper (left-side short game)
        </label>
        <Field label="Notes">
          <textarea name="notes" rows={3} defaultValue={player.notes ?? ""} className={inputClass} />
        </Field>
        <p className="text-xs text-muted">
          Jersey number is set on the Dugout&apos;s Roster tab (Edit) or the team&apos;s page. Notes are hidden on her dashboard, but a player with an account could
          still reach them, so keep them coach-appropriate.
        </p>
      </fieldset>

      <div className="flex items-center gap-4 sm:col-span-6">
        <SubmitButton>Save changes</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}
