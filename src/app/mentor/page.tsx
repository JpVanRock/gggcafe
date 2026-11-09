import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser, getMenteeIds, getMentor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedPhotoUrls } from "@/lib/player-photos";
import { EmptyState, Loading, PageHeader } from "@/components/ui";
import { playerName, type Player } from "@/lib/softball";

export const metadata: Metadata = { title: "My players · Mentor · GGG.Cafe" };

export default function MentorHome() {
  return (
    <Suspense fallback={<Loading />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const mentor = await getMentor();
  if (!mentor) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Welcome, mentor" description="GGG.Cafe" />
        <p className="max-w-2xl rounded-2xl border border-pink/50 bg-pink/5 p-5">
          {user.staff
            ? "This is the mentor area. Mentors are approved and assigned players in Coaches Dugout → Mentors."
            : "Thanks for signing up. An admin approves new mentors, then a coach assigns your players. Once that's done, they show up here."}
        </p>
      </div>
    );
  }

  const ids = await getMenteeIds();
  const supabase = await createClient();
  const [{ data: playerRows }, { data: rosterRows }, { data: sent }] = await Promise.all([
    ids.length ? supabase.from("players").select("*").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("roster_entries").select("player_id, jersey_number, active, team:teams(name)").in("player_id", ids).eq("active", true)
      : Promise.resolve({ data: [] }),
    supabase
      .from("mentor_messages")
      .select("id, player_id, body, photo_path, drill_name, created_at, read_at")
      .eq("sender_id", mentor.userId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const players = ((playerRows ?? []) as Player[]).sort((a, b) => a.last_name.localeCompare(b.last_name));
  const spots = (rosterRows ?? []) as { player_id: string; jersey_number: string | null; team: { name: string } | null }[];
  const photos = await signedPhotoUrls(supabase, players.map((p) => p.photo_path));
  const nameOf = (id: string) => {
    const p = players.find((x) => x.id === id);
    return p ? playerName(p) : "A player";
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Welcome, ${mentor.displayName.split(" ")[0]}`}
        description={`${mentor.specialty ?? "Mentor"} · ${players.length} player${players.length === 1 ? "" : "s"}`}
      />
      {players.length === 0 ? (
        <EmptyState>No players assigned yet. Your coach assigns them, and they show up here.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => {
            const spot = spots.find((s) => s.player_id === p.id);
            const photo = p.photo_path ? photos.get(p.photo_path) : null;
            return (
              <li key={p.id}>
                <Link
                  href={`/mentor/players/${p.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-navy-600 p-4 transition hover:border-pink hover:bg-navy-800"
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
                    <img src={photo} alt="" className="size-14 shrink-0 rounded-full border-2 border-neon object-cover" />
                  ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-navy-600 font-display text-xl font-bold text-highlight">
                      {spot?.jersey_number ?? p.primary_position ?? "–"}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-display text-xl font-bold tracking-wide uppercase">{playerName(p)}</span>
                    <span className="block truncate font-mono text-xs text-muted">
                      {[spot?.jersey_number && `#${spot.jersey_number}`, p.primary_position, spot?.team?.name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {(sent ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">What you sent lately</h2>
          <ul className="divide-y divide-navy-700 rounded-xl border border-navy-700">
            {((sent ?? []) as { id: string; player_id: string; body: string | null; photo_path: string | null; drill_name: string | null; created_at: string; read_at: string | null }[]).map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-semibold">{nameOf(m.player_id)}</span>
                <span className="min-w-0 flex-1 truncate text-muted">
                  {[m.body, m.drill_name && `Drill: ${m.drill_name}`, m.photo_path && "Photo"].filter(Boolean).join(" · ")}
                </span>
                <span className="font-mono text-[10px] tracking-wider text-muted uppercase">{m.read_at ? "Seen" : "Not seen yet"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
