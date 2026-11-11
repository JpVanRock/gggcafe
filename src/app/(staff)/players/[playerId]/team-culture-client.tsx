"use client";

// Her commitment and the team pledge (Phase 5): one "I will..." that covers every Team
// Standard (user, 2026-11-11), then she types her name to sign.
import { useActionState, useState } from "react";
import { Field, FormMessage, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { PLEDGE_MAX } from "@/lib/culture";
import { savePledge } from "./culture-actions";
import { SubmitButton } from "@/components/submit-button";

export function PledgeForm({
  playerId,
  teamId,
  standards,
  line,
  signedName,
  signedAt,
  defaultName,
}: {
  playerId: string;
  teamId: string;
  standards: string[];
  /** her commitment so far */
  line: string;
  signedName: string | null;
  signedAt: string | null;
  defaultName: string;
}) {
  const [state, action] = useActionState(savePledge, initialFormState);
  const [sign, setSign] = useState(Boolean(signedAt));
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="player_id" value={playerId} />
      <input type="hidden" name="team_id" value={teamId} />
      <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {standards.map((title, i) => (
          <li key={title} className="flex items-baseline gap-3 text-sm">
            <span className="font-display font-bold text-highlight tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            {title}
          </li>
        ))}
      </ol>
      <Field label="My commitment to every standard above" hint="One line in your own words.">
        <textarea name="pledge" maxLength={PLEDGE_MAX} rows={3} defaultValue={line} placeholder="I will…" className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="sign" checked={sign} onChange={(e) => setSign(e.target.checked)} className="size-4 accent-pink" />
        I&apos;m in: I sign the team pledge for this season
      </label>
      {sign && (
        <Field label="Type your name to sign">
          <input name="signed_name" required maxLength={80} defaultValue={signedName ?? defaultName} className={`${inputClass} font-display text-lg italic`} />
        </Field>
      )}
      <div className="flex items-center gap-4">
        <SubmitButton>Save my commitment</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}
