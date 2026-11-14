import type { Metadata } from "next";
import Link from "next/link";
import { Card, Disclosure, badgeClass } from "@/components/ui";
import { suggestUsername } from "@/lib/player-logins";
import { consentStep } from "@/lib/consent";
import { formatLongDateAt } from "@/lib/dates";
import { CreatePlayerLoginForm, ResetPlayerPasswordForm } from "../player-login";
import { ConsentOnFile, ConsentSteps } from "../consent";
import { JoinForm } from "../join-form";
import { firstOf, loadFamily } from "../family-data";
import { FamilyShell, SectionHeading, SectionTitle } from "../shell";

export const metadata: Metadata = { title: "Logins & teams · GGG.Cafe" };

// The family menu's Logins & teams (user, 2026-11-13; they were on the family page): each daughter's
// login (and verified parental consent under 13), the parent's team requests, and joining another team.
export default function FamilyLoginsPage() {
  return (
    <FamilyShell>
      <FamilyLogins />
    </FamilyShell>
  );
}

async function FamilyLogins() {
  const { supabase, user, links, daughters, offForDaughter } = await loadFamily();
  const [{ data: account }, { data: claims }, { data: consentRows }] = await Promise.all([
    supabase.from("parent_accounts").select("display_name").eq("user_id", user.id).maybeSingle(),
    supabase.auth.getClaims(),
    // verified parental consent for daughters under 13 (COPPA)
    supabase.rpc("parent_consent_status"),
  ]);
  const consents = new Map((consentRows ?? []).map((c) => [c.player_id, c]));
  const meta = (claims?.claims?.user_metadata ?? {}) as { display_name?: string };
  const metaName = (meta.display_name ?? "").trim();

  return (
    <div className="flex flex-col gap-10">
      <SectionTitle title="Logins & teams" line="Your daughter's login, parental consent for players under 13, and the teams you belong to." />

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
                  <p className="text-sm text-muted">{first} isn&apos;t on the team&apos;s current roster yet. Once the head coach adds her, you can make her login here.</p>
                ) : step === "birth-date" ? (
                  <p className="text-sm text-muted">Her birth date isn&apos;t on her profile yet. Ask her head coach to add it; then you can make {first}&apos;s login here.</p>
                ) : step === "needed" ? (
                  <ConsentSteps
                    playerId={d.player_id}
                    firstName={first}
                    userId={user.id}
                    defaultName={account?.display_name ?? metaName}
                    declinedNote={consent?.status === "declined" ? consent.review_note : null}
                  />
                ) : step === "pending" && consent ? (
                  <ConsentOnFile playerId={d.player_id} firstName={first} status="pending" method={consent.method} date={formatLongDateAt(consent.submitted_at)} />
                ) : (
                  <>
                    {step === "verified" && consent?.reviewed_at && (
                      <ConsentOnFile playerId={d.player_id} firstName={first} status="verified" method={consent.method} date={formatLongDateAt(consent.reviewed_at)} />
                    )}
                    <p className="text-sm text-muted">
                      No email for {first}? Make her a username and password; she signs in with them instead of an email. If she has an email, she can sign up
                      herself and claim her profile.
                    </p>
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
          {links.some((l) => l.status === "declined") && (
            <p className="mt-3 text-sm text-muted">If a request wasn&apos;t approved, check the team code and name with your coach.</p>
          )}
        </Card>
      )}

      <Disclosure summary="Join another team">
        <JoinForm askName={!account} defaultName={metaName} />
      </Disclosure>
    </div>
  );
}
