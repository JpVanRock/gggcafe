import { Disclosure, EmptyState } from "@/components/ui";
import { MoveDial } from "@/components/move-dial";
import { SpeedStripes } from "@/components/athletic";
import { FOCUS_TIP, HITTING, MOVEMENT, changes, choiceOf, moveDial, type Category, type Values } from "@/lib/movement";
import { saveHittingStyle, saveMovement } from "./actions";
import type { StyleVersion } from "./data";
import { DetailHeading } from "./menu";
import { StyleForm } from "./movement-client";

const stamp = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Every saved version with what changed, newest first. */
function History({ categories, versions }: { categories: Category[]; versions: StyleVersion[] }) {
  if (versions.length === 0) return null;
  return (
    <Disclosure summary={`History (${versions.length} save${versions.length === 1 ? "" : "s"})`}>
      <ol className="flex flex-col gap-3">
        {versions.map((v, i) => {
          const lines = changes(categories, versions[i + 1]?.values ?? null, v.values);
          return (
            <li key={v.id} className="border-l-2 border-navy-600 pl-3 text-sm">
              <p className="font-mono text-[0.75rem] leading-4 tracking-wider text-pink-soft uppercase">
                {stamp.format(new Date(v.recorded_at))} · {v.by}
              </p>
              {lines.length ? (
                <ul className="mt-1 text-ink/90">
                  {lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted">No changes</p>
              )}
            </li>
          );
        })}
      </ol>
    </Disclosure>
  );
}

function Cards({ categories, values }: { categories: Category[]; values: Values }) {
  const set = categories.filter((c) => values[c.key]);
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {set.map((c) => {
        const o = choiceOf(categories, c.key, values[c.key])!;
        return (
          <li key={c.key} className="rounded-xl border border-navy-700 bg-navy-950/40 p-3">
            <p className="font-mono text-[0.75rem] leading-4 font-bold tracking-[0.15em] text-pink-soft uppercase">{c.title}</p>
            <p className="mt-1 text-lg leading-snug font-semibold text-highlight">{o.label}</p>
            {o.about && <p className="mt-1 text-sm text-muted">{o.about}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export function MovementSection({ playerId, versions, canManage }: { playerId: string; versions: StyleVersion[]; canManage: boolean }) {
  const current = versions[0]?.values ?? {};
  const dial = moveDial(current);
  const focus = current.breathing ? FOCUS_TIP[current.breathing] : null;
  const hasAny = Object.values(current).some(Boolean);

  return (
    <section className="flex flex-col gap-5">
      <div>
        <DetailHeading>Movement Preferences</DetailHeading>
        <p className="-mt-1 text-sm text-muted">
          Every great athlete moves a little differently. This is how your body likes to move, so you can play your best your way.
        </p>
      </div>
      {hasAny ? (
        <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
          <figure className="flex flex-col items-center gap-2">
            <MoveDial dial={dial} size={220} />
            <figcaption className="max-w-56 text-center text-xs text-muted">
              <span className="font-semibold text-highlight">1</span> is where your feet are strongest. Load from your 1.{" "}
              <span className="font-semibold">4</span> is your least natural spot.
            </figcaption>
          </figure>
          <div className="flex flex-col gap-4">
            {focus && (
              <div className="flex gap-3 rounded-xl border border-navy-700 bg-navy-950/40 p-3">
                <span aria-hidden className="mt-1 size-4 shrink-0 rounded-full" style={{ backgroundColor: focus.color }} />
                <div>
                  <p className="flex items-center gap-2 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.15em] text-pink-soft uppercase">
                    <SpeedStripes className="h-3 w-7 text-pink" /> At-bat focus · {focus.colorName}
                  </p>
                  <p className="mt-1 font-semibold">{focus.title}</p>
                  <p className="text-sm text-muted">{focus.tip}</p>
                </div>
              </div>
            )}
            <Cards categories={MOVEMENT} values={current} />
          </div>
        </div>
      ) : (
        <EmptyState>Not filled in yet. Your coach adds these after your movement check.</EmptyState>
      )}
      {canManage && (
        <Disclosure summary={hasAny ? "Update movement preferences" : "Add movement preferences"} open={!hasAny}>
          <StyleForm
            playerId={playerId}
            categories={MOVEMENT}
            current={current}
            action={saveMovement}
            coachWords
            submitLabel="Save movement preferences"
          />
        </Disclosure>
      )}
      {canManage && <History categories={MOVEMENT} versions={versions} />}
    </section>
  );
}

export function HittingSection({ playerId, versions, canAct }: { playerId: string; versions: StyleVersion[]; canAct: boolean }) {
  const current = versions[0]?.values ?? {};
  const hasAny = Object.values(current).some(Boolean);
  return (
    <section className="flex flex-col gap-5">
      <div>
        <DetailHeading>Preferred Hitting Style</DetailHeading>
        <p className="-mt-1 text-sm text-muted">How you naturally set up and swing. There&apos;s no right or wrong: it&apos;s what feels natural to you.</p>
      </div>
      {hasAny ? <Cards categories={HITTING} values={current} /> : <EmptyState>Not filled in yet.</EmptyState>}
      {canAct && (
        <Disclosure summary={hasAny ? "Change my hitting style" : "Fill in my hitting style"} open={!hasAny}>
          <StyleForm playerId={playerId} categories={HITTING} current={current} action={saveHittingStyle} submitLabel="Save hitting style" />
        </Disclosure>
      )}
      <History categories={HITTING} versions={versions} />
    </section>
  );
}

/** One line for the Pop Report board. */
export function movementHeadline(versions: StyleVersion[]) {
  const v = versions[0]?.values;
  if (!v) return null;
  const style = choiceOf(MOVEMENT, "move_style", v.move_style)?.label;
  const dial = moveDial(v);
  const one = dial ? (Object.entries(dial).find(([, r]) => r === "1")?.[0] ?? null) : null;
  const spot = one ? choiceOf(MOVEMENT, "dial_one", one)?.label : null;
  return [style, spot && `#1 ${spot.toLowerCase()}`].filter(Boolean).join(" · ") || null;
}
