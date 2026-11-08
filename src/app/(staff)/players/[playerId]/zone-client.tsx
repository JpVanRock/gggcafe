"use client";

// My Zone editor: tap a cell to cycle it (I handle it → my pitch → work on it → clear).
import { useState, useTransition } from "react";
import { FormMessage, buttonClass, inputClass } from "@/components/ui";
import { ZoneGrid } from "@/components/zone-grid";
import { ZONE_LABEL, ZONE_NOTES_MAX, cycle, type HittingZones } from "@/lib/my-zone";
import { saveHittingZones } from "./zone-actions";

export function ZoneEditor({ playerId, zones }: { playerId: string; zones: HittingZones | null }) {
  const [draft, setDraft] = useState<HittingZones>(zones ?? { hot: [], strong: [], weak: [] });
  const [notes, setNotes] = useState(zones?.notes ?? "");
  const [message, setMessage] = useState<{ error: string | null; saved?: boolean }>({ error: null });
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-start gap-6">
      <ZoneGrid zones={draft} size={210} onCell={(cell) => setDraft((z) => cycle(z, cell))} />
      <div className="flex min-w-56 flex-1 flex-col gap-3 text-sm">
        <p className="text-muted">Tap a square to cycle it. Catcher&apos;s view: the top row is up in the zone.</p>
        <ul className="flex flex-col gap-1.5">
          {(Object.keys(ZONE_LABEL) as (keyof typeof ZONE_LABEL)[]).map((k) => (
            <li key={k}>
              <span className="font-semibold">{ZONE_LABEL[k].name}</span> <span className="text-muted">· {ZONE_LABEL[k].note}</span>
            </li>
          ))}
        </ul>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={ZONE_NOTES_MAX} placeholder="A note (optional): e.g. I chase the rise ball up" aria-label="Note" className={inputClass} />
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await saveHittingZones({ playerId, ...draft, notes });
                setMessage(res.error ? { error: res.error } : { error: null, saved: true });
              })
            }
            className={buttonClass}
          >
            {pending ? "Saving…" : "Save My Zone"}
          </button>
          <FormMessage error={message.error} saved={message.saved} />
        </div>
      </div>
    </div>
  );
}
