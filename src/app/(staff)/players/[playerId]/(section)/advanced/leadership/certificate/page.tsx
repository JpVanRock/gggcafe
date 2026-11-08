import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { LeadershipCertificate } from "@/components/leadership-certificate";
import { formatLongDateAt } from "@/lib/dates";
import { playerName } from "@/lib/softball";
import { createClient } from "@/lib/supabase/server";
import { CERTIFICATE, GUIDE_TITLE, LADDER } from "@/lib/leadership-guide";
import { PrintCertificateButton } from "../../../../leadership-client";
import { leadershipContext, leadershipHref } from "../../../../leadership";
import { SectionShell } from "../../../section-shell";

export const metadata: Metadata = { title: "Certificate of Leadership · GGG.Cafe" };

export default function CertificatePage({ params }: PageProps<"/players/[playerId]/advanced/leadership/certificate">) {
  return (
    <Suspense fallback={<Loading />}>
      <Certificate params={params} />
    </Suspense>
  );
}

async function Certificate({ params }: Pick<PageProps<"/players/[playerId]/advanced/leadership/certificate">, "params">) {
  const { playerId } = await params;
  const { player, certificate, lead, name } = await leadershipContext(playerId);
  // only coaches/admins and the player herself can read it (RLS); everyone else gets a 404
  if (!certificate) notFound();
  const supabase = await createClient();
  const { data: spot } = certificate.team
    ? await supabase
        .from("roster_entries")
        .select("jersey_number, season:seasons(start_date)")
        .eq("player_id", player.id)
        .eq("team_id", certificate.team.id)
    : { data: [] };
  const number =
    ((spot ?? []) as unknown as { jersey_number: string | null; season: { start_date: string | null } | null }[])
      .sort((a, b) => (b.season?.start_date ?? "").localeCompare(a.season?.start_date ?? ""))
      .find((r) => r.jersey_number)?.jersey_number ?? null;

  return (
    <SectionShell title={CERTIFICATE.title} subtitle={`${name} · ${GUIDE_TITLE}`}>
      <div className="flex flex-col gap-6">
        {lead.open && (
          <Link href={leadershipHref(player.id)} className="-mt-2 self-start text-sm text-pink hover:underline">
            ← Leadership Guide
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
          logoUrl={certificate.team?.logo_url ?? null}
          coachName={certificate.coachName}
          date={formatLongDateAt(certificate.awardedAt)}
          text={CERTIFICATE}
          rungs={LADDER}
        />
      </div>
    </SectionShell>
  );
}
