import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AGE_GROUPS, POSITION_LABEL, ageGroupOf, batsThrows, playerName, type AgeGroup, type Player } from "@/lib/softball";
import { Card, EmptyState, Loading, PageHeader, buttonClass, inputClass, tableClass, tdClass, thClass, TableScroll } from "@/components/ui";
import { TabRow } from "@/components/tab-row";
import { TitleWithTeamLogo } from "@/components/team-logo";

export const metadata: Metadata = { title: "Players · GGG.Cafe" };

export default function PlayersPage({ searchParams }: PageProps<"/players">) {
  return (
    <>
      <TitleWithTeamLogo>
        <PageHeader title="Players" description="Everyone in the database: your players and the opponents you track." />
      </TitleWithTeamLogo>
      <Suspense fallback={<Loading />}>
        <PlayersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

type RosterEntry = {
  jersey_number: string | null;
  active: boolean;
  team: { id: string; name: string; short_name: string | null; is_own_team: boolean; age_group: string | null } | null;
  season: { name: string; start_date: string | null } | null;
};
type PlayerRow = Player & { roster_entries: RosterEntry[] };

/** The team she plays for now: an active spot in the latest season, else her latest team. */
function currentEntry(entries: RosterEntry[]) {
  return [...entries].sort(
    (a, b) => Number(b.active) - Number(a.active) || (b.season?.start_date ?? "").localeCompare(a.season?.start_date ?? ""),
  )[0];
}

function AgeTabs({ counts, current, query }: { counts: Map<AgeGroup | "all", number>; current: AgeGroup | "all"; query: string }) {
  const href = (age: AgeGroup | "all") => {
    const params = new URLSearchParams();
    if (age !== "all") params.set("age", age);
    if (query) params.set("q", query);
    const qs = params.toString();
    return qs ? `/players?${qs}` : "/players";
  };
  return (
    <TabRow label="Age groups" current={current}>
      <ul className="flex min-w-max gap-1 border-b border-navy-700">
        {(["all", ...AGE_GROUPS] as const).map((age) => {
          const on = age === current;
          return (
            <li key={age}>
              <Link
                href={href(age)}
                aria-current={on ? "page" : undefined}
                className={`-mb-px flex items-baseline gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-semibold tracking-wider uppercase transition ${
                  on ? "border-pink text-highlight" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {age === "all" ? "All" : age}
                <span className="font-display text-xs font-normal tabular-nums">{counts.get(age) ?? 0}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </TabRow>
  );
}

async function PlayersContent({ searchParams }: Pick<PageProps<"/players">, "searchParams">) {
  const user = await requireStaffPage();
  const { q, age } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim().toLowerCase();
  const ageTab: AgeGroup | "all" = (AGE_GROUPS as readonly string[]).includes(age as string) ? (age as AgeGroup) : "all";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select(
      "*, roster_entries(jersey_number, active, team:teams(id, name, short_name, is_own_team, age_group), season:seasons(name, start_date))",
    )
    .order("last_name")
    .order("first_name")
    .limit(2000);
  if (error) throw new Error(error.message);

  const editor = canEdit(user.staff.role);

  const all = ((data ?? []) as PlayerRow[]).map((p) => {
    const entry = currentEntry(p.roster_entries);
    return { ...p, entry, ageGroup: ageGroupOf(entry?.team?.age_group) };
  });
  const matching = query
    ? all.filter((p) => [p.first_name, p.last_name, p.preferred_name].some((n) => n?.toLowerCase().includes(query)))
    : all;
  const counts = new Map<AgeGroup | "all", number>([["all", matching.length]]);
  for (const p of matching) if (p.ageGroup) counts.set(p.ageGroup, (counts.get(p.ageGroup) ?? 0) + 1);
  const players = ageTab === "all" ? matching : matching.filter((p) => p.ageGroup === ageTab);
  const scope = [ageTab === "all" ? "All players" : `${ageTab} players`, query && `matching “${query}”`].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-6">
      {editor && (
        <p className="text-sm text-muted">
          To add players, open a team on the <Link href="/teams" className="text-link hover:underline">Teams</Link> page and use{" "}
          <span className="font-semibold text-ink">Player intake</span>.
        </p>
      )}

      <AgeTabs counts={counts} current={ageTab} query={query} />

      <Card title={`${scope} (${players.length})`}>
        <form className="mb-4 flex gap-2" role="search">
          {ageTab !== "all" && <input type="hidden" name="age" value={ageTab} />}
          <input name="q" defaultValue={query} placeholder="Search by name" aria-label="Search players" className={`${inputClass} max-w-xs`} />
          <button type="submit" className={buttonClass}>Search</button>
          {query && (
            <Link href={ageTab === "all" ? "/players" : `/players?age=${ageTab}`} className="self-center text-sm text-muted hover:underline">
              Clear
            </Link>
          )}
        </form>

        {players.length === 0 ? (
          <EmptyState>
            {query ? "No players match that name." : ageTab !== "all" ? `No ${ageTab} players yet. A player's age group comes from her team's age group.` : "No players yet."}
          </EmptyState>
        ) : (
          <TableScroll label="Players">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Player</th>
                  <th className={thClass}>Position</th>
                  <th className={thClass}>B/T</th>
                  <th className={thClass}>Class</th>
                  <th className={thClass}>Age group</th>
                  <th className={thClass}>Team</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const latest = p.entry;
                  return (
                    <tr key={p.id}>
                      <td className={tdClass}>
                        <Link href={`/players/${p.id}`} className="font-medium hover:underline">
                          {p.last_name}, {p.preferred_name || p.first_name}
                        </Link>
                        <span className="sr-only"> ({playerName(p)})</span>
                      </td>
                      <td className={tdClass} title={p.primary_position ? POSITION_LABEL[p.primary_position] : undefined}>
                        {p.primary_position ?? "–"}
                      </td>
                      <td className={tdClass}>{batsThrows(p)}</td>
                      <td className={`${tdClass} tabular-nums`}>{p.grad_year ?? "–"}</td>
                      <td className={tdClass}>{p.ageGroup ?? "–"}</td>
                      <td className={tdClass}>
                        {latest?.team ? (
                          <Link href={`/teams/${latest.team.id}`} className="hover:underline">
                            {latest.team.short_name || latest.team.name}
                            {latest.jersey_number && ` #${latest.jersey_number}`}
                          </Link>
                        ) : (
                          <span className="text-muted">Not on a roster</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}
