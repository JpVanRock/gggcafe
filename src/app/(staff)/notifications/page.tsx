import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader, eyebrowClass } from "@/components/ui";
import { MarkRead } from "./mark-read";

export const metadata: Metadata = { title: "Notifications · GGG.Cafe" };

type Note = { id: string; kind: string; title: string; body: string | null; href: string | null; created_at: string; read_at: string | null };

const KIND_LABEL: Record<string, string> = { "player-of-the-week": "Player of the Week" };

export default async function NotificationsPage() {
  const user = await requireStaffPage();
  const supabase = await createClient();
  // decides any finished Player of the Week first (coaches and admins), like the bell
  await supabase.rpc("unread_notifications");
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, created_at, read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const notes = (data ?? []) as Note[];
  const unread = notes.filter((n) => !n.read_at).length;
  const when = (ts: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: process.env.APP_TIME_ZONE ?? "America/New_York", month: "short", day: "numeric" }).format(new Date(ts));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Notifications" description={unread ? `${unread} new` : "You're all caught up."} />
      {notes.length === 0 ? (
        <EmptyState>Nothing yet. When a player is named Player of the Week, you&apos;ll hear about it here.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => {
            const inner = (
              <>
                <span className={eyebrowClass}>
                  {KIND_LABEL[n.kind] ?? n.kind} · {when(n.created_at)}
                  {!n.read_at && <span className="ml-2 rounded bg-neon px-1.5 py-px font-bold text-on-accent">New</span>}
                </span>
                <span className="block font-semibold text-ink">{n.title}</span>
                {n.body && <span className="block text-sm text-muted">{n.body}</span>}
              </>
            );
            const cls = `block rounded-xl border px-4 py-3 ${n.read_at ? "border-navy-700" : "border-neon/60 bg-neon/5"}`;
            return (
              <li key={n.id}>
                {n.href ? (
                  <Link href={n.href} className={`${cls} transition hover:border-pink`}>
                    {inner}
                  </Link>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <MarkRead unread={unread} />
    </div>
  );
}
