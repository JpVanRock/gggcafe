"use client";

import { useActionState, useState } from "react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { DrillTags } from "@/components/drill-tags";
import { Disclosure, EmptyState, Field, FormMessage, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { DRILL_TAGS, DRILL_TAG_LABEL, filterDrills, type DrillTag, type LibraryDrill } from "@/lib/dugout";
import { initialFormState } from "@/lib/form";
import { deleteDrill, saveDrill } from "./actions";
import { ActionForm } from "@/components/action-form";

/** Tag filter pills: "All" plus every tag, with counts. Shared with the plan builder. */
export function TagFilter({
  drills,
  value,
  onChange,
}: {
  drills: LibraryDrill[];
  value: DrillTag | "all";
  onChange: (tag: DrillTag | "all") => void;
}) {
  const options: (DrillTag | "all")[] = ["all", ...DRILL_TAGS];
  return (
    <div role="radiogroup" aria-label="Filter by tag" className="flex flex-wrap gap-1.5">
      {options.map((tag) => {
        const count = tag === "all" ? drills.length : drills.filter((d) => d.tags.includes(tag)).length;
        const on = value === tag;
        return (
          <button
            key={tag}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(tag)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              on ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
            }`}
          >
            {tag === "all" ? "All" : DRILL_TAG_LABEL[tag]} <span className="tabular-nums opacity-70">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function DrillForm({ drill, onDone }: { drill?: LibraryDrill; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (prev: typeof initialFormState, fd: FormData) => {
    const result = await saveDrill(prev, fd);
    if (result.saved && onDone) onDone();
    return result;
  }, initialFormState);

  return (
    <form action={action} className="grid gap-4">
      {drill && <input type="hidden" name="id" value={drill.id} />}
      <Field label="Drill name">
        <input name="name" required maxLength={120} defaultValue={drill?.name ?? ""} placeholder="Five-ball relay" className={inputClass} />
      </Field>
      <Field label="Description" hint="Setup, how it runs, and the coaching points">
        <textarea
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={drill?.description ?? ""}
          placeholder="Outfield to cutoff to base. Hit the cut chest-high…"
          className={inputClass}
        />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Tags</legend>
        <div className="flex flex-wrap gap-2">
          {DRILL_TAGS.map((tag) => (
            <label
              key={tag}
              className="cursor-pointer rounded-full border border-navy-600 px-3 py-1 text-sm text-muted transition select-none hover:border-pink has-checked:border-pink has-checked:bg-pink has-checked:text-on-accent has-focus-visible:ring-2 has-focus-visible:ring-pink/40"
            >
              <input type="checkbox" name="tags" value={tag} defaultChecked={drill?.tags.includes(tag)} className="sr-only" />
              {DRILL_TAG_LABEL[tag]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Usual equipment (optional)" hint="Copied into a plan when the drill is added; separate items with commas">
        <input name="equipment" maxLength={500} defaultValue={drill?.equipment ?? ""} placeholder="Cones, bucket of balls" className={inputClass} />
      </Field>
      <Field label="Video link (optional)" hint="A video of the drill being run: YouTube, Hudl, Google Drive…">
        <input name="video_url" type="url" maxLength={500} defaultValue={drill?.video_url ?? ""} placeholder="https://" className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : drill ? "Save drill" : "Add to library"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className={secondaryButtonClass}>
            Cancel
          </button>
        )}
        <FormMessage error={state.error} saved={state.saved && !drill} />
      </div>
    </form>
  );
}

function DrillCard({ drill, canEdit }: { drill: LibraryDrill; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="rounded-xl border border-pink/60 bg-navy-900 p-4 md:col-span-2">
        <DrillForm drill={drill} onDone={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className="flex flex-col rounded-xl border border-navy-700 bg-navy-900/70 p-4">
      <p className="text-lg leading-snug font-semibold text-ink">{drill.name}</p>
      <DrillTags tags={drill.tags} className="mt-1.5" />
      {drill.description && <p className="mt-3 text-sm whitespace-pre-line text-muted">{drill.description}</p>}
      {drill.video_url && (
        <a
          href={drill.video_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full border border-pink px-3 py-1 text-xs font-semibold text-ink transition hover:bg-pink hover:text-on-accent"
        >
          ▶ Watch the drill
        </a>
      )}
      {drill.equipment && (
        <p className="mt-3 text-sm">
          <span className="font-mono text-[10px] font-bold tracking-wider text-pink-soft uppercase">Equipment </span>
          {drill.equipment}
        </p>
      )}
      {canEdit && (
        <div className="mt-auto flex items-center gap-2 pt-4">
          <button type="button" onClick={() => setEditing(true)} className={secondaryButtonClass}>
            Edit
          </button>
          <ActionForm action={deleteDrill} className="ml-auto">
            <input type="hidden" name="id" value={drill.id} />
            <ConfirmSubmit
              message={`Delete “${drill.name}” from the library? Practice plans that use it keep their copy.`}
              className="text-xs text-danger hover:underline"
            >
              Delete
            </ConfirmSubmit>
          </ActionForm>
        </div>
      )}
    </li>
  );
}

/** The shared drill library: search, tag filter, add/edit/delete. */
export function DrillLibrary({ drills, canEdit }: { drills: LibraryDrill[]; canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<DrillTag | "all">("all");
  const shown = filterDrills(drills, search, tag);

  return (
    <div className="flex flex-col gap-6">
      {canEdit && (
        <Disclosure summary="Add a drill" open={drills.length === 0}>
          <DrillForm />
        </Disclosure>
      )}

      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search drills"
          aria-label="Search drills"
          className={`${inputClass} max-w-md`}
        />
        <TagFilter drills={drills} value={tag} onChange={setTag} />
      </div>

      {drills.length === 0 ? (
        <EmptyState>The library is empty. Add the drills your team runs, then drag them into practice plans.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>No drills match.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((d) => (
            <DrillCard key={d.id} drill={d} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </div>
  );
}
