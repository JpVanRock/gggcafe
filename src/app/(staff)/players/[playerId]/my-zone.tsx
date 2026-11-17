// My Zone (Phase 3) in her Pop Report, next to her Preferred Hitting Style: her zones on the 1-9 grid
// (the Testing Result and her Player Choice, user 2026-11-16) and the count plan they give (0, 1, 2 strikes).
import { Disclosure, eyebrowClass } from "@/components/ui";
import { ZoneGrid } from "@/components/zone-grid";
import { ZONE_SOURCES, ZONE_SOURCE_LABEL, countPlan, isMarked, planSource, type HittingZones, type ZonesBySource } from "@/lib/my-zone";
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

/**
 * My Zone (user, 2026-11-16): the Testing Result a coach marks from hitting testing and her own Player
 * Choice, side by side; her count plan follows the testing result when there is one.
 */
export function MyZoneSection({
  playerId,
  zones,
  canManage,
  canAct,
}: {
  playerId: string;
  zones: ZonesBySource;
  /** coaches: mark the testing result */
  canManage: boolean;
  /** she or a coach: mark her player choice */
  canAct: boolean;
}) {
  const planFrom = planSource(zones);
  return (
    <section className="flex flex-col gap-4">
      <DetailHeading>My Zone</DetailHeading>
      <div className="grid gap-6 md:grid-cols-2">
        {ZONE_SOURCES.map((source) => {
          const z = zones[source];
          const marked = isMarked(z);
          const testing = source === "testing";
          const canWrite = testing ? canManage : canAct;
          return (
            <div key={source} className="flex min-w-0 flex-col gap-3">
              <p className={eyebrowClass}>{ZONE_SOURCE_LABEL[source]}</p>
              {marked ? (
                <div className="flex flex-wrap items-start gap-4">
                  <ZoneGrid zones={z} size={170} />
                  {z?.notes && <p className="max-w-56 text-sm whitespace-pre-wrap text-ink/90">{z.notes}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {testing ? "Not tested yet. Your coach marks it from your hitting testing." : "Not marked yet. Mark your pitch, what you handle and your weak spots."}
                </p>
              )}
              {canWrite && (
                <Disclosure summary={testing ? (marked ? "Edit the testing result" : "Mark the testing result") : marked ? "Edit my choice" : "Mark my choice"}>
                  <ZoneEditor playerId={playerId} source={source} zones={z} />
                </Disclosure>
              )}
            </div>
          );
        })}
      </div>
      {planFrom && (
        <div>
          <p className={`${eyebrowClass} mb-2`}>Her count plan · from the {ZONE_SOURCE_LABEL[planFrom].toLowerCase()}</p>
          <CountPlan zones={zones[planFrom]} />
        </div>
      )}
    </section>
  );
}
