"use client";

import { useActionState } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { BATS, BATS_LABEL, POSITIONS, POSITION_LABEL, THROWS, THROWS_LABEL, type Player } from "@/lib/softball";
import { createPlayer, updatePlayer } from "./actions";

export function PlayerForm({ player }: { player?: Player }) {
  const [state, action, pending] = useActionState(player ? updatePlayer : createPlayer, initialFormState);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-6">
      {player && <input type="hidden" name="id" value={player.id} />}

      <div className="sm:col-span-2">
        <Field label="First name">
          <input name="first_name" required defaultValue={player?.first_name ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Last name">
          <input name="last_name" required defaultValue={player?.last_name ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Goes by" hint="Optional nickname">
          <input name="preferred_name" defaultValue={player?.preferred_name ?? ""} className={inputClass} />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field label="Primary position">
          <select name="primary_position" defaultValue={player?.primary_position ?? ""} className={inputClass}>
            <option value="">—</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>{p} · {POSITION_LABEL[p]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Bats">
        <select name="bats" defaultValue={player?.bats ?? ""} className={inputClass}>
          <option value="">—</option>
          {BATS.map((b) => (
            <option key={b} value={b}>{BATS_LABEL[b]}</option>
          ))}
        </select>
      </Field>
      <Field label="Throws">
        <select name="throws" defaultValue={player?.throws ?? ""} className={inputClass}>
          <option value="">—</option>
          {THROWS.map((t) => (
            <option key={t} value={t}>{THROWS_LABEL[t]}</option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Grad year">
          <input
            name="grad_year"
            inputMode="numeric"
            maxLength={4}
            placeholder="2030"
            defaultValue={player?.grad_year ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <fieldset className="sm:col-span-6">
        <legend className="mb-1.5 text-sm font-medium">Also plays</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {POSITIONS.map((p) => (
            <label key={p} className="flex items-center gap-1.5 text-sm" title={POSITION_LABEL[p]}>
              <input
                type="checkbox"
                name="secondary_positions"
                value={p}
                defaultChecked={player?.secondary_positions.includes(p) ?? false}
              />
              {p}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm sm:col-span-6">
        <input type="checkbox" name="is_slapper" defaultChecked={player?.is_slapper ?? false} />
        Slapper (left-side short game)
      </label>

      <div className="sm:col-span-6">
        <Field label="Notes">
          <textarea name="notes" rows={3} defaultValue={player?.notes ?? ""} className={inputClass} />
        </Field>
      </div>

      <div className="flex items-center gap-4 sm:col-span-6">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : player ? "Save changes" : "Add player"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
