"use client";

// "Repeats" for a new team event (Dugout Calendar and the team page): one time, every day, every
// week or every 2 weeks on chosen days, or every month, through an end date. A live line says what
// the save will add. The rules (and the server's check) are in src/lib/recurrence.ts.
import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { DAY_SHORT, REPEATS, REPEAT_LABEL, repeatSummary, weekdayOf, type Repeat } from "@/lib/recurrence";

const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** `first` is the event's date as the form has it right now (YYYY-MM-DD, or "" while blank). */
export function RepeatFields({ first, className = "" }: { first: string; className?: string }) {
  const [repeat, setRepeat] = useState<Repeat>("none");
  // the days a weekly event falls on; until the coach picks, it follows the first date's weekday
  const [picked, setPicked] = useState<number[] | null>(null);
  const [until, setUntil] = useState("");
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(first);
  const days = picked ?? (valid ? [weekdayOf(first)] : []);
  const weekly = repeat === "weekly" || repeat === "biweekly";
  const toggle = (d: number, on: boolean) => setPicked(on ? [...days, d].sort() : days.filter((x) => x !== d));

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>
      <Field label="Repeats">
        <select name="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)} className={inputClass}>
          {REPEATS.map((r) => (
            <option key={r} value={r}>
              {REPEAT_LABEL[r]}
            </option>
          ))}
        </select>
      </Field>
      {repeat !== "none" && (
        <Field label="Ends on" required>
          <input
            type="date"
            name="repeat_until"
            required
            min={valid ? first : undefined}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className={inputClass}
          />
        </Field>
      )}
      {weekly && (
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">On</legend>
          <div className="flex flex-wrap gap-1.5">
            {DAY_SHORT.map((label, d) => (
              <label
                key={label}
                className="cursor-pointer rounded-full border border-navy-600 px-3 py-1 text-xs font-semibold text-muted transition select-none hover:border-pink has-checked:border-pink has-checked:bg-pink has-checked:text-on-accent has-focus-visible:ring-2 has-focus-visible:ring-pink/40"
              >
                <input
                  type="checkbox"
                  name="repeat_days"
                  value={d}
                  checked={days.includes(d)}
                  onChange={(e) => toggle(d, e.target.checked)}
                  aria-label={DAY_LONG[d]}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {repeat !== "none" && valid && until && (
        <p className="text-sm text-highlight sm:col-span-2" aria-live="polite">
          {repeatSummary(first, { repeat, days, until })}
        </p>
      )}
    </div>
  );
}
