// A mentor's work with the coaches, shown the same way to the mentor, the coaches and her
// parents: the focus board ("Working on" / "What's working") and the notes thread
// (discussion summaries, notes and coaches' replies). Forms take the action to call, so the
// mentor's pages and the Coaches Dugout share them.
import type { ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Field, buttonStyles, fieldClass, inputClass } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import type { FormState } from "@/lib/form";
import { FOCUS_LABEL, FOCUS_STATUSES, NOTE_KIND_LABEL, NOTE_MAX, type FocusStatus, type NoteKind } from "@/lib/mentors";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export type FocusItem = { id: string; title: string; details: string | null; status: string; updated_at: string; mentor_name?: string };
export type MentorNote = {
  id: string;
  kind: string;
  discussed_on: string | null;
  body: string;
  author_id: string | null;
  author_name: string;
  author_role: string;
  created_at: string;
};

const label = "font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

/** Hidden inputs for a form. */
function Hidden({ values }: { values: Record<string, string> }) {
  return Object.entries(values).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);
}

/** Working on / What's working, side by side (stacked on phones). */
export function FocusBoard({ items, controls, empty }: { items: FocusItem[]; controls?: (item: FocusItem) => ReactNode; empty?: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty ?? "No focus areas yet."}</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FOCUS_STATUSES.map((status) => {
        const list = items.filter((i) => i.status === status);
        return (
          <section
            key={status}
            aria-label={FOCUS_LABEL[status]}
            className={`rounded-xl border p-3 ${status === "working" ? "border-neon/50 bg-neon/5" : "border-pink/50 bg-pink/5"}`}
          >
            <h4 className={label}>
              {FOCUS_LABEL[status]} <span className="text-muted">· {list.length}</span>
            </h4>
            {list.length === 0 ? (
              <p className="mt-2 text-xs text-muted">{status === "working" ? "Nothing moved here yet." : "Nothing in progress."}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {list.map((item) => (
                  <li key={item.id} className="rounded-lg border border-navy-700 bg-navy-950/40 p-2.5">
                    <p className="text-sm font-semibold">{item.title}</p>
                    {item.details && <p className="mt-0.5 text-xs whitespace-pre-wrap text-muted">{item.details}</p>}
                    <p className="mt-1 font-mono text-2xs tracking-wider text-muted uppercase">
                      {[item.mentor_name, `Updated ${formatDay(item.updated_at.slice(0, 10))}`].filter(Boolean).join(" · ")}
                    </p>
                    {controls && <div className="mt-2 flex flex-wrap items-center gap-2">{controls(item)}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

const ROLE: Record<string, string> = { mentor: "Mentor", coach: "Coach", admin: "Admin" };

/** The notes, oldest first, like a conversation. */
export function NotesThread({ notes, controls, empty }: { notes: MentorNote[]; controls?: (note: MentorNote) => ReactNode; empty?: string }) {
  if (notes.length === 0) return <p className="text-sm text-muted">{empty ?? "No notes yet."}</p>;
  return (
    <ol className="flex flex-col gap-2">
      {notes.map((n) => (
        <li
          key={n.id}
          className={`rounded-xl border p-3 ${n.author_role === "mentor" ? "border-navy-700 bg-navy-950/40" : "border-pink/40 bg-pink/5 sm:ml-8"}`}
        >
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-semibold">{n.author_name}</span>
            <Badge tone={n.author_role === "mentor" ? "neutral" : "pink"}>{ROLE[n.author_role] ?? n.author_role}</Badge>
            {n.kind === "summary" && <Badge tone="neonOutline">{NOTE_KIND_LABEL.summary}</Badge>}
            <span className="font-mono text-2xs tracking-wider text-muted uppercase">
              {n.kind === "summary" && n.discussed_on ? `Talked ${formatDay(n.discussed_on)} · ` : ""}
              {formatDay(n.created_at.slice(0, 10))}
            </span>
          </p>
          <p className="mt-1.5 text-sm whitespace-pre-wrap">{n.body}</p>
          {controls && <div className="mt-2">{controls(n)}</div>}
        </li>
      ))}
    </ol>
  );
}

/** A mentor's note form: a discussion summary (with the day) or a note. */
export function NoteForm({ action, hidden, kinds = ["summary", "note"], placeholder }: { action: Action; hidden: Record<string, string>; kinds?: NoteKind[]; placeholder?: string }) {
  return (
    <ActionForm action={action} className="flex flex-col gap-3 rounded-xl border border-navy-700 p-3">
      <Hidden values={hidden} />
      {kinds.length > 1 ? (
        <div className="flex flex-wrap items-start gap-3">
          <Field label="Kind">
            <select name="kind" defaultValue={kinds[0]} className={`${fieldClass} w-64`}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {NOTE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Day you talked" hint="For a discussion summary">
            <input type="date" name="discussed_on" className={`${fieldClass} w-44`} />
          </Field>
        </div>
      ) : (
        <input type="hidden" name="kind" value={kinds[0]} />
      )}
      <Field label={kinds.length > 1 ? "What you talked about, what's working, what's next" : "Reply"}>
        <textarea name="body" rows={3} maxLength={NOTE_MAX} required placeholder={placeholder} className={inputClass} />
      </Field>
      <div>
        <SubmitButton pendingLabel="Adding…">{kinds.length > 1 ? "Add note" : "Send reply"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** A mentor adds an area of focus. */
export function FocusForm({ action, hidden }: { action: Action; hidden: Record<string, string> }) {
  return (
    <ActionForm action={action} className="grid gap-3 rounded-xl border border-navy-700 p-3 sm:grid-cols-6">
      <Hidden values={hidden} />
      <div className="sm:col-span-3">
        <Field label="Focus">
          <input name="title" maxLength={120} required placeholder="Drive the drop ball down" className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-3">
        <Field label="Where it is">
          <select name="status" defaultValue="working_on" className={inputClass}>
            {FOCUS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {FOCUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-6">
        <Field label="How you're working on it (optional)">
          <textarea name="details" rows={2} maxLength={500} placeholder="Towel drill, then 15 drops to a target each pen." className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-6">
        <SubmitButton pendingLabel="Adding…">Add focus</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Move a focus area to the other column, or remove it (the mentor's own). */
export function FocusControls({ item, move, remove }: { item: FocusItem; move: Action; remove: Action }) {
  const next: FocusStatus = item.status === "working" ? "working_on" : "working";
  return (
    <>
      <ActionForm action={move} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="focus_id" value={item.id} />
        <input type="hidden" name="status" value={next} />
        <SubmitButton variant="secondary" pendingLabel="Moving…">
          {next === "working" ? "It's working →" : "← Back to working on"}
        </SubmitButton>
      </ActionForm>
      <ActionForm action={remove} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="focus_id" value={item.id} />
        <ConfirmSubmit message={`Remove "${item.title}"?`} confirmLabel="Remove" tone="danger" className={buttonStyles("link", "text-muted")}>
          Remove
        </ConfirmSubmit>
      </ActionForm>
    </>
  );
}

/** Remove a note you wrote. */
export function RemoveNote({ id, action }: { id: string; action: Action }) {
  return (
    <ActionForm action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="note_id" value={id} />
      <ConfirmSubmit message="Remove this note?" confirmLabel="Remove" tone="danger" className={buttonStyles("link", "text-muted")}>
        Remove
      </ConfirmSubmit>
    </ActionForm>
  );
}
