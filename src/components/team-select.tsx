"use client";

// A team dropdown (user, 2026-11-14: the admin's Switchboard, "so it is easy to identify what team
// the admin is adjusting"): picking a team opens the page for it (`?team=`). It's a plain GET form
// underneath, so without scripts the Go button does the same.
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Field, fieldClass } from "@/components/ui";

export type TeamOption = { id: string; label: string };

export function TeamSelect({ teams, current, basePath, label = "Team", hint }: { teams: TeamOption[]; current: string; basePath: string; label?: string; hint?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    // keyed by the team, so going Back shows the right one picked again
    <form key={current} method="get" action={basePath} className="flex w-full min-w-0 items-end gap-2 sm:w-auto" aria-busy={pending}>
      <div className="min-w-0 flex-1 sm:w-96 sm:flex-none">
        <Field label={label} hint={pending ? "Opening…" : hint}>
          <select
            name="team"
            defaultValue={current}
            onChange={(e) => {
              const id = e.target.value;
              startTransition(() => router.push(`${basePath}?team=${encodeURIComponent(id)}`));
            }}
            className={`${fieldClass} w-full min-w-0`}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <noscript>
        <button type="submit" className="rounded-md border border-navy-600 px-3 py-2 text-sm font-semibold">
          Go
        </button>
      </noscript>
    </form>
  );
}
