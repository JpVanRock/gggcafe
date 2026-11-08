// Approval lists shared by the Dugout Roster tab, the Parents tab and the team
// page: players claiming their roster spot and parents asking to join.
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { usernameFromEmail } from "@/lib/player-logins";
import { nameKey, type ClaimRow, type ParentLinkRow, type ParentMatch, type SpotOption } from "@/lib/approvals";
import { decidePlayerClaim, removePlayerClaim } from "../teams/actions";
import { decideParentLink } from "./parents/actions";

const item = "rounded-xl border border-pink/50 bg-navy-950/40 p-4";

/** Player claims waiting: match her spot (pre-filled when name and number matched), approve or decline. */
export function PendingClaimList({ claims, spots }: { claims: ClaimRow[]; spots: SpotOption[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {claims.map((c) => (
        <li key={c.claim_id} className={item}>
          <p className="font-semibold">
            {c.typed_name}
            {c.typed_jersey && ` #${c.typed_jersey}`} <span className="font-normal text-muted">· {c.email}</span>
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Player claiming her profile · {c.season_name} · asked {formatDay(c.requested_at.slice(0, 10))}
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
              {spots
                .filter((s) => s.season_id === c.season_id)
                .map((s) => (
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
      ))}
    </ul>
  );
}

/** Players with access, with a way to remove it. */
export function ApprovedClaimList({ claims, spots }: { claims: ClaimRow[]; spots: SpotOption[] }) {
  const label = new Map(spots.map((s) => [s.id, s.label]));
  return (
    <ul className="divide-y divide-navy-800">
      {claims.map((c) => (
        <li key={c.claim_id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
          <span>
            <span className="font-semibold">{c.roster_entry_id ? (label.get(c.roster_entry_id) ?? c.typed_name) : c.typed_name}</span>{" "}
            <span className="text-muted">
              · {usernameFromEmail(c.email) ? `username ${usernameFromEmail(c.email)} (made by her parent)` : c.email} · {c.season_name}
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
  );
}

/** Parent requests waiting: match the daughter (guessed from the name), approve or decline. */
export function PendingParentList({ links, players }: { links: ParentLinkRow[]; players: ParentMatch[] }) {
  const guess = (child: string) => players.find((p) => p.keys.includes(nameKey(child)))?.id ?? "";
  return (
    <ul className="flex flex-col gap-3">
      {links.map((l) => (
        <li key={l.link_id} className={item}>
          <p className="font-semibold">
            {l.parent_name} <span className="font-normal text-muted">· {l.email}</span>
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Parent of <span className="text-ink">{l.child_name}</span> · asked {formatDay(l.requested_at.slice(0, 10))}
          </p>
          <form action={decideParentLink} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="link_id" value={l.link_id} />
            <select name="player_id" required defaultValue={guess(l.child_name)} aria-label={`Which player is ${l.child_name}?`} className={`${inputClass} max-w-xs`}>
              <option value="" disabled>
                Which player is she?
              </option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
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
      ))}
    </ul>
  );
}
