import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { MESSAGE_COLUMNS, signedMessagePhotoUrls, type MentorMessage } from "@/lib/message-photos";
import { Badge, EmptyState, Loading } from "@/components/ui";
import { FocusBoard, NotesThread, type FocusItem, type MentorNote } from "@/components/mentor-work";
import { FamilyHeader } from "../header";

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

const heading = "mb-3 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

/** Everything her mentors send her and write about her: messages (all of them), focus areas and notes with her coaches. */
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
  const [{ data: msgRows }, { data: focusRows }, { data: noteRows }, { data: mentorRows }] = await Promise.all([
    supabase.from("mentor_messages").select(MESSAGE_COLUMNS).eq("player_id", daughter.player_id).order("created_at", { ascending: false }).limit(50),
    supabase.from("mentor_focus").select("id, mentor_id, title, details, status, updated_at").eq("player_id", daughter.player_id).order("created_at"),
    supabase
      .from("mentor_notes")
      .select("id, mentor_id, kind, discussed_on, body, author_id, author_name, author_role, created_at")
      .eq("player_id", daughter.player_id)
      .order("created_at"),
    supabase.from("mentors").select("user_id, display_name, specialty"),
  ]);
  const messages = (msgRows ?? []) as MentorMessage[];
  const photos = await signedMessagePhotoUrls(supabase, messages.map((m) => m.photo_path));
  const mentors = mentorRows ?? [];
  const nameOf = (id: string) => mentors.find((m) => m.user_id === id)?.display_name ?? "Mentor";
  const focus: FocusItem[] = (focusRows ?? []).map((f) => ({ ...f, mentor_name: nameOf(f.mentor_id) }));
  const notes = (noteRows ?? []) as (MentorNote & { mentor_id: string })[];
  const threads = [...new Set(notes.map((n) => n.mentor_id))];

  return (
    <div className="flex flex-col gap-8">
      <Link href="/family" className="self-start text-sm text-muted hover:text-ink">
        ← Your page
      </Link>
      <header>
        <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">Mentors</p>
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

      <section aria-label="Messages">
        <h2 className={heading}>Messages to {first}</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-muted">No messages yet.</p>
        ) : (
          <ul className="divide-y divide-navy-700 rounded-xl border border-navy-700">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 text-sm">
                <span className="w-24 shrink-0 font-display text-muted tabular-nums">{formatDay(m.created_at.slice(0, 10))}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{m.sender_name}</span>
                  {m.body && <span className="block whitespace-pre-wrap">{m.body}</span>}
                  {m.drill_name && (
                    <span className="block text-pink-soft">
                      Drill: {m.drill_name}
                      {m.drill_video_url && (
                        <>
                          {" · "}
                          <a href={m.drill_video_url} target="_blank" rel="noreferrer" className="text-link underline underline-offset-2">
                            video
                          </a>
                        </>
                      )}
                    </span>
                  )}
                  {m.photo_path && photos.get(m.photo_path) && (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
                    <img src={photos.get(m.photo_path)!} alt={`Photo from ${m.sender_name}`} className="mt-2 h-28 rounded-lg object-cover" />
                  )}
                </span>
                {m.shared_with_coaches && <Badge tone="pink">Shared with coaches</Badge>}
                <span className="font-mono text-2xs tracking-wider text-muted uppercase">{m.read_at ? "Seen" : "Not seen yet"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
