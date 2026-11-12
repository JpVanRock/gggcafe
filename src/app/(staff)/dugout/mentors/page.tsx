import type { Metadata } from "next";
import Link from "next/link";
import { requireHeadCoachPage } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { loadRoster } from "@/lib/roster";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Disclosure, EmptyState, buttonStyles } from "@/components/ui";
import { loadDugoutTeam } from "../data";
import { NoOwnTeam, TeamPicker } from "../team-picker";
import { decideMentorRequest, removeMentor, removeMentorLink, removeMentorMessage } from "./actions";

export const metadata: Metadata = { title: "Mentors · Coaches Dugout · GGG.Cafe" };

type Link_ = { id: string; mentor_id: string; team_id: string | null; player_id: string | null; player_name: string | null; status: string; requested_at: string };
type Mentor = { user_id: string; display_name: string; specialty: string | null };
type Msg = { id: string; player_id: string; sender_id: string; sender_name: string; body: string | null; photo_path: string | null; drill_name: string | null; created_at: string; read_at: string | null; shared_with_coaches: boolean };

const heading = "mb-3 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

/**
 * What great mentors do, in the words of the G3 Leadership Guide's lessons (Relationships, Listening,
 * Accountability and Inspiration, The Best Players, Keep Climbing). User, 2026-11-12: the Mentors tab
 * opens with this and the team motto instead of the how-it-works paragraph.
 */
const MENTOR_WAYS: [string, string][] = [
  ["Earn trust first.", "People follow people they trust. The relationship comes before anything you'll ask of her."],
  ["Listen more than you talk.", "When you do talk, make sure she understands you."],
  ["Lift her higher.", "Hold the standard, then help her go further than she thought she could."],
  ["Make the people around you better.", "That's leadership you can see from the bleachers."],
  ["Train the next leader.", "One day she'll mentor someone too. That's your legacy."],
];

function Decide({ id, who }: { id: string; who: string }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <ActionForm action={decideMentorRequest} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="link_id" value={id} />
        <input type="hidden" name="decision" value="approve" />
        <SubmitButton pendingLabel="Saving…">Approve</SubmitButton>
      </ActionForm>
      <ActionForm action={decideMentorRequest} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="link_id" value={id} />
        <input type="hidden" name="decision" value="decline" />
        <ConfirmSubmit message={`Decline ${who}?`} confirmLabel="Decline" className={buttonStyles("secondary")}>
          Decline
        </ConfirmSubmit>
      </ActionForm>
    </span>
  );
}

