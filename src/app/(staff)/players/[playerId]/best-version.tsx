"use client";

// The Best Version of You, at the top of her Goals page: the four questions and the
// 15 Minutes a Day Personal Challenge. She (or a coach) writes the answers; mentors and
// view-only staff read them.
import { useActionState } from "react";
import { initialFormState } from "@/lib/form";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { inputClass } from "@/components/ui";
import { SpeedStripes } from "@/components/athletic";
import {
  BEST_VERSION_GOAL, BEST_VERSION_MAX, BEST_VERSION_PROMPTS, BEST_VERSION_TITLE, CHALLENGE, type BestVersionAnswers,
} from "@/lib/best-version";
import { saveBestVersion } from "./goals-actions";

const label = "font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

function Answer({ name, value, canEdit, rows, ariaLabel }: { name: string; value: string; canEdit: boolean; rows: number; ariaLabel: string }) {
  if (!canEdit) return <p className="text-sm whitespace-pre-line text-ink/90">{value || <span className="text-muted">Not answered yet.</span>}</p>;
  return <textarea name={name} defaultValue={value} rows={rows} maxLength={BEST_VERSION_MAX} aria-label={ariaLabel} className={inputClass} />;
}

export function BestVersion({ playerId, answers, canEdit, safety }: { playerId: string; answers: BestVersionAnswers; canEdit: boolean; safety: React.ReactNode }) {
  const [state, action] = useActionState(saveBestVersion, initialFormState);
  return (
    <section className="rounded-2xl border-2 border-pink bg-linear-to-br from-navy-950 via-navy-900 to-navy-800 p-5 sm:p-6" aria-labelledby="best-version">
      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="player_id" value={playerId} />
        <div>
          <p className={`${label} flex items-center gap-3`}>
            <SpeedStripes className="h-3 w-9 text-link" />
            Start here
          </p>
          <h2 id="best-version" className="mt-2 font-display text-2xl font-bold tracking-wide text-highlight uppercase sm:text-3xl">
            {BEST_VERSION_TITLE}
          </h2>
          <p className="mt-1 text-lg font-semibold text-ink">{BEST_VERSION_GOAL}</p>
        </div>

        <ol className="grid gap-5 md:grid-cols-2">
          {BEST_VERSION_PROMPTS.map((p, i) => (
            <li key={p.key} className="flex flex-col gap-2">
              <p className="flex items-baseline gap-3">
                <span className="font-display text-2xl font-bold text-highlight tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-semibold text-ink">{p.question}</span>
              </p>
              <p className="text-sm text-muted">{p.note}</p>
              <Answer name={p.key} value={answers[p.key] ?? ""} canEdit={canEdit} rows={3} ariaLabel={p.question} />
            </li>
          ))}
        </ol>

        <div className="rounded-xl border border-neon/60 bg-neon/5 p-4">
          <p className={label}>{CHALLENGE.title}</p>
          <p className="mt-2 font-semibold text-ink">{CHALLENGE.question}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {CHALLENGE.ideas.map((idea) => (
              <li key={idea} className="flex gap-1.5">
                <span className="text-link">·</span>
                {idea}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Answer name={CHALLENGE.key} value={answers[CHALLENGE.key] ?? ""} canEdit={canEdit} rows={3} ariaLabel={CHALLENGE.question} />
          </div>
          <div className="mt-3">{safety}</div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-4">
            <SubmitButton>Save my answers</SubmitButton>
            <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
          </div>
        )}
      </form>
    </section>
  );
}
