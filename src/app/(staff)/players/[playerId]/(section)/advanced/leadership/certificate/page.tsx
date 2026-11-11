import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeadershipCertificate } from "@/components/leadership-certificate";
import { formatLongDateAt } from "@/lib/dates";
import { playerName } from "@/lib/softball";
import { createClient } from "@/lib/supabase/server";
import { signedLogoUrl } from "@/lib/team-logos";
import { certificateFor, programTitle } from "@/lib/leadership-guide";
import { PrintCertificateButton } from "../../../../leadership-client";
import { leadershipContext, leadershipHref } from "../../../../leadership";
import { SectionShell } from "../../../section-shell";

export const metadata: Metadata = { title: "Certificate of Leadership · GGG.Cafe" };

export default async function CertificatePage({ params }: PageProps<"/players/[playerId]/advanced/leadership/certificate">) {
  const { playerId } = await params;
  const { player, certificate, lead, name } = await leadershipContext(playerId);
  // only coaches/admins and the player herself can read it (RLS); everyone else gets a 404
  if (!certificate) notFound();
  const supabase = await createClient();
  const [{ data: spot }, logoUrl] = await Promise.all([
    certificate.team
      ? supabase
          .from("roster_entries")
          .select("jersey_number, season:seasons(start_date)")
          .eq("player_id", player.id)
          .eq("team_id", certificate.team.id)
      : Promise.resolve({ data: [] }),
    signedLogoUrl(supabase, certificate.team?.logo_path),
  ]);
  const { text, rungs } = certificateFor(certificate.program);
  const number =
    ((spot ?? []) as { jersey_number: string | null; season: { start_date: string | null } | null }[])
      .sort((a, b) => (b.season?.start_date ?? "").localeCompare(a.season?.start_date ?? ""))
      .find((r) => r.jersey_number)?.jersey_number ?? null;

  return (
    <SectionShell title={text.title} subtitle={`${name} · ${programTitle(certificate.program)}`}>
      <div className="flex flex-col gap-6">
        {lead.open && (
          <Link href={leadershipHref(player.id)} className="-mt-2 self-start text-sm text-link hover:underline">
            ← {lead.program === "light" ? "Leadership Light" : "Leadership Guide"}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <PrintCertificateButton />
          <p className="text-xs text-muted">Prints on one letter-size page, landscape. Turn on background graphics if your browser asks.</p>
        </div>
        <LeadershipCertificate
          name={playerName(player)}
          number={number}
          teamName={certificate.team?.name ?? null}
          logoUrl={logoUrl}
          coachName={certificate.coachName}
          date={formatLongDateAt(certificate.awardedAt)}
          text={text}
          rungs={rungs}
        />
      </div>
    </SectionShell>
  );
}
