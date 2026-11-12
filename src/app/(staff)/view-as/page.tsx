import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireAdminPage } from "./parts";

export const metadata: Metadata = { title: "View as · GGG.Cafe" };

type ParentRow = { user_id: string; display_name: string };
type LinkRow = { parent_id: string; team_id: string; child_name: string; status: string };
type MentorRow = { user_id: string; display_name: string; specialty: string | null };

/**
 * Admins: pick a parent or a mentor and see their page as they do, to troubleshoot their questions
 * (user, 2026-11-12). Read only; nobody signs in as anyone.
 */
export default async function ViewAsPage() {
  await requireAdminPage();
  const supabase = await createClient();
  const [{ data: parents }, { data: links }, { data: mentors }, { data: teams }] = await Promise.all([
    supabase.from("parent_accounts").select("user_id, display_name").order("display_name"),
    supabase.from("parent_links").select("parent_id, team_id, child_name, status"),
    supabase.from("mentors").select("user_id, display_name, specialty").order("display_name"),
    supabase.from("teams").select("id, name").eq("is_own_team", true),
  ]);
  const teamName = new Map(((teams ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]));
  const linksOf = (id: string) => ((links ?? []) as LinkRow[]).filter((l) => l.parent_id === id);
  const link = "text-sm font-semibold text-link hover:underline";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="View as"
        description="See a parent's or a mentor's page as they see it, to help with their questions. Read only: nothing can be changed from it."
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card title={`Parents (${(parents ?? []).length})`}>
          {(parents ?? []).length === 0 ? (
            <EmptyState>No parent accounts yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-navy-800">
              {((parents ?? []) as ParentRow[]).map((p) => (
                <li key={p.user_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-semibold">{p.display_name}</span>
                    <span className="block text-xs text-muted">
                      {linksOf(p.user_id)
                        .map((l) => `${l.child_name} · ${teamName.get(l.team_id) ?? "a team"} (${l.status})`)
                        .join(" · ") || "No team request"}
                    </span>
                  </span>
                  <Link href={`/view-as/parent/${p.user_id}`} className={link} aria-label={`View as ${p.display_name}`}>
                    View as <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Mentors (${(mentors ?? []).length})`}>
          {(mentors ?? []).length === 0 ? (
            <EmptyState>No mentors yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-navy-800">
              {((mentors ?? []) as MentorRow[]).map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span>
                    <span className="block font-semibold">{m.display_name}</span>
                    <span className="block text-xs text-muted">{m.specialty ?? "Mentor"}</span>
                  </span>
                  <Link href={`/view-as/mentor/${m.user_id}`} className={link} aria-label={`View as ${m.display_name}`}>
                    View as <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