export default async function MentorsPage({ searchParams }: PageProps<"/dugout/mentors">) {
  const user = await requireHeadCoachPage();
  const admin = user.staff.role === "admin";
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const roster = await loadRoster(supabase, team.id, { order: "name" });
  const ids = roster.map((p) => p.id);
  const [{ data: linkRows }, { data: mentorRows }, { data: msgRows }, { data: culture }] = await Promise.all([
    supabase
      .from("mentor_links")
      .select("id, mentor_id, team_id, player_id, player_name, status, requested_at")
      .neq("status", "declined")
      .order("requested_at"),
    supabase.from("mentors").select("user_id, display_name, specialty").order("display_name"),
    // RLS: coaches get the messages mentors shared with them; admins get every one
    ids.length
      ? supabase
          .from("mentor_messages")
          .select("id, player_id, sender_id, sender_name, body, photo_path, drill_name, created_at, read_at, shared_with_coaches")
          .in("player_id", ids)
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
    // the team motto heads the page (Coaches Dugout → Culture)
    supabase.from("team_culture").select("motto").eq("team_id", team.id).maybeSingle(),
  ]);
  const mentors = (mentorRows ?? []) as Mentor[];
  // this team's: whole-team links for it, and one-player links for players on its roster
  const links = ((linkRows ?? []) as Link_[]).filter((l) => (l.player_id ? ids.includes(l.player_id) : l.team_id === team.id));
  const messages = (msgRows ?? []) as Msg[];
  const mentorOf = (id: string) => mentors.find((m) => m.user_id === id);
  const who = (id: string) => mentorOf(id)?.display_name ?? "A mentor";
  const nameOf = (id: string) => roster.find((p) => p.id === id)?.name ?? "A player";
  const pendingTeam = links.filter((l) => l.status === "pending" && !l.player_id);
  const pendingPlayer = links.filter((l) => l.status === "pending" && l.player_id);
  const approved = links.filter((l) => l.status === "approved");
  const working = [...new Set(approved.map((l) => l.mentor_id))].sort((a, b) => who(a).localeCompare(who(b)));

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/mentors" />
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">Mentors</h2>
          {culture?.motto && (
            <p className="mt-2 font-display text-xl font-bold tracking-wide text-ink uppercase">
              <span className="text-link">“</span>
              {culture.motto}
              <span className="text-link">”</span>
            </p>
          )}
          <p className="mt-2 max-w-3xl text-ink/90">
            The best players make the people around them better, and the best mentors do the same. Every mentor here is helping a player
            become the leader she&apos;ll be for someone else one day.
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {MENTOR_WAYS.map(([lead, rest], i) => (
            <li key={lead} className="rounded-xl border border-navy-700 bg-navy-900/60 p-3">
              <span className="font-display text-sm font-bold text-link tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-1 text-sm font-semibold text-ink">{lead}</p>
              <p className="mt-0.5 text-xs text-muted">{rest}</p>
            </li>
          ))}
        </ol>
        {admin && (
          <Link href="/view-as" className="self-start text-sm font-semibold text-link hover:underline">
            View as a parent or mentor <span aria-hidden="true">→</span>
          </Link>
        )}
        <Disclosure summary="How mentoring works">
          <p className="max-w-3xl text-sm text-muted">
            Mentors and skill coaches (pitching, hitting, catching…) ask with the team code. You approve a mentor for the whole team; a player&apos;s parents
            approve one for their daughter. Mentors read her Goals, Pop Report and Mental GP, message her, add training to her week, and keep notes here with
            you: what they&apos;re working on, what&apos;s working, and what you talked about. Messages to players are private to the player, her parents and the
            admins unless the mentor shares one with you.
          </p>
        </Disclosure>
      </div>

      <section aria-label="Waiting for approval" className={`rounded-2xl border p-4 sm:p-5 ${pendingTeam.length ? "border-pink/60 bg-pink/5" : "border-navy-700"}`}>
        <h3 className={heading}>Waiting for approval ({pendingTeam.length})</h3>
        {pendingTeam.length === 0 && pendingPlayer.length === 0 ? (
          <p className="text-sm text-muted">
            Nobody waiting. Mentors sign up at <span className="font-mono">/register</span>, pick &quot;Mentor&quot; and enter the team code.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingTeam.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-navy-700 p-3">
                <span className="text-sm">
                  <span className="font-semibold">{who(l.mentor_id)}</span>
                  {mentorOf(l.mentor_id)?.specialty && <span className="text-muted"> · {mentorOf(l.mentor_id)?.specialty}</span>}
                  <span className="text-muted"> · asks to work with the whole team · {formatDay(l.requested_at.slice(0, 10))}</span>
                </span>
                <Decide id={l.id} who={who(l.mentor_id)} />
              </li>
            ))}
            {pendingPlayer.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-navy-700 p-3">
                <span className="text-sm">
                  <span className="font-semibold">{who(l.mentor_id)}</span>
                  <span className="text-muted"> · asks to mentor {nameOf(l.player_id!)}</span>
                </span>
                {admin ? <Decide id={l.id} who={who(l.mentor_id)} /> : <Badge tone="pink">Waiting for her parents</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {working.length === 0 ? (
        <EmptyState>No mentors work with this team yet.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {working.map((mentorId) => {
            const mine = approved.filter((l) => l.mentor_id === mentorId);
            const whole = mine.find((l) => !l.player_id);
            const players = mine.filter((l) => l.player_id);
            return (
              <Card key={mentorId} title={who(mentorId)}>
                <div className="flex flex-col gap-3">
                  <p className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-xs tracking-wider text-pink-soft uppercase">{mentorOf(mentorId)?.specialty ?? "Mentor"}</span>
                    {admin && (
                      <Link href={`/view-as/mentor/${mentorId}`} className="text-xs font-semibold text-link hover:underline" aria-label={`View as ${who(mentorId)}`}>
                        View as <span aria-hidden="true">→</span>
                      </Link>
                    )}
                  </p>
                  {whole && (
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge tone="neon">Whole team · {roster.length} players</Badge>
                      <ActionForm action={removeMentorLink} className="flex items-center gap-2">
                        <input type="hidden" name="link_id" value={whole.id} />
                        <ConfirmSubmit
                          message={`Remove ${who(mentorId)} from the whole team? Players her parents approved stay.`}
                          confirmLabel="Remove"
                          tone="danger"
                          className={buttonStyles("link", "text-muted")}
                        >
                          Remove from team
                        </ConfirmSubmit>
                      </ActionForm>
                    </div>
                  )}
                  {players.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {players.map((l) => (
                        <li key={l.id} className="inline-flex items-center gap-2 rounded-full border border-navy-600 px-3 py-0.5 text-xs font-semibold">
                          {nameOf(l.player_id!)} <span className="font-normal text-muted">· parents approved</span>
                          {admin && (
                            <ActionForm action={removeMentorLink} className="inline-flex items-center">
                              <input type="hidden" name="link_id" value={l.id} />
                              <ConfirmSubmit message={`Remove ${who(mentorId)} from ${nameOf(l.player_id!)}?`} confirmLabel="Remove" tone="danger" className={buttonStyles("link", "text-xs text-muted")}>
                                Remove
                              </ConfirmSubmit>
                            </ActionForm>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href={`/dugout/mentors/${mentorId}?team=${team.id}`} className={buttonStyles("link", "self-start")}>
                    Focus areas &amp; notes →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <section>
        <h3 className={heading}>{admin ? "Messages to this team's players" : "Messages mentors shared with you"}</h3>
        {messages.length === 0 ? (
          <p className="text-sm text-muted">{admin ? "None yet." : "None yet. Mentors choose which messages to share with the coaches."}</p>
        ) : (
          <ul className="divide-y divide-navy-700 rounded-xl border border-navy-700">
            {messages.map((msg) => (
              <li key={msg.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="w-24 shrink-0 font-display text-muted tabular-nums">{formatDay(msg.created_at.slice(0, 10))}</span>
                <span className="font-semibold">
                  {msg.sender_name} →{" "}
                  <Link href={`/players/${msg.player_id}/messages`} className="hover:underline">
                    {nameOf(msg.player_id)}
                  </Link>
                </span>
                <span className="min-w-0 flex-1 truncate text-muted">
                  {[msg.body, msg.drill_name && `Drill: ${msg.drill_name}`, msg.photo_path && "Photo"].filter(Boolean).join(" · ")}
                </span>
                {admin && <Badge tone={msg.shared_with_coaches ? "pink" : "neutral"}>{msg.shared_with_coaches ? "Shared" : "Private"}</Badge>}
                <span className="font-mono text-2xs tracking-wider text-muted uppercase">{msg.read_at ? "Seen" : "New"}</span>
                <ActionForm action={removeMentorMessage} className="flex items-center gap-2">
                  <input type="hidden" name="message_id" value={msg.id} />
                  <ConfirmSubmit message="Remove this message? The player won't see it any more." confirmLabel="Remove" tone="danger" className={buttonStyles("link", "text-xs text-muted")}>
                    Remove
                  </ConfirmSubmit>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      {admin && mentors.length > 0 && (
        <Disclosure summary={`All mentor accounts (${mentors.length})`}>
          <ul className="divide-y divide-navy-700 rounded-xl border border-navy-700">
            {mentors.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-semibold">{m.display_name}</span>
                <span className="text-muted">{m.specialty ?? "Mentor"}</span>
                <ActionForm action={removeMentor} className="ml-auto flex items-center gap-2">
                  <input type="hidden" name="mentor_id" value={m.user_id} />
                  <ConfirmSubmit
                    message={`Remove ${m.display_name} as a mentor? She loses access to every player and team. Messages she sent stay.`}
                    confirmLabel="Remove"
                    tone="danger"
                    className={buttonStyles("link", "text-muted")}
                  >
                    Remove mentor
                  </ConfirmSubmit>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}
