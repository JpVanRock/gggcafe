"use client";

// Forms for Coaches Dugout → Playbook: plays on the call sheet, team quizzes and the
// scouting checklist.
import { useActionState } from "react";
import { Field, FormMessage, inputClass, sectionLabelClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import {
  CONFIDENCE_LABEL, PLAY_CATEGORIES, PLAY_CATEGORY_LABEL, SCOUT_CATEGORY_LABEL, SCOUT_PROMPTS, SIGN_RULE, type PlayCategory,
} from "@/lib/playbook";
import { addQuizQuestion, addScoutNote, createQuiz, savePlay, saveScouting } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export type PlayRow = {
  id: string;
  team_id: string | null;
  name: string;
  category: PlayCategory;
  situation: string | null;
  description: string;
  call_sheet: boolean;
};

export function PlayForm({ teamId, teamName, play }: { teamId: string; teamName: string; play?: PlayRow }) {
  const [state, action] = useActionState(savePlay, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="team_id" value={teamId} />
      {play && <input type="hidden" name="id" value={play.id} />}
      <p className="rounded-lg border border-pink/50 bg-pink/10 px-3 py-2 text-xs text-ink sm:col-span-2">{SIGN_RULE}</p>
      <Field label="Call name">
        <input name="name" required maxLength={60} defaultValue={play?.name} placeholder="e.g. Wheel" className={inputClass} />
      </Field>
      <Field label="Kind">
        <select name="category" defaultValue={play?.category ?? "bunt_defense"} className={inputClass}>
          {PLAY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {PLAY_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="When to call it">
          <input name="situation" maxLength={200} defaultValue={play?.situation ?? ""} placeholder="Runner on first, sacrifice bunt likely" className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="What everyone does">
          <textarea name="description" required rows={4} maxLength={1000} defaultValue={play?.description} className={inputClass} />
        </Field>
      </div>
      <Field label="For">
        <select name="scope" defaultValue={play && play.team_id === null ? "all" : "team"} className={inputClass}>
          <option value="team">{teamName}</option>
          <option value="all">All our teams (organization playbook)</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="call_sheet" defaultChecked={play?.call_sheet ?? true} className="size-4 accent-pink" />
        On the call sheet (players drill it)
      </label>
      <div className="flex items-center gap-4 sm:col-span-2">
        <SubmitButton>{play ? "Save play" : "Add play"}</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

export function NewQuizForm({ teamId }: { teamId: string }) {
  const [state, action] = useActionState(createQuiz, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="team_id" value={teamId} />
      <div className="min-w-60 flex-1">
        <Field label="Quiz title">
          <input name="title" required maxLength={80} placeholder="e.g. Bunt defense calls" className={inputClass} />
        </Field>
      </div>
      <SubmitButton pendingLabel="Creating…">Create quiz</SubmitButton>
      <FormMessage error={state.error} fields={state.fields} />
    </form>
  );
}

export function QuizQuestionForm({ quizId, plays }: { quizId: string; plays: { id: string; name: string }[] }) {
  const [state, action] = useActionState(addQuizQuestion.bind(null, quizId), initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Question">
          <input name="question" required maxLength={300} placeholder="We call “Wheel.” Where does the shortstop go?" className={inputClass} />
        </Field>
      </div>
      <Field label="Choices" hint="One per line, 2 to 5">
        <textarea name="choices" required rows={5} className={inputClass} />
      </Field>
      <div className="flex flex-col gap-3">
        <Field label="Right answer">
          <select name="correct" required defaultValue="1" className={inputClass}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Choice {n}
              </option>
            ))}
          </select>
        </Field>
        {plays.length > 0 && (
          <Field label="About the play (optional)">
            <select name="play_id" defaultValue="" className={inputClass}>
              <option value="">None</option>
              {plays.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <div className="sm:col-span-2">
        <Field label="Why (shown after she answers)">
          <input name="explanation" maxLength={500} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <SubmitButton pendingLabel="Adding…">Add question</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

export function ScoutingForm({
  opponents,
  games,
  defaultOpponent,
  today,
}: {
  opponents: { id: string; name: string }[];
  games: { id: string; label: string; opponent: string }[];
  defaultOpponent: string | null;
  today: string;
}) {
  const [state, action] = useActionState(saveScouting, initialFormState);
  const categories = [...new Set(SCOUT_PROMPTS.map((p) => p.category))];
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Opponent">
          <select name="opponent_id" required defaultValue={defaultOpponent ?? ""} className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {opponents.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Game (optional)">
          <select name="game_id" defaultValue="" className={inputClass}>
            <option value="">Not from a game</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Seen on">
          <input type="date" name="observed_on" defaultValue={today} className={inputClass} />
        </Field>
      </div>
      {categories.map((c) => (
        <fieldset key={c} className="flex flex-col gap-3">
          <legend className={sectionLabelClass}>{SCOUT_CATEGORY_LABEL[c]}</legend>
          {SCOUT_PROMPTS.filter((p) => p.category === c).map((p) => (
            <div key={p.key} className="grid gap-2 sm:grid-cols-[1fr_11rem]">
              <Field label={p.title} hint={p.prompt}>
                <textarea name={`a_${p.key}`} rows={2} maxLength={1000} className={inputClass} />
              </Field>
              <Field label="How sure">
                <select name={`c_${p.key}`} defaultValue="" className={inputClass}>
                  <option value="">–</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {CONFIDENCE_LABEL[n]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ))}
        </fieldset>
      ))}
      <div className="flex items-center gap-4">
        <SubmitButton>Save scouting report</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

export function ScoutNoteForm({ opponentId, today }: { opponentId: string; today: string }) {
  const [state, action] = useActionState(addScoutNote, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="opponent_id" value={opponentId} />
      <Field label="Category">
        <select name="category" defaultValue="team_overview" className={inputClass}>
          {(["team_overview", "hitter_tendencies", "pitcher_tendencies", "defense", "baserunning", "coaching_tendencies", "other"] as const).map((c) => (
            <option key={c} value={c}>
              {SCOUT_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title">
        <input name="title" required maxLength={80} className={inputClass} />
      </Field>
      <Field label="Seen on">
        <input type="date" name="observed_on" defaultValue={today} className={inputClass} />
      </Field>
      <div className="sm:col-span-3">
        <Field label="Note">
          <textarea name="body" required rows={3} maxLength={1000} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-4 sm:col-span-3">
        <SubmitButton>Add note</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}
