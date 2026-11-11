"use client";

// The preseason questionnaire and the medical & emergency card (Phase 6). Parents fill in
// the questionnaire on /family (only there, user 2026-11-10); the medical card serves parents
// and head coaches (Dugout). The page passes the server action that saves for that person.
import { useActionState } from "react";
import { Field, FormMessage, fieldClass, inputClass } from "@/components/ui";
import { initialFormState, type FormState } from "@/lib/form";
import { MEDICAL_FIELDS, QUESTIONNAIRE_POSITIONS, SIZES, SIZE_LABEL, type Questionnaire } from "@/lib/family";
import { SubmitButton } from "@/components/submit-button";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

function SizeSelect({ name, label, value }: { name: string; label: string; value: string | null }) {
  return (
    <Field label={label}>
      <select name={name} defaultValue={value ?? ""} className={inputClass}>
        <option value="">–</option>
        {SIZES.map((s) => (
          <option key={s} value={s}>
            {SIZE_LABEL[s]}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function QuestionnaireForm({ action, hidden, values }: { action: Action; hidden: Record<string, string>; values: Partial<Questionnaire> | null }) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <Hidden values={hidden} />
      <SizeSelect name="top_size" label="Jersey / top" value={values?.top_size ?? null} />
      <SizeSelect name="bottom_size" label="Pants" value={values?.bottom_size ?? null} />
      <SizeSelect name="sock_size" label="Socks" value={values?.sock_size ?? null} />
      <fieldset className="sm:col-span-3">
        <legend className="mb-1.5 text-sm font-medium">Jersey numbers, in order of choice</legend>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <input key={i} name="numbers" maxLength={2} inputMode="numeric" defaultValue={values?.numbers?.[i] ?? ""} aria-label={`Choice ${i + 1}`} className={`${fieldClass} w-20 text-center font-display text-lg`} />
          ))}
        </div>
      </fieldset>
      <fieldset className="sm:col-span-3">
        <legend className="mb-1.5 text-sm font-medium">Positions she wants to play (up to four)</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {QUESTIONNAIRE_POSITIONS.map((p) => (
            <label key={p} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="positions" value={p} defaultChecked={values?.positions?.includes(p)} className="size-4 accent-pink" />
              {p === "UT" ? "Utility" : p}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-3">
        <Field label="Experience" hint="Teams, years, positions">
          <textarea name="experience" rows={2} maxLength={300} defaultValue={values?.experience ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-3">
        <Field label="Goals for this season">
          <textarea name="goals" rows={2} maxLength={500} defaultValue={values?.goals ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-3">
        <Field label="Anything else">
          <input name="notes" maxLength={300} defaultValue={values?.notes ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-4 sm:col-span-3">
        <SubmitButton>Save questionnaire</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

export function MedicalForm({ action, hidden, values }: { action: Action; hidden: Record<string, string>; values: Record<string, string | null> | null }) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <Hidden values={hidden} />
      {MEDICAL_FIELDS.map((f) => (
        <div key={f.key} className={f.long ? "sm:col-span-3" : ""}>
          <Field label={f.label} hint={f.hint}>
            {f.long ? (
              <textarea name={f.key} rows={2} maxLength={f.max} defaultValue={values?.[f.key] ?? ""} className={inputClass} />
            ) : (
              <input name={f.key} maxLength={f.max} defaultValue={values?.[f.key] ?? ""} className={inputClass} />
            )}
          </Field>
        </div>
      ))}
      <p className="text-xs text-muted sm:col-span-3">Only her head coach and her parents can see this card.</p>
      <div className="flex items-center gap-4 sm:col-span-3">
        <SubmitButton>Save card</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}
