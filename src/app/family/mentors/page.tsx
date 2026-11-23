import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser, getPlayerFeaturesOff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MESSAGE_COLUMNS, signedMessagePhotoUrls, type MentorMessage } from "@/lib/message-photos";
import { EmptyState, Loading, eyebrowClass, groupLabelClass } from "@/components/ui";
import { MarkSeen } from "@/components/mark-seen";
import { MessageThread } from "@/components/message-thread";
import { ReplyForm } from "@/components/reply-form";
import { FocusBoard, NotesThread, type FocusItem, type MentorNote } from "@/components/mentor-work";
import { FamilyHeader } from "../header";
import { DaughterMentors, loadFamilyMentors } from "../mentors";
import { loadFamily } from "../family-data";
import { markParentConversationsRead, writeToMentor } from "../actions";

export const metadata: Metadata = { title: "Mentors · GGG.Cafe" };

export default function FamilyMentorsPage({ searchParams }: PageProps<"/family/mentors">) {
  return (
    <div className="flex flex-1 flex-col">
      <FamilyHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Suspense fallback={<Loading />}>
          <FamilyMentors searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

const heading = `mb-3 text-pink-soft ${groupLabelClass}`;

/**
 * Everything her mentors send her and write about her: the parents' own conversation with each mentor (user,
 * 2026-11-23: they answer; the player never sees it), her conversations with them (read only), focus areas and notes
 * with her coaches.
 */
async function FamilyMentors({ searchParams }: Pick<PageProps<"/family/mentors">, "searchParams">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { player } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("parent_player_logins");
  const daughters = (data ?? []) as { player_id: string; player_name: string }[];
  if (daughters.length === 0) {
    return (
      <EmptyState>
        Once your coach approves you, your daughter&apos;s mentors show up here.{" "}
        <Link href="/family" className="text-link underline underline-offset-2">
          Back to your page
        </Link>
      </EmptyState>
    );
  }
  const daughter = daughters.find((d) => d.player_id === player) ?? daughters[0];
  const first = daughter.player_name.split(" ")[0];
  const [family, familyMentors] = await Promise.all([loadFamily(), loadFamilyMentors(supabase)]);
  const { teamsOf } = family;
  const famDaughter = family.daughters.find((d) => d.player_id === daughter.player_id);
  const [{ data: msgRows }, { data: focusRows }, { data: noteRows }, { data: mentorRows }] = await Promise.all([
    supabase.from("mentor_messages").select(MESSAGE_COLUMNS).eq("player_id", daughter.player_id).order("created_at", { ascending: false }).limit(300),
    supabase.from("mentor_focus").select("id, mentor_id, title, details, status, updated_at").eq("player_id", daughter.player_id).order("created_at"),
    supabase
      .from("mentor_notes")
      .select("id, mentor_id, kind, discussed_on, body, author_id, author_name, author_role, created_at")
      .eq("player_id", daughter.player_id)
      .order("created_at"),
    supabase.from("mentors").select("user_id, display_name, specialty"),
  ]);
  const messages = ((msgRows ?? []) as MentorMessage[]).slice().reverse();
  const [photos, off] = await Promise.all([
    signedMessagePhotoUrls(supabase, messages.map((m) => m.photo_path)),
    getPlayerFeaturesOff(daughter.player_id),
  ]);
  const mentors = mentorRows ?? [];
  const nameOf = (id: string) => mentors.find((m) => m.user_id === id)?.display_name ?? "Mentor";
  const focus: FocusItem[] = (focusRows ?? []).map((f) => ({ ...f, mentor_name: nameOf(f.mentor_id) }));
  const notes = (noteRows ?? []) as (MentorNote & { mentor_id: string })[];
  const threads = [...new Set(notes.map((n) => n.mentor_id))];
  // the mentors who work with her now (her own approvals, and her teams' whole-team mentors): the parents can write to them
  const herTeams = famDaughter ? teamsOf(famDaughter).map((t) => t.id) : [];
  const current = new Set(
    familyMentors.links
      .filter((l) => l.status === "approved" && (l.player_id === daughter.player_id || (!l.player_id && l.team_id && herTeams.includes(l.team_id))))
      .map((l) => l.mentor_id),
  );
  const ofAudience = (audience: MentorMessage["audience"]) => messages.filter((m) => m.audience === audience);
  // a conversation with every mentor who works with her, and with any who wrote before
  const parentThreads = [...new Set([...current, ...ofAudience("parents").map((m) => m.mentor_id)])];
  const playerThreads = [...new Set(ofAudience("player").map((m) => m.mentor_id))];
  const mentorLabel = (id: string) => {
    const m = mentors.find((x) => x.user_id === id);
    return m ? [m.display_name, m.specialty].filter(Boolean).join(" · ") : (messages.find((x) => x.mentor_id === id && x.author_role === "mentor")?.sender_name ?? "Mentor");
  };

  return (
    <div className="flex flex-col gap-8">
      <Link href="/family" className="self-start text-sm text-muted hover:text-ink">
        <span aria-hidden="true">←</span> Family menu
      </Link>
      <header>
        <p className="font-sans text-xs tracking-[0.25em] text-pink-soft uppercase">Mentors</p>
        <h1 className="mt-1 text-4xl leading-none font-bold tracking-tight text-highlight uppercase">{daughter.player_name}</h1>
        {daughters.length > 1 && (
          <nav aria-label="Daughter" className="mt-3 flex flex-wrap gap-1.5">
            {daughters.map((d) => (
              <Link
                key={d.player_id}
                href={`/family/mentors?player=${d.player_id}`}
                aria-current={d.player_id === daughter.player_id ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  d.player_id === daughter.player_id ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
                }`}
              >
                {d.player_name.split(" ")[0]}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* her mentors: approve or decline a request, remove one (user, 2026-11-13: moved here from the family page) */}
      {famDaughter && <DaughterMentors daughter={famDaughter} teams={teamsOf(famDaughter)} links={familyMentors.links} mentors={familyMentors.mentors} />}

      <section aria-labelledby="your-conversations" className="flex flex-col gap-4">
        <div>
          <h2 id="your-conversations" className={heading}>
            You and her mentors
          </h2>
          <p className="-mt-1 text-sm text-muted">
            Summaries her mentors send you, and your answers. {first} doesn&apos;t see these. You get each new one by email too.
          </p>
        </div>
        <MarkSeen action={markParentConversationsRead.bind(null, daughter.player_id)} />
        {parentThreads.length === 0 ? (
          <p className="text-sm text-muted">Once a mentor works with {first}, you can write to them here.</p>
        ) : (
          parentThreads.map((mentorId) => {
            const name = nameOf(mentorId);
            return (
              <section key={mentorId} aria-label={`You and ${name}`} className="flex flex-col gap-4 rounded-2xl border border-navy-700 bg-navy-900/70 p-4 sm:p-5">
                <p className="font-display text-lg leading-tight font-bold tracking-wide uppercase">{mentorLabel(mentorId)}</p>
                <MessageThread
                  messages={ofAudience("parents").filter((m) => m.mentor_id === mentorId)}
                  viewer="parent"
                  me={user.id}
                  label={`Your conversation with ${name}`}
                  empty={`Nothing yet. Ask ${name} how it's going, or wait for their first summary.`}
                />
                {!current.has(mentorId) ? (
                  <p className="text-xs text-muted">{name} no longer works with {first}.</p>
                ) : off.has("mentor.parent_messages") ? (
                  <p className="text-xs text-muted">The head coach turned off messages between mentors and parents for now.</p>
                ) : (
                  <div className="border-t border-navy-700 pt-4">
                    <ReplyForm
                      action={writeToMentor.bind(null, daughter.player_id, mentorId)}
                      label={`Write to ${name}`}
                      placeholder={`Thanks for the work with ${first}. What should she practice at home this week?`}
                      hint={`${name} gets it by email. ${first} doesn't see it.`}
                    />
                  </div>
                )}
              </section>
            );
          })
        )}
      </section>

      <section aria-label="Focus areas">
        <h2 className={heading}>What they&apos;re working on with {first}</h2>
        <FocusBoard items={focus} empty="No focus areas yet." />
      </section>

      <section aria-label="Notes with her coaches">
        <h2 className={heading}>Notes with her coaches</h2>
        {threads.length === 0 ? (
          <p className="text-sm text-muted">No notes yet.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {threads.map((mentorId) => (
              <div key={mentorId}>
                <p className="mb-2 text-sm font-semibold">{nameOf(mentorId)}</p>
                <NotesThread notes={notes.filter((n) => n.mentor_id === mentorId)} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="her-conversations" className="flex flex-col gap-4">
        <div>
          <h2 id="her-conversations" className={heading}>
            {first} and her mentors
          </h2>
          <p className="-mt-1 text-sm text-muted">Their messages to {first} and her answers. You read them; only she and the mentor write here.</p>
        </div>
        {playerThreads.length === 0 ? (
          <p className="text-sm text-muted">No messages yet.</p>
        ) : (
          playerThreads.map((mentorId) => (
            <section key={mentorId} aria-label={`${first} and ${nameOf(mentorId)}`} className="flex flex-col gap-3 rounded-2xl border border-navy-700 p-4 sm:p-5">
              <p className={eyebrowClass}>{mentorLabel(mentorId)}</p>
              <MessageThread
                messages={ofAudience("player").filter((m) => m.mentor_id === mentorId)}
                viewer="staff"
                me={user.id}
                photoUrls={photos}
                label={`${first}'s conversation with ${nameOf(mentorId)}`}
                empty="No messages yet."
              />
            </section>
          ))
        )}
      </section>
    </div>
  );
}
