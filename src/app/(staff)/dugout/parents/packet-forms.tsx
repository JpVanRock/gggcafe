"use client";

// The parent welcome packet (Phase 6): add or edit an item.
import { useActionState } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { PACKET_KINDS, PACKET_KIND_LABEL, type PacketKind } from "@/lib/family";
import { savePacketItem } from "./actions";

export function PacketItemForm({ teamId, item }: { teamId: string; item?: { id: string; kind: PacketKind; title: string; body: string } }) {
  const [state, action, pending] = useActionState(savePacketItem, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="team_id" value={teamId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label="Kind">
        <select name="kind" defaultValue={item?.kind ?? "letter"} className={inputClass}>
          {PACKET_KINDS.map((k) => (
            <option key={k} value={k}>
              {PACKET_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Title">
          <input name="title" required maxLength={100} defaultValue={item?.title} placeholder="Welcome to the season" className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-3">
        <Field label="Text">
          <textarea name="body" required rows={6} maxLength={3000} defaultValue={item?.body} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-4 sm:col-span-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : item ? "Save" : "Add to the packet"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
