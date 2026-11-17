import type { ReactNode } from "react";
import { requestOrigin } from "@/lib/request-origin";
import { Card, pillQuietClass } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { setParentCode, setTeamCode } from "./team-code-actions";

type Team = { id: string; name: string };

/**
 * The team code: players, assistant coaches and mentors enter it on the sign-up page and wait for
 * approval. Coaches see it; head coaches make a new one or turn sign-up off (Roster tab).
 */
export async function TeamCodeCard({ team, code, head }: { team: Team; code: string | null; head: boolean }) {
  const signUpUrl = `${await requestOrigin()}/register`;
  return (
    <CodeCard kind="team" team={team} code={code} head={head}>
      Give this code and the sign-up page, <span className="font-semibold text-ink">{signUpUrl}</span>, to your players, assistant coaches and
      mentors. They pick their account type, enter the code and wait for approval here. Parents use the parent code (Parents tab).
    </CodeCard>
  );
}

/**
 * The parent code (user, 2026-11-16): parents enter it with their daughter's name and are approved at
 * once when the name matches a player on the current roster. Never shown to players (Parents tab).
 */
export async function ParentCodeCard({ team, code, head }: { team: Team; code: string | null; head: boolean }) {
  const signUpUrl = `${await requestOrigin()}/register`;
  return (
    <CodeCard kind="parent" team={team} code={code} head={head}>
      Give this code and the sign-up page, <span className="font-semibold text-ink">{signUpUrl}</span>, to parents only: never to players.
      A parent who enters it with their daughter&apos;s name as it is on the roster gets in right away, and you get a notification. A name that
      doesn&apos;t match waits for you below.
    </CodeCard>
  );
}

const COPY = {
  team: {
    title: "Team code",
    action: setTeamCode,
    newConfirm: "Make a new code? The old code stops working. Everyone already approved keeps access.",
    offConfirm: (team: string) => `Turn off sign-up for ${team}? No one can join with the team code until you turn it back on. Everyone already approved keeps access.`,
    offLine: (team: string, head: boolean) =>
      `Sign-up is off for ${team}. ${head ? "Turn it on to get a team code" : "Your head coach turns it on and gets a team code"} for players, assistant coaches and mentors.`,
    onLabel: "Turn on sign-up",
  },
  parent: {
    title: "Parent code",
    action: setParentCode,
    newConfirm: "Make a new parent code? The old one stops working. Parents already approved keep access.",
    offConfirm: (team: string) => `Turn off the parent code for ${team}? Parents can't join with it until you turn it back on. Parents already approved keep access.`,
    offLine: (team: string, head: boolean) =>
      `The parent code is off for ${team}. ${head ? "Turn it on" : "Your head coach turns it on"} so parents can join without waiting for approval.`,
    onLabel: "Turn on the parent code",
  },
} as const;

function CodeCard({ kind, team, code, head, children }: { kind: "team" | "parent"; team: Team; code: string | null; head: boolean; children: ReactNode }) {
  const copy = COPY[kind];
  return (
    <Card title={copy.title}>
      {code ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="font-display text-4xl font-bold tracking-[0.2em] text-highlight tabular-nums" aria-label={`${copy.title} ${code.split("").join(" ")}`}>
              {code.slice(0, 3)}-{code.slice(3)}
            </p>
            {head && (
              <div className="flex flex-wrap gap-2">
                <ActionForm action={copy.action}>
                  <input type="hidden" name="team_id" value={team.id} />
                  <ConfirmSubmit message={copy.newConfirm} className={pillQuietClass}>
                    New code
                  </ConfirmSubmit>
                </ActionForm>
                <ActionForm action={copy.action}>
                  <input type="hidden" name="team_id" value={team.id} />
                  <input type="hidden" name="mode" value="off" />
                  <ConfirmSubmit message={copy.offConfirm(team.name)} className={pillQuietClass}>
                    Turn off
                  </ConfirmSubmit>
                </ActionForm>
              </div>
            )}
          </div>
          <p className="text-sm text-muted">{children}</p>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">{copy.offLine(team.name, head)}</p>
          {head && (
            <ActionForm action={copy.action}>
              <input type="hidden" name="team_id" value={team.id} />
              <SubmitButton>{copy.onLabel}</SubmitButton>
            </ActionForm>
          )}
        </div>
      )}
    </Card>
  );
}
