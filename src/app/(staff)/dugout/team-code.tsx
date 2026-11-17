import type { ReactNode } from "react";
import { requestOrigin } from "@/lib/request-origin";
import { Card, pillQuietClass } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { setParentCode } from "./team-code-actions";

type Team = { id: string; name: string };

/**
 * The parent code (user, 2026-11-16: "one code the parents code to join a team. Players will never be
 * given this code"): the team's one join code. Parents enter it with their daughter's name and are in at
 * once when the name matches the current roster; assistant coaches and mentors enter it and wait for
 * approval. Players never get it: a parent makes each player's login. Roster and Parents tabs.
 */
export async function ParentCodeCard({ team, code, head }: { team: Team; code: string | null; head: boolean }) {
  const signUpUrl = `${await requestOrigin()}/register`;
  return (
    <CodeCard team={team} code={code} head={head}>
      The team&apos;s one code to join. Give it and the sign-up page, <span className="font-semibold text-ink">{signUpUrl}</span>, to parents,
      assistant coaches and mentors, never to players: a parent makes each player&apos;s login. A parent who enters it with their daughter&apos;s
      name as it is on the roster gets in right away, and you get a notification. Everyone else waits for approval.
    </CodeCard>
  );
}

const copy = {
  title: "Parent code",
  newConfirm: "Make a new parent code? The old one stops working. Everyone already approved keeps access.",
  offConfirm: (team: string) => `Turn off the parent code for ${team}? No one can join ${team} until you turn it back on. Everyone already approved keeps access.`,
  offLine: (team: string, head: boolean) =>
    `The parent code is off for ${team}, so no one can join. ${head ? "Turn it on" : "Your head coach turns it on"} for parents, assistant coaches and mentors.`,
  onLabel: "Turn on the parent code",
};

function CodeCard({ team, code, head, children }: { team: Team; code: string | null; head: boolean; children: ReactNode }) {
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
                <ActionForm action={setParentCode}>
                  <input type="hidden" name="team_id" value={team.id} />
                  <ConfirmSubmit message={copy.newConfirm} className={pillQuietClass}>
                    New code
                  </ConfirmSubmit>
                </ActionForm>
                <ActionForm action={setParentCode}>
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
            <ActionForm action={setParentCode}>
              <input type="hidden" name="team_id" value={team.id} />
              <SubmitButton>{copy.onLabel}</SubmitButton>
            </ActionForm>
          )}
        </div>
      )}
    </Card>
  );
}
