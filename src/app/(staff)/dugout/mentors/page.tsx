import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { playerName } from "@/lib/softball";
import { Card, EmptyState, Loading } from "@/components/ui";
import { ApproveMentor, AssignPlayer, CalendarToggle, RemoveMentor, RemoveMessage, UnassignPlayer } from "./mentors-client";

export const metadata: Metadata = { title: "Mentors · Coaches Dugout · GGG.Cafe" };

export default function MentorsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Mentors />
    </Suspense>
  );
}

type Mentor = { user_id: string; display_name: string; specialty: string | null; can_schedule: boolean };
type Pending = { user_id: string; email: string; display_name: string; specialty: string | null; created_at: string };
type Msg = { id: string; player_id: string; sender_name: string; body: string | null; photo_path: string | null; drill_name: string | null; created_at: string; read_at: string | null };
type Spot = { jersey_number: string | null; player: { id: string; first_name: string; preferred_name: string | null; last_name: string } | null; team: { name: string; is_own_team: boolean } | null };

const heading = "mb-3 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase";

async function Mentors() {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const admin = user.staff.role === "admin";
  const supabase = await createClient();
  const [{ data: mentorRows }, { data: links }, pendingResult, { data: spotRows }, { data: msgRows }] = await Promise.all([
    supabase.from("mentors").select("user_id, display_name, specialty, can_schedule").order("display_name"),
    supabase.from("mentor_players").select("mentor_id, player_id"),
    admin ? supabase.rpc("pending_mentors") : Promise.resolve({ data: [] }),
    supabase.from("roster_entries").select("jersey_number, player:players(id, first_name, preferred_name, last_name), team:teams(name, is_own_team)").eq("active", true),
    supabase
      .from("mentor_messages")
      .select("id, player_id, sender_name, body, photo_path, drill_name, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const mentors = (mentorRows ?? []) as Mentor[];
  const assigned = (links ?? []) as { mentor_id: string; player_id: string }[];
  const pending = (pendingResult.data ?? []) as Pending[];
  // players on our teams (active spots), for assigning
  const players = new Map<string, { id: string; name: string; label: string }>();
  for (const s of (spotRows ?? []) as unknown as Spot[]) {
    if (!s.player || !s.team?.is_own_team || players.has(s.player.id)) continue;
    const name = playerName(s.player as Parameters<typeof playerName>[0]);
    players.set(s.player.id, { id: s.player.id, name, label: [name, s.jersey_number && `#${s.jersey_number}`, s.team.name].filter(Boolean).join(" · ") });
  }
  const sorted = [...players.values()].sort((a, b) => a.name.localeCompare(b.name));
  const messages = (msgRows ?? []) as Msg[];
  const nameOf = (id: string) => players.get(id)?.name ?? "A player";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">Mentors</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Mentors and skill coaches (pitching, hitting, catching…) see only the players you assign them: her Goals, Pop Report and Mental GP,
          read-only. They can message her (with a photo or a drill to try), and add dates to her week if an admin turns that on. You can read
          every message here.
        </p>
      </div>

      {admin && (
        <section className={`rounded-2xl border p-4 sm:p-5 ${pending.length ? "border-pink/60 bg-pink/5" : "border-navy-700"}`} aria-label="Mentor sign-ups">
          <h3 className={heading}>Waiting for approval ({pending.length})</h3>
          {pending.length === 0 ? (
            <p className="text-sm text-muted">
              Nobody waiting. Mentors sign up at <span className="font-mono">/register</span> and pick &quot;Mentor&quot;.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {pending.map((p) => (
                <li key={p.user_id} className="flex flex-col gap-2 rounded-xl border border-navy-700 p-3">
                  <p className="text-sm">
                    <span className="font-semibold">{p.display_name || "No name"}</span> <span className="text-muted">· {p.email} · signed up {formatDay(p.created_at.slice(0, 10))}</span>
                  </p>
                  <ApproveMentor userId={p.user_id} name={p.display_name} specialty={p.specialty} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {mentors.length === 0 ? (
        <EmptyState>No mentors yet.{admin ? " Approve one above once she signs up." : " An admin approves them."}</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {mentors.map((m) => {
            const mine = assigned.filter((a) => a.mentor_id === m.user_id).map((a) => a.player_id);
            return (
              <Card key={m.user_id} title={m.display_name}>
                <div className="flex flex-col gap-3">
                  <p className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-mono text-xs tracking-wider text-pink-soft uppercase">{m.specialty ?? "Mentor"}</span>
                    {admin ? (
                      <CalendarToggle userId={m.user_id} on={m.can_schedule} />
                    ) : (
                      <span className="text-xs text-muted">Calendar dates: {m.can_schedule ? "on" : "off"}</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {mine.length === 0 ? (
                      <span className="text-sm text-muted">No players assigned.</span>
                    ) : (
                      mine.map((id) => <UnassignPlayer key={id} mentorId={m.user_id} playerId={id} name={nameOf(id)} canEdit={editor} />)
                    )}
                  </div>
                  {editor && <AssignPlayer mentorId={m.user_id} options={sorted.filter((p) => !mine.includes(p.id)).map((p) => ({ id: p.id, label: p.label }))} />}
                  {admin && (
                    <span className="self-start">
                      <RemoveMentor userId={m.user_id} name={m.display_name} />
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <section>
        <h3 className={heading}>Recent messages to players</h3>
        {messages.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          <ul className="divide-y divide-navy-700 rounded-xl border border-navy-700">
            {messages.map((msg) => (
              <li key={msg.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="w-24 shrink-0 font-display text-muted tabular-nums">{formatDay(msg.created_at.slice(0, 10))}</span>
                <span className="font-semibold">
                  {msg.sender_name} → <Link href={`/players/${msg.player_id}/messages`} className="hover:underline">{nameOf(msg.player_id)}</Link>
                </span>
                <span className="min-w-0 flex-1 truncate text-muted">
                  {[msg.body, msg.drill_name && `Drill: ${msg.drill_name}`, msg.photo_path && "Photo"].filter(Boolean).join(" · ")}
                </span>
                <span className="font-mono text-[10px] tracking-wider text-muted uppercase">{msg.read_at ? "Seen" : "New"}</span>
                {editor && <RemoveMessage id={msg.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
