import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getMentor, getMentorAccess } from "@/lib/auth";
import { formatDay, todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { signedPhotoUrls } from "@/lib/player-photos";
import { MESSAGE_COLUMNS, signedMessagePhotoUrls, type MentorMessage } from "@/lib/message-photos";
import { GOAL_METHOD_LABEL, isUuid, playerName, type Player } from "@/lib/softball";

import {
  currentRostering, loadHarada, loadMentalPlan, loadMetricOptions, loadMovementAndHitting, loadPopReport, loadSmartGoals,
} from "@/app/(staff)/players/[playerId]/data";
import { GoalsDetail } from "@/app/(staff)/players/[playerId]/goals";
import { SmartGoalsPanel } from "@/app/(staff)/players/[playerId]/smart";
import { PopDetail } from "@/app/(staff)/players/[playerId]/pop-report";
import { MeasurementsBySeason, loadMeasurements } from "@/app/(staff)/players/[playerId]/measurements";
import { BestVersion } from "@/app/(staff)/players/[playerId]/best-version";
import type { BestVersionAnswers } from "@/lib/best-version";
import { MentalDetail } from "@/app/(staff)/players/[playerId]/mental";
import { MentalTools } from "@/app/(staff)/players/[playerId]/mental-game";
import { loadMentalTools } from "@/app/(staff)/players/[playerId]/mental-data";
import { MessageForm, RemoveMessage, TrainingForm, type LibraryDrill } from "../../mentor-client";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui";
import { FocusBoard, FocusControls, FocusForm, NoteForm, NotesThread, RemoveNote, type FocusItem, type MentorNote } from "@/components/mentor-work";
import { addMentorFocus, addMentorNote, removeMentorFocus, removeMentorNote, setMentorFocus, setMessageSharing } from "../../actions";
import { TrainingList, loadTraining } from "../../parts";

export const metadata: Metadata = { title: "Player · Mentor · GGG.Cafe" };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-navy-700 bg-navy-900/70 p-5 sm:p-6">
      <h2 className="text-2xl leading-tight font-bold tracking-wide text-highlight uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default async function MentorPlayerPage({ params, searchParams }: PageProps<"/mentor/players/[playerId]">) {
  const { playerId } = await params;
  const { year } = await searchParams;
  if (!isUuid(playerId)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const mentor = await getMentor();
  if (!mentor) redirect("/mentor");
  // her players only
  const access = await getMentorAccess();
  if (!access.menteeIds.includes(playerId)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("players").select("*").eq("id", playerId).maybeSingle();
  const player = data as Player | null;
  if (!player) notFound();
  const first = player.preferred_name || player.first_name;
  const method = player.goal_method ?? "harada";

  const [chart, smartGoals, metricOptions, pop, mental, styles, { data: drillRows }, { data: sentRows }, training, measurements, { data: best }, { data: focusRows }, { data: noteRows }, mentalTools] = await Promise.all([
    loadHarada(supabase, player.id),
    loadSmartGoals(supabase, player.id),
    loadMetricOptions(supabase),
    loadPopReport(supabase, player.id),
    loadMentalPlan(supabase, player.id),
    loadMovementAndHitting(supabase, player.id),
    supabase.from("practice_drills").select("id, name, video_url").order("name"),
    supabase.from("mentor_messages").select(MESSAGE_COLUMNS).eq("player_id", player.id).eq("sender_id", mentor.userId).order("created_at", { ascending: false }).limit(20),
    loadTraining(supabase, mentor.userId, [player.id]),
    // mentors can't read team lists: her defaults plus whatever she has been measured on
    loadMeasurements(supabase, player, null),
    supabase.from("player_best_version").select("answers").eq("player_id", player.id).maybeSingle(),
    supabase.from("mentor_focus").select("id, title, details, status, updated_at").eq("player_id", player.id).eq("mentor_id", mentor.userId).order("created_at"),
    supabase
      .from("mentor_notes")
      .select("id, kind, discussed_on, body, author_id, author_name, author_role, created_at")
      .eq("player_id", player.id)
      .eq("mentor_id", mentor.userId)
      .order("created_at"),
    // her signals, intensity checks and self-scans (never the journal)
    loadMentalTools(supabase, player.id, todayISO()),
  ]);
  const focus = (focusRows ?? []) as FocusItem[];
  const notes = (noteRows ?? []) as MentorNote[];
  const sent = (sentRows ?? []) as MentorMessage[];
  const [photos, messagePhotos] = await Promise.all([
    signedPhotoUrls(supabase, [player.photo_path]),
    signedMessagePhotoUrls(supabase, sent.map((m) => m.photo_path)),
  ]);
  const spot = currentRostering(pop);

  return (
    <div className="flex flex-col gap-8">
      <Link href="/mentor" className="self-start text-sm text-muted hover:text-ink">
        ← My players
      </Link>
      <header className="flex flex-wrap items-center gap-5">
        {player.photo_path && photos.get(player.photo_path) && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
          <img src={photos.get(player.photo_path)!} alt="" className="size-20 rounded-full border-2 border-neon object-cover" />
        )}
        <div>
          <h1 className="text-4xl leading-none font-bold tracking-tight text-highlight uppercase sm:text-5xl">
            {first} <span className="text-ink">{player.last_name}</span>
          </h1>
          <p className="mt-2 font-mono text-sm text-muted">
            {[spot?.jersey_number && `#${spot.jersey_number}`, player.primary_position, spot?.team?.name].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      <Panel title={`Message ${first}`}>
        <MessageForm playerId={player.id} mentorId={mentor.userId} playerName={first} drills={(drillRows ?? []) as LibraryDrill[]} />
        {sent.length > 0 && (
          <ul className="mt-2 divide-y divide-navy-700 rounded-xl border border-navy-700">
            {sent.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 text-sm">
                <span className="w-24 shrink-0 font-display text-muted tabular-nums">{formatDay(m.created_at.slice(0, 10))}</span>
                <span className="min-w-0 flex-1">
                  {m.body && <span className="block whitespace-pre-wrap">{m.body}</span>}
                  {m.drill_name && <span className="block text-pink-soft">Drill: {m.drill_name}</span>}
                  {m.photo_path && messagePhotos.get(m.photo_path) && (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
                    <img src={messagePhotos.get(m.photo_path)!} alt="Photo sent" className="mt-2 h-20 rounded-lg object-cover" />
                  )}
                </span>
                <span className="font-mono text-2xs tracking-wider text-muted uppercase">{m.read_at ? "Seen" : "Not seen yet"}</span>
                <ActionForm action={setMessageSharing} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="message_id" value={m.id} />
                  <input type="hidden" name="shared" value={m.shared_with_coaches ? "0" : "1"} />
                  {m.shared_with_coaches && <Badge tone="pink">Shared with coaches</Badge>}
                  <SubmitButton variant="link" pendingLabel="Saving…" className="text-xs">
                    {m.shared_with_coaches ? "Stop sharing" : "Share with coaches"}
                  </SubmitButton>
                </ActionForm>
                <RemoveMessage id={m.id} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Working with her coaches">
        <p className="-mt-2 text-sm text-muted">
          Keep her coaches on the same page: what you&apos;re working on, what&apos;s working, and what you talked about. Her coaches and parents read this; {first}{" "}
          doesn&apos;t.
        </p>
        <FocusBoard
          items={focus}
          empty="No focus areas yet. Add what you're working on with her."
          controls={(item) => <FocusControls item={item} move={setMentorFocus} remove={removeMentorFocus} />}
        />
        <FocusForm action={addMentorFocus} hidden={{ player_id: player.id }} />
        <h3 className="mt-2 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Notes with her coaches</h3>
        <NotesThread
          notes={notes}
          empty="No notes yet. After you talk with her coaches, add a discussion summary."
          controls={(n) => (n.author_id === mentor.userId ? <RemoveNote id={n.id} action={removeMentorNote} /> : null)}
        />
        <NoteForm action={addMentorNote} hidden={{ player_id: player.id }} placeholder="Talked with Coach after practice: her drop ball is landing low. Next: same drill, add a target." />
      </Panel>

      <Panel title={`${first}'s week`}>
        <p className="-mt-2 text-sm text-muted">Training you add shows up in her This Week in Softball on those days, marked as from you.</p>
        <TrainingForm single={{ id: player.id, label: first }} />
        <TrainingList rows={training} nameOf={() => first} />
      </Panel>

      <Panel title={`${first}'s Goals`}>
        <BestVersion playerId={player.id} answers={(best?.answers ?? {}) as BestVersionAnswers} canEdit={false} safety={null} />
        <p className="-mt-2 font-mono text-xs tracking-[0.2em] text-pink-soft uppercase">{GOAL_METHOD_LABEL[method]}</p>
        {method === "smart" ? (
          <SmartGoalsPanel playerId={player.id} goals={smartGoals} metrics={pop.metrics} metricOptions={metricOptions} canEdit={false} />
        ) : (
          <GoalsDetail playerId={player.id} chart={chart} canEdit={false} />
        )}
      </Panel>

      <Panel title={`${first}'s Pop Report`}>
        <PopDetail
          player={player}
          pop={pop}
          canEdit={false}
          canAct={false}
          styles={styles}
          movementAccess={styles.movement.length ? "open" : "hidden"}
          measurements={
            <MeasurementsBySeason
              playerId={player.id}
              data={measurements}
              year={typeof year === "string" && /^\d{4}$/.test(year) ? Number(year) : null}
              basePath={`/mentor/players/${player.id}`}
              canEdit={false}
            />
          }
        />
      </Panel>

      <Panel title="Mental GP">
        <MentalDetail playerId={player.id} plan={mental} canEdit={false} />
        <MentalTools playerId={player.id} plan={mental} {...mentalTools} today={todayISO()} canEdit={false} />
      </Panel>

      <p className="text-xs text-muted">
        You see {playerName(player)} because {access.playerIds.includes(player.id) ? "her parents approved you" : "her head coach approved you for the team"}. Her
        parents and the site admins can read every message you send her; her coaches read only the ones you share.
      </p>
    </div>
  );
}
