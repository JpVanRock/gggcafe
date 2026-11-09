import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { Logo } from "@/components/brand";
import { OutlineText, SpeedStripes } from "@/components/athletic";
import { formatLongDate } from "@/lib/dates";
import { isUuid } from "@/lib/softball";
import { SectionShell } from "../../section-shell";

export const metadata: Metadata = { title: "Player Spotlight · GGG.Cafe" };

// Player Spotlight (Phase 5): the media-day graphic for a spotlight her coach wrote.
// Readable by staff and players on the team (RLS); screenshot or print to share.
export default async function SpotlightPage({ params }: PageProps<"/players/[playerId]/spotlight/[spotlightId]">) {
  const { playerId, spotlightId } = await params;
  if (!isUuid(spotlightId)) notFound();
  const supabase = await createClient();
  await requirePlayerPage(playerId);
  const { data } = await supabase
    .from("player_spotlights")
    .select("player_name, jersey, headline, body, published_on, team:teams(name)")
    .eq("id", spotlightId)
    .maybeSingle();
  if (!data) notFound();
  const s = data as { player_name: string; jersey: string | null; headline: string; body: string; published_on: string; team: { name: string } | null };
  const [first, ...rest] = s.player_name.split(" ");

  return (
    <SectionShell title="Player Spotlight" subtitle={s.team?.name}>
      <div className="flex flex-col gap-4">
        <Link href={`/players/${playerId}/team#spotlight`} className="-mt-2 self-start text-sm text-link hover:underline">
          ← Team page
        </Link>
        <article className="keep-night relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border-2 border-neon bg-linear-to-br from-navy-950 via-navy-900 to-navy-950 p-6 sm:p-8">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-linear-to-r from-pink via-pink to-neon" />
          {s.jersey && (
            <span className="pointer-events-none absolute -top-4 -right-2 font-display text-[11rem] leading-none font-black">
              <OutlineText stroke="var(--color-pink)">{s.jersey}</OutlineText>
            </span>
          )}
          <p className="relative flex items-center gap-3 font-mono text-xs tracking-[0.35em] text-pink-soft uppercase">
            <SpeedStripes className="h-3 w-9 text-link" />
            Player Spotlight
          </p>
          <h2 className="relative mt-6 font-display text-5xl leading-[0.9] font-black tracking-tight text-neon uppercase sm:text-6xl">
            {first}
            <span className="block text-ink">{rest.join(" ")}</span>
          </h2>
          <p className="relative mt-5 font-display text-2xl font-bold tracking-wide text-ink uppercase">{s.headline}</p>
          <p className="relative mt-3 whitespace-pre-wrap text-ink/90">{s.body}</p>
          <div className="relative mt-8 flex items-end justify-between gap-4">
            <p className="font-mono text-2xs tracking-widest text-muted uppercase">
              {s.team?.name}
              <br />
              {formatLongDate(s.published_on)}
            </p>
            <Logo size={56} className="h-14 w-14" />
          </div>
        </article>
        <p className="text-center text-xs text-muted">Take a screenshot to share it.</p>
      </div>
    </SectionShell>
  );
}
