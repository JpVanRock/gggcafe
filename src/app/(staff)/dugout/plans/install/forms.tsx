"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { INSTALL_CATEGORIES, INSTALL_CATEGORY_LABEL, type InstallCategory } from "@/lib/install";
import { addInstallItem } from "./actions";

const POSITION_GROUPS = ["P", "C", "1B", "2B", "SS", "3B", "OF"];

/** Add one item to the team's install checklist. */
export function AddInstallItemForm({ teamId, situationGroups }: { teamId: string; situationGroups: string[] }) {
  const [state, action, pending] = useActionState(addInstallItem, initialFormState);
  const [category, setCategory] = useState<InstallCategory>("situation");
  const groups = category === "position" ? POSITION_GROUPS : situationGroups;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[10rem_12rem_1fr]">
      <input type="hidden" name="team_id" value={teamId} />
      <Field label="Kind">
        <select name="category" value={category} onChange={(e) => setCategory(e.target.value as InstallCategory)} className={inputClass}>
          {INSTALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {INSTALL_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={category === "position" ? "Position" : "Situation"}>
        <input name="group" required maxLength={40} list={`install-groups-${category}`} className={inputClass} key={category} />
        <datalist id={`install-groups-${category}`}>
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </Field>
      <Field label="What to install">
        <input name="title" required maxLength={140} placeholder="e.g. Covering first on bunts" className={inputClass} />
      </Field>
      <div className="flex items-center gap-4 sm:col-span-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Adding…" : "Add to the checklist"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
