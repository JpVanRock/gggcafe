import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadYearbook, yearbookTeams } from "@/lib/yearbook-data";
import { YearbookView } from "@/components/yearbook-view";
import { EmptyState, Loading } from "@/components/ui";
import { FamilyHeader } from "../header";

export const metadata: Metadata = { title: "Yearbook · GGG.Cafe" };

export default function FamilyYearbookPage({ searchParams }: PageProps<"/family/yearbook">) {
  return (
    <div className="flex flex-1 flex-col">
      <FamilyHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Suspense fallback={<Loading />}>
          <FamilyYearbook searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function FamilyYearbook({ searchParams }: Pick<PageProps<"/family/yearbook">, "searchParams">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { team: teamParam, season } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("parent_home");
  const links = ((data ?? []) as { team_id: string; team_name: string; status: string }[]).filter((l) => l.status === "approved");
  const teams = [...new Map(links.map((l) => [l.team_id, { id: l.team_id, name: l.team_name }])).values()];
  const open = await yearbookTeams(supabase, teams.map((t) => t.id));
  const allowed = teams.filter((t) => open.includes(t.id));
  if (allowed.length === 0) {
    return (
      <EmptyState>
        The Yearbook is part of G3 Advanced. It opens here once your daughter has it.{" "}
        <Link href="/family" className="text-link hover:underline">
          Back home
        </Link>
      </EmptyState>
    );
  }
  const team = allowed.find((t) => t.id === teamParam) ?? allowed[0];
  const loaded = await loadYearbook(supabase, team.id, typeof season === "string" ? season : null);
  return (
    <div className="flex flex-col gap-6">
      {allowed.length > 1 && (
        <nav aria-label="Team" className="flex flex-wrap gap-1.5">
          {allowed.map((t) => (
            <Link
              key={t.id}
              href={`/family/yearbook?team=${t.id}`}
              aria-current={t.id === team.id ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                t.id === team.id ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
              }`}
            >
              {t.name}
            </Link>
          ))}
        </nav>
      )}
      {loaded ? (
        <YearbookView data={loaded.yearbook} urls={loaded.urls} seasonLink={`/family/yearbook?team=${team.id}&season=`} />
      ) : (
        <EmptyState>Couldn&apos;t open the yearbook. Try again in a moment.</EmptyState>
      )}
    </div>
  );
}
