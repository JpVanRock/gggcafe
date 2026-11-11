// Parental consents waiting for a GGG.Cafe admin (COPPA): the signed form (a link that expires)
// or a video-call request, with Verify / Decline and a note. Admins only (the database returns
// the list to admins and nobody else). Roster tab, "Waiting for approval".
import { ActionForm } from "@/components/action-form";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { RELATIONSHIP_LABEL, ageOn, type Relationship } from "@/lib/consent";
import { formatLongDate, formatLongDateAt, todayISO } from "@/lib/dates";
import { reviewParentalConsent } from "./actions";

export type PendingConsent = {
  id: string;
  player_name: string;
  birth_date: string | null;
  team_name: string | null;
  parent_name: string;
  parent_account: string | null;
  parent_email: string | null;
  relationship: string;
  method: string;
  form_path: string | null;
  submitted_at: string;
};

export function PendingConsentList({ consents, formUrls }: { consents: PendingConsent[]; formUrls: Map<string, string> }) {
  const today = todayISO();
  return (
    <ul className="flex flex-col gap-3">
      {consents.map((c) => {
        const url = c.form_path ? formUrls.get(c.form_path) : undefined;
        const video = c.method === "video_call";
        return (
          <li key={c.id} className="flex flex-col gap-3 rounded-xl border border-navy-700 bg-navy-900 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold">
                {c.player_name}
                <span className="font-normal text-muted">
                  {c.birth_date ? ` · ${ageOn(c.birth_date, today)} (born ${formatLongDate(c.birth_date)})` : ""}
                  {c.team_name ? ` · ${c.team_name}` : ""}
                </span>
              </p>
              <p className="text-xs text-muted">Sent {formatLongDateAt(c.submitted_at)}</p>
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Name on the {video ? "request" : "form"}</dt>
                <dd>
                  {c.parent_name} · {RELATIONSHIP_LABEL[c.relationship as Relationship] ?? c.relationship}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Parent account</dt>
                <dd className="break-all">{[c.parent_account, c.parent_email].filter(Boolean).join(" · ") || "–"}</dd>
              </div>
            </dl>
            {video ? (
              <p className="text-sm">
                Asked for a <span className="font-semibold">video call</span>. Email the parent to set it up, check that the name matches their
                photo ID (don&apos;t keep a copy), then verify with a note of the date and who you spoke with.
              </p>
            ) : url ? (
              <a href={url} target="_blank" rel="noopener" className="self-start text-sm font-semibold text-link underline underline-offset-2">
                Open the signed form (link expires in 10 minutes)
              </a>
            ) : (
              <p className="text-sm text-danger">The signed form couldn&apos;t be opened. Reload the page.</p>
            )}
            {!video && (
              <p className="text-xs text-muted">
                Check: it&apos;s our form, signed by hand, the player&apos;s name matches, and the printed name matches the parent account.
              </p>
            )}
            <ActionForm action={reviewParentalConsent} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="consent_id" value={c.id} />
              <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
                <span className="text-sm font-medium">{video ? "Note (required to verify or decline)" : "Note (required to decline; the parent sees it)"}</span>
                <input name="note" maxLength={500} className={inputClass} />
              </label>
              <button type="submit" name="decision" value="verify" className={buttonClass}>
                Verify
              </button>
              <button type="submit" name="decision" value="decline" className={secondaryButtonClass}>
                Decline
              </button>
            </ActionForm>
          </li>
        );
      })}
    </ul>
  );
}
