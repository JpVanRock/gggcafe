"use client";

// A coach's notes on a module of the coaches' Mental Game course. Saving marks it done.
import { useActionState } from "react";
import { Field, FormMessage, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { initialFormState } from "@/lib/form";
import { COACH_NOTES_MAX } from "@/lib/coach-training";
import { saveCoachModule } from "./actions";

export function CoachNotesForm({ lesson, prompt, hint, notes, done }: { lesson: string; prompt: string; hint: string; notes: string | null; done: boolean }) {
  const [state, action] = useActionState(saveCoachModule, initialFormState);
  return (
    <form action={action} className="flex max-w-3xl flex-col gap-3">
      <input type="hidden" name="lesson" value={lesson} />
      <Field label={prompt} hint={hint}>
        <textarea name="notes" rows={5} maxLength={COACH_NOTES_MAX} defaultValue={notes ?? ""} className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton>{done ? "Update my notes" : "Save notes and mark done"}</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}
