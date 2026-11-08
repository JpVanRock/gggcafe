// The mental-game tools on her Mental GP page (Standard, Phase 1): My signals,
// intensity checks, the monthly self-scan, guided sessions and the practice
// journal. Server component; the forms are in mental-game-client.tsx.
import Link from "next/link";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Disclosure } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import {
  CONTEXT_LABEL, DEFAULT_ZONE, GUIDED_SESSIONS, SCAN_LABELS, SCAN_SKILLS, SIGNALS, monthStart, scanAverage, scanChange, scanExtremes, zoneStatus,
} from "@/lib/mental";
import { removeIntensityCheck } from "./mental-actions";
import { IntensityForm, ScanForm, SignalsForm } from "./mental-game-client";
import type { IntensityCheck, MentalScan } from "./mental-data";
import type { MentalPlan } from "./shared";
import { DetailHeading } from "./menu";

// Cards stay in brand colors; only the small signal light uses traffic colors (red is the brand pink).
const DOT: Record<"green" | "yellow" | "red", string> = { green: "bg-[#2bd576]", yellow: "bg-[#ffc93c]", red: "bg-pink" };
const monthName = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" });

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-navy-700 pt-8">
      <div>
        <DetailHeading>{title}</DetailHeading>
        {note && <p className="-mt-1 text-sm text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function MentalTools({
  playerId,
  plan,
  checks,
  scans,
  guides,
  today,
  canEdit,
}: {
  playerId: string;
  plan: MentalPlan | null;
  checks: IntensityCheck[];
  scans: MentalScan[];
  guides: string[];
  today: string;
  canEdit: boolean;
}) {
  const zone = { low: plan?.zone_low ?? null, high: plan?.zone_high ?? null };
  const hasSignals = SIGNALS.some((s) => plan?.[s.signs] || (s.release && plan?.[s.release]));
  const thisMonth = scans.find((s) => s.month === monthStart(today)) ?? null;
  const latest = scans[0] ?? null;
  const previous = scans[1] ?? null;
  const base = `/players/${playerId}/mental`;

  return (
    <div className="flex flex-col gap-10">
      {/* My signals ------------------------------------------------------------ */}
      <Section title="My signals" note="Green, yellow, red: catch yellow early and use your release before it gets to red.">
        {hasSignals ? (
          <div className="grid gap-3 md:grid-cols-3">
            {SIGNALS.map((s) => (
              <div key={s.light} className="rounded-2xl border border-navy-600 bg-navy-900/60 p-4">
                <p className="flex items-center gap-2 font-display text-lg font-bold tracking-wide uppercase">
                  <span aria-hidden className={`size-3 rounded-full shadow-[0_0_8px_currentColor] ${DOT[s.light]}`} />
                  {s.label}
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap text-ink/90">{plan?.[s.signs] || <span className="text-muted">Not filled in yet.</span>}</p>
                {s.release && plan?.[s.release] && (
                  <p className="mt-3 text-sm">
                    <span className="font-mono text-[11px] font-bold tracking-widest text-pink-soft uppercase">Release · </span>
                    <span className="whitespace-pre-wrap">{plan[s.release]}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No signals yet.{canEdit && " Fill them in below."}</p>
        )}
        <p className="text-sm">
          <span className="text-muted">My zone: </span>
          <span className="font-display font-bold text-highlight tabular-nums">
            {zone.low && zone.high ? `${zone.low}–${zone.high}` : `not set (using ${DEFAULT_ZONE.low}–${DEFAULT_ZONE.high})`}
          </span>
        </p>
        {canEdit && (
          <Disclosure summary="Edit my signals" open={!hasSignals}>
            <SignalsForm playerId={playerId} plan={plan} />
          </Disclosure>
        )}
      </Section>

      {/* Intensity -------------------------------------------------------------- */}
      <Section title="Intensity check" note="Before games and practices: rate yourself 1 to 10 and compare it with your zone.">
        {canEdit && <IntensityForm playerId={playerId} zone={zone} />}
        {checks.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="relative flex h-28 items-end gap-1.5 rounded-xl border border-navy-700 bg-navy-950/40 px-3 pt-3 pb-2" aria-hidden>
              {/* her zone as a band */}
              <span
                className="absolute inset-x-0 border-y border-dashed border-neon/40 bg-neon/5"
                style={{ bottom: `${((zone.low ?? DEFAULT_ZONE.low) - 1) * 10 + 8}%`, height: `${((zone.high ?? DEFAULT_ZONE.high) - (zone.low ?? DEFAULT_ZONE.low) + 1) * 9}%` }}
              />
              {[...checks].reverse().map((c) => {
                const status = zoneStatus(c.level, zone);
                return (
                  <span
                    key={c.id}
                    className={`relative w-full max-w-8 rounded-t ${status === "in" ? "bg-neon" : status === "over" ? "bg-pink" : "bg-navy-600"}`}
                    style={{ height: `${c.level * 9}%` }}
                  />
                );
              })}
            </div>
            <ul className="divide-y divide-navy-800 text-sm">
              {checks.slice(0, 6).map((c) => {
                const status = zoneStatus(c.level, zone);
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="w-28 text-muted">{formatDay(c.checked_on)}</span>
                    <span className="font-display text-lg font-bold text-highlight tabular-nums">{c.level}</span>
                    <span className="text-xs text-muted">
                      {CONTEXT_LABEL[c.context]} · {status === "in" ? "in her zone" : status === "over" ? "over" : "under"}
                    </span>
                    {c.adjustment && <span className="text-ink/90">{c.adjustment}</span>}
                    {canEdit && (
                      <form action={removeIntensityCheck} className="ml-auto">
                        <input type="hidden" name="player_id" value={playerId} />
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmSubmit message="Remove this check?" className="text-xs text-muted hover:text-danger">
                          Remove
                        </ConfirmSubmit>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted">No checks yet.</p>
        )}
      </Section>

      {/* Self-scan ---------------------------------------------------------------- */}
      <Section title="Monthly self-scan" note="Once a month, one honest score per skill. Watch the trend, not one month.">
        {latest && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {SCAN_SKILLS.map((skill, i) => {
                const change = scanChange(previous?.scores ?? null, latest.scores)[i];
                return (
                  <li key={skill.key} className="flex items-center justify-between gap-3 text-sm">
                    <span>{skill.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="flex gap-0.5" aria-label={`${latest.scores[i]} of 5: ${SCAN_LABELS[latest.scores[i] - 1]}`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={`h-2 w-4 rounded-sm ${n <= latest.scores[i] ? "bg-neon" : "bg-navy-700"}`} />
                        ))}
                      </span>
                      <span className={`w-6 text-right font-mono text-xs ${change && change > 0 ? "text-highlight" : change && change < 0 ? "text-pink-soft" : "text-muted"}`}>
                        {change ? (change > 0 ? `+${change}` : change) : ""}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-col gap-3">
              <div className="flex h-24 items-end gap-2" aria-label="Average by month">
                {[...scans].reverse().map((s) => (
                  <span key={s.month} className="flex flex-1 flex-col items-center gap-1">
                    <span className="font-mono text-[10px] text-muted tabular-nums">{scanAverage(s.scores)}</span>
                    <span className="w-full rounded-t bg-linear-to-t from-pink to-neon" style={{ height: `${scanAverage(s.scores) * 12}px` }} />
                    <span className="font-mono text-[10px] text-muted uppercase">{monthName.format(new Date(`${s.month}T00:00:00Z`))}</span>
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted">
                <span className="text-highlight">Strongest:</span> {scanExtremes(latest.scores).strongest.map((s) => s.name).join(", ")}
                <br />
                <span className="text-pink-soft">Work on:</span> {scanExtremes(latest.scores).workOn.map((s) => s.name).join(", ")}
              </p>
            </div>
          </div>
        )}
        {latest?.note && <p className="text-sm text-ink/90">“{latest.note}”</p>}
        {canEdit && (
          <Disclosure summary={thisMonth ? "Update this month's scan" : "Take this month's scan"} open={!thisMonth}>
            <ScanForm playerId={playerId} current={thisMonth} />
          </Disclosure>
        )}
        {!latest && !canEdit && <p className="text-sm text-muted">No self-scans yet.</p>}
      </Section>

      {/* Guided sessions ------------------------------------------------------------ */}
      <Section title="Guided sessions" note="Breathing and imagery, a few minutes each. Make one a routine and it shows up in TWIS.">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDED_SESSIONS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`${base}/session/${s.slug}`}
                className="flex h-full flex-col gap-1.5 rounded-2xl border border-navy-600 bg-navy-900/70 p-4 transition hover:border-pink hover:bg-navy-800"
              >
                <span className="flex items-center justify-between gap-2 font-mono text-[11px] tracking-widest text-pink-soft uppercase">
                  <span>
                    {s.kind === "breathing" ? "Breathing" : "Imagery"} · {s.minutes} min
                  </span>
                  {guides.includes(s.slug) && <span className="rounded bg-neon px-1.5 py-px font-bold text-on-accent">Routine</span>}
                </span>
                <span className="font-display text-xl font-bold tracking-wide text-highlight uppercase">{s.title}</span>
                <span className="text-sm text-muted">{s.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
        {canEdit && (
          <p className="text-sm text-muted">
            To make one a routine, add a mental routine in{" "}
            <Link href={`/players/${playerId}/training`} className="text-pink hover:underline">
              Performance Training
            </Link>
            .
          </p>
        )}
      </Section>

      {/* Journal ---------------------------------------------------------------------- */}
      <Section title="Practice journal" note="A purpose before practice; what worked and what to fix after; a look back at the week.">
        <Link href={`${base}/journal`} className="self-start rounded-full border border-pink px-4 py-1.5 text-sm font-semibold text-pink-soft transition hover:bg-pink hover:text-on-accent">
          Open this week&apos;s journal →
        </Link>
      </Section>
    </div>
  );
}
