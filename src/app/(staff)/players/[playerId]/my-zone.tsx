// My Zone (Phase 3) in her Pop Report, next to her Preferred Hitting Style: her
// zones on the 1-9 grid and the count plan they give (0, 1, 2 strikes).
import { Disclosure } from "@/components/ui";
import { ZoneGrid } from "@/components/zone-grid";
import { countPlan, type HittingZones } from "@/lib/my-zone";
import { DetailHeading } from "./menu";
import { ZoneEditor } from "./zone-client";

/** Her count plan as three small grids. Used here and in the G3 Hitting Approach chapter. */
export function CountPlan({ zones }: { zones: HittingZones | null }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-3">
      {countPlan(zones).map((step) => (
        <li key={step.strikes} className="flex flex-col items-start gap-2 rounded-xl border border-navy-700 p-3">
          <p className="font-display text-lg font-bold tracking-wide uppercase">{step.title}</p>
          <ZoneGrid zones={zones} only={step.swing} battle={step.battle} size={110} labels={false} />
          <p className="text-xs text-muted">{step.cue}</p>
        </li>
      ))}
    </ol>
  );
}

export function MyZoneSection({ playerId, zones, canAct }: { playerId: string; zones: HittingZones | null; canAct: boolean }) {
  const marked = Boolean(zones && zones.hot.length + zones.strong.length + zones.weak.length);
  return (
    <section className="flex flex-col gap-4">
      <DetailHeading>My Zone</DetailHeading>
      {marked ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start gap-5">
            <ZoneGrid zones={zones} size={170} />
            {zones?.notes && <p className="max-w-sm text-sm whitespace-pre-wrap text-ink/90">{zones.notes}</p>}
          </div>
          <div>
            <p className="mb-2 font-mono text-[11px] tracking-widest text-pink-soft uppercase">Her count plan</p>
            <CountPlan zones={zones} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Not marked yet. Mark her pitch, what she handles and her weak spots, and her count plan builds itself.</p>
      )}
      {canAct && (
        <Disclosure summary={marked ? "Edit My Zone" : "Mark My Zone"} open={!marked}>
          <ZoneEditor playerId={playerId} zones={zones} />
        </Disclosure>
      )}
    </section>
  );
}
