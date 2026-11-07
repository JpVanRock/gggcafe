"use client";

import { useActionState, useState } from "react";
import { Card, Field, FormMessage, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import type { TeamCulture, TeamStandard } from "@/components/team-standards";
import { initialFormState } from "@/lib/form";
import { saveTeamDugout } from "./actions";

type Row = TeamStandard & { key: number };

const small = "rounded-md border border-navy-600 px-2 py-1 text-xs text-muted transition hover:border-pink hover:text-ink disabled:opacity-40";

/** Coaches write the team's standards (an ordered list) and its culture. */
export function StandardsForm({
  teamId,
  culture,
  standards,
}: {
  teamId: string;
  culture: TeamCulture | null;
  standards: TeamStandard[];
}) {
  const [state, action, pending] = useActionState(saveTeamDugout, initialFormState);
  const [rows, setRows] = useState<Row[]>(() =>
    (standards.length ? standards : [{ title: "", detail: null }]).map((s, i) => ({ ...s, key: i })),
  );
  const [nextKey, setNextKey] = useState(rows.length);

  const move = (i: number, by: -1 | 1) =>
    setRows((list) => {
      const next = [...list];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
  const add = () => {
    setRows((list) => [...list, { key: nextKey, title: "", detail: null }]);
    setNextKey((k) => k + 1);
  };

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="team_id" value={teamId} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Team Standards">
          <p className="mb-4 text-sm text-muted">What every player on this team does, every day. Short and clear.</p>
          <ol className="flex flex-col gap-4">
            {rows.map((row, i) => (
              <li key={row.key} className="rounded-xl border border-navy-700 bg-navy-950/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-highlight tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex gap-1.5">
                    <button type="button" className={small} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move standard ${i + 1} up`}>
                      ↑
                    </button>
                    <button type="button" className={small} onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move standard ${i + 1} down`}>
                      ↓
                    </button>
                    <button
                      type="button"
                      className={`${small} hover:text-danger`}
                      onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                      aria-label={`Remove standard ${i + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <input
                  name="standard_title"
                  defaultValue={row.title}
                  maxLength={140}
                  placeholder="Sprint on and off the field"
                  aria-label={`Standard ${i + 1}`}
                  className={inputClass}
                />
                <textarea
                  name="standard_detail"
                  defaultValue={row.detail ?? ""}
                  maxLength={800}
                  rows={2}
                  placeholder="What it looks like (optional)"
                  aria-label={`Standard ${i + 1} detail`}
                  className={`${inputClass} mt-2 text-sm`}
                />
              </li>
            ))}
          </ol>
          <button type="button" onClick={add} disabled={rows.length >= 25} className={`${secondaryButtonClass} mt-4`}>
            + Add a standard
          </button>
        </Card>

        <Card title="Team Culture">
          <p className="mb-4 text-sm text-muted">Who this team is and how it plays. Leave a blank line between paragraphs.</p>
          <div className="flex flex-col gap-4">
            <Field label="Headline (optional)" hint="One line that sums it up">
              <input name="headline" defaultValue={culture?.headline ?? ""} maxLength={120} placeholder="Compete. Connect. Elevate." className={inputClass} />
            </Field>
            <Field label="Our culture">
              <textarea
                name="statement"
                defaultValue={culture?.statement ?? ""}
                maxLength={4000}
                rows={12}
                placeholder="We play fast and we play for each other…"
                className={inputClass}
              />
            </Field>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save standards & culture"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
