"use client";

// Her commitment and the team pledge (Phase 5): an "I will..." line for each Team
// Standard, then she types her name to sign.
import { useActionState, useState } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { LINE_MAX } from "@/lib/culture";
import { savePledge } from "./culture-actions";

export function PledgeForm({
  playerId,
  teamId,
  standards,
  lines,
  signedName,
  signedAt,
  defaultName,
}: {
  playerId: string;
  teamId: string;
  standards: string[];
  lines: Record<string, string>;
  signedName: string | null;
  signedAt: string | null;
  defaultName: string;
}) {
  const [state, action, pending] = useActionState(savePledge, initialFormState);
  const [sign, setSign] = useState(Boolean(signedAt));
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="player_id" value={playerId} />
      <input type="hidden" name="team_id" value={teamId} />
      <ol className="flex flex-col gap-3">
        {standards.map((title, i) => (
          <li key={title}>
            <Field label={title}>
              <input name={`line:${i}`} maxLength={LINE_MAX} defaultValue={lines[title] ?? ""} placeholder="I will…" className={inputClass} />
            </Field>
          </li>
        ))}
      </ol>
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
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save my commitment"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
