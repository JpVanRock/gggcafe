"use client";

import { useActionState } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { DUTY_PHASES, DUTY_PHASE_LABEL, type DutyPhase } from "@/lib/staff-duties";
import { addDuty, removeDuty, saveDutyOwners, saveStaffStandards } from "./actions";

export type DutyRow = { id: string; phase: DutyPhase; duty: string; owner: string | null };

/** The whole matrix in one form: an owner for every job, saved together. */
export function DutyMatrixForm({ duties, names }: { duties: DutyRow[]; names: string[] }) {
  const [state, action, pending] = useActionState(saveDutyOwners, initialFormState);
  const [removed, remove] = useActionState(removeDuty, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-5">
      <datalist id="staff-names">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <div className="grid gap-5 lg:grid-cols-2">
        {DUTY_PHASES.map((phase) => {
          const list = duties.filter((d) => d.phase === phase);
          if (list.length === 0) return null;
          return (
            <fieldset key={phase} className="rounded-xl border border-navy-700 p-3">
              <legend className="px-1 font-mono text-2xs font-bold tracking-[0.18em] text-pink-soft uppercase">{DUTY_PHASE_LABEL[phase]}</legend>
              <ul className="flex flex-col gap-2">
                {list.map((d) => (
                  <li key={d.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 text-sm">
                    <span className="truncate">{d.duty}</span>
                    <input type="hidden" name={`was_${d.id}`} value={d.owner ?? ""} />
                    <input name={`owner_${d.id}`} defaultValue={d.owner ?? ""} maxLength={60} list="staff-names" placeholder="Who" aria-label={`Who: ${d.duty}`} className={`${inputClass} px-2 py-1 text-sm`} />
                    <button type="submit" formAction={remove} name="remove" value={d.id} aria-label={`Remove ${d.duty}`} className="rounded px-1.5 text-muted hover:text-danger">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save who does what"}
        </button>
        <FormMessage error={state.error ?? removed.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function AddDutyForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState(addDuty, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[12rem_1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="team_id" value={teamId} />
      <Field label="When">
        <select name="phase" defaultValue="game" className={inputClass}>
          {DUTY_PHASES.map((p) => (
            <option key={p} value={p}>
              {DUTY_PHASE_LABEL[p]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Job">
        <input name="duty" required maxLength={60} className={inputClass} />
      </Field>
      <Field label="Who">
        <input name="owner" maxLength={60} list="staff-names" className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Adding…" : "Add"}
      </button>
      <div className="sm:col-span-4">
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function StaffStandardsForm({ teamId, commitment, prePractice }: { teamId: string; commitment: string[]; prePractice: string[] }) {
  const [state, action, pending] = useActionState(saveStaffStandards, initialFormState);
  return (
    <form action={action} className="grid gap-4 lg:grid-cols-2">
      <input type="hidden" name="team_id" value={teamId} />
      <Field label="Staff commitment" hint="One line each, up to 12">
        <textarea name="commitment" rows={8} defaultValue={commitment.join("\n")} className={inputClass} />
      </Field>
      <Field label="Before every practice" hint="Checklist for every coach, up to 15 lines">
        <textarea name="pre_practice" rows={8} defaultValue={prePractice.join("\n")} className={inputClass} />
      </Field>
      <div className="flex items-center gap-4 lg:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save standards"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
