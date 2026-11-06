import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FORMAT_LABEL, type Team } from "@/lib/softball";
import {
  Card, Disclosure, EmptyState, Loading, PageHeader, tableClass, tdClass, thClass,
} from "@/components/ui";
import { TeamForm } from "./forms";

export const metadata: Metadata = { title: "Teams · GGG.Cafe" };

export default function TeamsPage() {
  return (
    <>
      <PageHeader title="Teams" description="Your teams and the opponents you scout." />
      <Suspense fallback={<Loading />}>
        <TeamsContent />
      </Suspense>
    </>
  );
}

type TeamRow = Team & { roster_entries: { count: number }[] };

async function TeamsContent() {
  const user = await requireStaffPage();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("*, roster_entries(count)")
    .order("name");
  if (error) throw new Error(error.message);

  const teams = (data ?? []) as TeamRow[];
  const ours = teams.filter((t) => t.is_own_team);
  const opponents = teams.filter((t) => !t.is_own_team);

  return (
    <div className="flex flex-col gap-6">
      {canEdit(user.staff.role) && (
        <Disclosure summary="Add a team" open={teams.length === 0}>
          <TeamForm />
        </Disclosure>
      )}
      <Card title={`Our teams (${ours.length})`}>
        <TeamTable teams={ours} empty="No teams yet. Add your first team above." />
      </Card>
      <Card title={`Opponents (${opponents.length})`}>
        <TeamTable teams={opponents} empty="No opponents yet. Add the teams you play so you can scout them." />
      </Card>
    </div>
  );
}

function TeamTable({ teams, empty }: { teams: TeamRow[]; empty: string }) {
  if (teams.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>Team</th>
            <th className={thClass}>Age group</th>
            <th className={thClass}>Format</th>
            <th className={thClass}>Roster spots</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id}>
              <td className={tdClass}>
                <Link href={`/teams/${t.id}`} className="font-medium hover:underline">
                  {t.name}
                </Link>
                {t.organization && <span className="ml-2 text-muted">{t.organization}</span>}
              </td>
              <td className={tdClass}>{t.age_group ?? "–"}</td>
              <td className={tdClass}>{FORMAT_LABEL[t.format]}</td>
              <td className={`${tdClass} tabular-nums`}>{t.roster_entries[0]?.count ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
