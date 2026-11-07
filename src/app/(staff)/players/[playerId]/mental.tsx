import { Disclosure } from "@/components/ui";
import { MENTAL_FIELDS, type MentalPlan } from "./shared";
import { MentalForm } from "./mental-client";
import { DetailHeading, MenuItem } from "./menu";

const SUMMARY_FIELDS = ["pre_game_routine", "pre_pitch_routine", "reset_routine", "pressure_plan"] as const;

function firstLine(value: string | null) {
  return value?.split("\n").find((l) => l.trim())?.trim() ?? null;
}

export function MentalSummary({ plan }: { plan: MentalPlan | null }) {
  const filled = plan ? MENTAL_FIELDS.filter((f) => plan[f.name]).length : 0;
  if (!plan || filled === 0) {
    return <MenuItem name="Not set up yet" note="Focus words, routines, and a reset for tough moments." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {plan.focus_words && <p className="text-xl leading-snug font-semibold text-neon">“{plan.focus_words}”</p>}
      {SUMMARY_FIELDS.map((name) => {
        const field = MENTAL_FIELDS.find((f) => f.name === name)!;
        return <MenuItem key={name} name={field.label} value={plan[name] ? "✓" : "—"} note={firstLine(plan[name])} />;
      })}
    </div>
  );
}

export function MentalDetail({ playerId, plan, canEdit }: { playerId: string; plan: MentalPlan | null; canEdit: boolean }) {
  const filled = plan ? MENTAL_FIELDS.filter((f) => plan[f.name]) : [];
  return (
    <div className="flex flex-col gap-8">
      {filled.length === 0 ? (
        <p className="text-sm text-muted">No Mental GP yet.{canEdit && " Fill in what you have below; every part is optional."}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filled.map((f) => (
            <section key={f.name} className={f.name === "focus_words" ? "md:col-span-2" : ""}>
              <DetailHeading>{f.label}</DetailHeading>
              <p className={`whitespace-pre-wrap ${f.name === "focus_words" ? "text-2xl font-semibold text-neon" : "text-ink/90"}`}>
                {plan![f.name]}
              </p>
            </section>
          ))}
        </div>
      )}
      {canEdit && (
        <Disclosure summary="Edit Mental GP" open={filled.length === 0}>
          <MentalForm playerId={playerId} plan={plan} />
        </Disclosure>
      )}
    </div>
  );
}
