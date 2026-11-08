import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Loading } from "@/components/ui";
import { isISODate, todayISO, weekStart } from "@/lib/dates";
import { loadActivities, loadHarada, possessive } from "../../data";
import { ActivitiesManager } from "../../twis";
import { firstName, loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "Activities · GGG.Cafe" };

export default function ActivitiesPage({ params, searchParams }: PageProps<"/players/[playerId]/activities">) {
  return (
    <Suspense fallback={<Loading />}>
      <Activities params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Activities({ params, searchParams }: Pick<PageProps<"/players/[playerId]/activities">, "params" | "searchParams">) {
  const { playerId } = await params;
  const { week } = await searchParams;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const today = todayISO();
  const monday = weekStart(isISODate(week) ? week : today);
  const [activities, chart] = await Promise.all([loadActivities(supabase, player.id, monday, "9999-12-31"), loadHarada(supabase, player.id)]);
  return (
    <SectionShell title={`${possessive(firstName(player))} Activities`} subtitle="What she's chosen to do · shows in TWIS">
      {access.canAct ? (
        <ActivitiesManager
          playerId={player.id}
          activities={activities.filter((a) => !a.category && !a.source)}
          today={today}
          defaultStart={monday}
          pillars={(chart?.pillars ?? []).map((p) => ({ id: p.id, title: p.title }))}
        />
      ) : (
        <ul className="divide-y divide-navy-700">
          {activities
            .filter((a) => !a.category)
            .map((a) => (
              <li key={a.id} className="py-3">
                <p className="font-medium">{a.title}</p>
                {a.details && <p className="mt-1 text-sm text-ink/80">{a.details}</p>}
              </li>
            ))}
        </ul>
      )}
    </SectionShell>
  );
}
