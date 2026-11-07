import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { decidePlayerClaim, removePlayerClaim } from "../actions";

export type ClaimRow = {
  claim_id: string;
  email: string;
  typed_name: string;
  typed_jersey: string | null;
  roster_entry_id: string | null;
  status: "pending" | "approved" | "declined";
  season_id: string;
  season_name: string;
  requested_at: string;
};
export type SpotOption = { id: string; season_id: string; label: string };

/** Players' account claims for this team: approve (matching her spot), decline, or remove. */
export function ClaimsCard({ claims, spots }: { claims: ClaimRow[]; spots: SpotOption[] }) {
  const pending = claims.filter((c) => c.status === "pending");
  const approved = claims.filter((c) => c.status === "approved");
  const label = new Map(spots.map((s) => [s.id, s.label]));
  if (claims.length === 0) return null;

  return (
    <div id="claims">
      <Card title={`Player claims${pending.length ? ` · ${pending.length} waiting` : ""}`}>
        {pending.length > 0 && (
          <ul className="mb-5 flex flex-col gap-3">
            {pending.map((c) => {
              const options = spots.filter((s) => s.season_id === c.season_id);
              return (
                <li key={c.claim_id} className="rounded-xl border border-pink/50 bg-navy-950/40 p-4">
                  <p className="font-semibold">
                    {c.typed_name}
                    {c.typed_jersey && ` #${c.typed_jersey}`} <span className="font-normal text-muted">· {c.email}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {c.season_name} · asked {formatDay(c.requested_at.slice(0, 10))}
                    {!c.roster_entry_id && " · didn't match a spot by name and number"}
                  </p>
                  <form action={decidePlayerClaim} className="mt-3 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="claim_id" value={c.claim_id} />
                    <select
                      name="roster_entry_id"
                      required
                      defaultValue={c.roster_entry_id ?? ""}
                      aria-label={`Which roster spot is ${c.typed_name}?`}
                      className={`${inputClass} max-w-xs`}
                    >
                      <option value="" disabled>
                        Which player is she?
                      </option>
                      {options.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button type="submit" name="decision" value="approve" className={buttonClass}>
                      Approve
                    </button>
                    <button type="submit" name="decision" value="decline" formNoValidate className={secondaryButtonClass}>
                      Decline
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        {approved.length > 0 && (
          <ul className="divide-y divide-navy-800">
            {approved.map((c) => (
              <li key={c.claim_id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-semibold">{c.roster_entry_id ? label.get(c.roster_entry_id) ?? c.typed_name : c.typed_name}</span>{" "}
                  <span className="text-muted">
                    · {c.email} · {c.season_name}
                  </span>
                </span>
                <form action={removePlayerClaim}>
                  <input type="hidden" name="claim_id" value={c.claim_id} />
                  <ConfirmSubmit message={`Remove ${c.typed_name}'s access to her profile for ${c.season_name}?`} className="text-xs text-danger hover:underline">
                    Remove access
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
