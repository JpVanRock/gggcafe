import { headers } from "next/headers";
import { Card, pillQuietClass } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { setTeamCode } from "./team-code-actions";

/**
 * The team code: players, parents and assistant coaches enter it on the sign-up page, and
 * every sign-up still waits for a coach's approval. Coaches see it; head coaches make a new
 * one or turn sign-up off (Roster and Parents tabs).
 */
export async function TeamCodeCard({ team, code, head }: { team: { id: string; name: string }; code: string | null; head: boolean }) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "gggcafe.vercel.app";
  const signUpUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}/register`;

  return (
    <Card title="Team code">
      {code ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="font-display text-4xl font-bold tracking-[0.2em] text-highlight tabular-nums" aria-label={`Team code ${code.split("").join(" ")}`}>
              {code.slice(0, 3)}-{code.slice(3)}
            </p>
            {head && (
              <div className="flex flex-wrap gap-2">
                <ActionForm action={setTeamCode}>
                  <input type="hidden" name="team_id" value={team.id} />
                  <ConfirmSubmit message="Make a new code? The old code stops working. Everyone already approved keeps access." className={pillQuietClass}>
                    New code
                  </ConfirmSubmit>
                </ActionForm>
                <ActionForm action={setTeamCode}>
                  <input type="hidden" name="team_id" value={team.id} />
                  <input type="hidden" name="mode" value="off" />
                  <ConfirmSubmit
                    message={`Turn off sign-up for ${team.name}? No one can join with a code until you turn it back on. Everyone already approved keeps access.`}
                    className={pillQuietClass}
                  >
                    Turn off
                  </ConfirmSubmit>
                </ActionForm>
              </div>
            )}
          </div>
          <p className="text-sm text-muted">
            Give this code and the sign-up page, <span className="font-semibold text-ink">{signUpUrl}</span>, to your players, their parents
            and your assistant coaches. They pick their account type and enter the code. Every sign-up still waits for approval on the
            Roster tab.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">
            Sign-up is off for {team.name}. {head ? "Turn it on to get a team code" : "Your head coach turns it on and gets a team code"} for
            players, parents and assistant coaches.
          </p>
          {head && (
            <ActionForm action={setTeamCode}>
              <input type="hidden" name="team_id" value={team.id} />
              <SubmitButton>Turn on sign-up</SubmitButton>
            </ActionForm>
          )}
        </div>
      )}
    </Card>
  );
}
