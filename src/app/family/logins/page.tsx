import type { Metadata } from "next";
import Link from "next/link";
import { Card, Disclosure, badgeClass } from "@/components/ui";
import { suggestUsername } from "@/lib/player-logins";
import { consentStep } from "@/lib/consent";
import { formatLongDateAt } from "@/lib/dates";
import { BirthDateForm, CreatePlayerLoginForm, ResetPlayerPasswordForm } from "../player-login";
import { ConsentAccept, ConsentOnFile } from "../consent";
import { firstOf, loadFamily } from "../family-data";
import { FamilyShell, SectionHeading, SectionTitle } from "../shell";

export const metadata: Metadata = { title: "Logins & teams · GGG.Cafe" };

const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

// The family menu's Logins & teams (user, 2026-11-13; they were on the family page): each daughter's
// login (and verified parental consent under 13) and the parent's teams. Joining another team moved to
// the family page's menu, and a button by the title goes back to the family dashboard (user, 2026-11-16).
export default function FamilyLoginsPage() {
  return (
    <FamilyShell>
      <FamilyLogins />
    </FamilyShell>
  );
}

async function FamilyLogins() {
  const { supabase, user, meta, links, daughters, offForDaughter } = await loadFamily();
  const [{ data: account }, { data: consentRows }] = await Promise.all([
    supabase.from("parent_accounts").select("display_name").eq("user_id", user.id).maybeSingle(),
    // verified parental consent for daughters under 13 (COPPA)
    supabase.rpc("parent_consent_status"),
  ]);
  const consents = new Map((consentRows ?? []).map((c) => [c.player_id, c]));
  const metaName = (meta.display_name ?? "").trim();

  return (
    <div className="flex flex-col gap-10">
      <SectionTitle
        title="Logins & teams"
        line="Your daughter's login, parental consent for players under 13, and the teams you belong to."
      />

      {daughters.length > 0 && (
        <section aria-label="Their logins" className="flex flex-col gap-6">
          {daughters.map((d) => {
            const first = firstOf(d.player_name);
            const consent = consents.get(d.player_id);
            const step = consentStep(consent);
            return (
              <div key={d.player_id} className="flex flex-col gap-3 rounded-2xl border border-navy-700 bg-navy-900/70 p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <SectionHeading id={`login-${d.player_id}`}>
                    {d.player_name} <span className="font-sans text-base font-normal tracking-normal text-muted normal-case">· {d.team_name}</span>
                  </SectionHeading>
                  {/* her pages as she sees them, read only (user, 2026-11-12) */}
                  {d.on_roster && !offForDaughter(d, "parent.view_as") && (
                    <Link href={`/players/${d.player_id}`} className="text-sm font-semibold text-link hover:underline">
                      View as {first} <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </div>
                {d.username ? (
                  <>
                    <p className="text-sm text-muted">
                      {first} signs in with the username <span className="font-mono font-bold text-ink">{d.username}</span> and the password you set.
                    </p>
                    <Disclosure summary={`Set a new password for ${first}`}>
                      <ResetPlayerPasswordForm playerId={d.player_id} firstName={first} />
                    </Disclosure>
                    {step === "verified" && consent?.reviewed_at && (
                      <ConsentOnFile playerId={d.player_id} firstName={first} status="verified" method={consent.method} date={formatLongDateAt(consent.reviewed_at)} />
                    )}
                  </>
                ) : d.has_account ? (
                  <p className="text-sm text-muted">{first} has her own account and signs in with her email.</p>
                ) : !d.on_roster ? (
                  <p className="text-sm text-muted">{first} isn&apos;t on the team&apos;s current roster yet. Once the head coach adds her, you can create her login here.</p>
                ) : step === "birth-date" ? (
                  <>
                    <p className="text-sm text-muted">
                      Add {first}&apos;s birth date to create her login. Players under 13 need your verified consent first; the next step shows how.
                    </p>
                    <BirthDateForm playerId={d.player_id} firstName={first} />
                  </>
                ) : step === "needed" || step === "pending" ? (
                  // a signed form or video call sent before 2026-11-16 and still waiting: accepting here replaces it
                  <ConsentAccept
                    playerId={d.player_id}
                    firstName={first}
                    defaultName={consent?.parent_name ?? account?.display_name ?? metaName}
                    declinedNote={consent?.status === "declined" ? consent.review_note : null}
                  />
                ) : (
                  <>
                    {step === "verified" && consent?.reviewed_at && (
                      <ConsentOnFile playerId={d.player_id} firstName={first} status="verified" method={consent.method} date={formatLongDateAt(consent.reviewed_at)} />
                    )}
                    {/* the last step, unmistakable (user, 2026-11-16: the username didn't work because no login had been made) */}
                    <div className="flex flex-col gap-1 rounded-xl border border-neon-edge/60 bg-neon/5 p-4">
                      <p className="font-semibold">{consent?.status === "verified" ? `Last step: create ${possessive(first)} login` : `Create ${possessive(first)} login`}</p>
                      <p className="text-sm text-muted">
                        Pick her username and password, then press &quot;Create {possessive(first)} login&quot;. She signs in with them on the sign-in page:
                        no email needed. Her login doesn&apos;t exist until you press it.
                      </p>
                    </div>
                    <CreatePlayerLoginForm playerId={d.player_id} firstName={first} suggestion={suggestUsername(d.player_name)} />
                  </>
                )}
              </div>
            );
          })}
        </section>
      )}

      {links.length > 0 && (
        <Card title="Your teams">
          <ul className="divide-y divide-navy-800">
            {links.map((l) => (
              <li key={l.link_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-semibold">{l.team_name}</p>
                  <p className="text-sm text-muted">Parent of {l.player_name ?? l.child_name}</p>
                </div>
                <span className={badgeClass(l.status === "approved" ? "neon" : l.status === "pending" ? "pink" : "neutral")}>
                  {l.status === "approved" ? "Approved" : l.status === "pending" ? "Waiting for coach" : "Not approved"}
                </span>
              </li>
            ))}
          </ul>
          {links.some((l) => l.status === "pending") && (
            <p className="mt-3 text-sm text-muted">
              Waiting? Fix her name on your{" "}
              <Link href="/family" className="font-semibold text-link hover:underline">
                dashboard
              </Link>{" "}
              to match the roster, or your head coach approves you.
            </p>
          )}
          {links.some((l) => l.status === "declined") && (
            <p className="mt-3 text-sm text-muted">If a request wasn&apos;t approved, check the code and her name with your coach.</p>
          )}
        </Card>
      )}
    </div>
  );
}
