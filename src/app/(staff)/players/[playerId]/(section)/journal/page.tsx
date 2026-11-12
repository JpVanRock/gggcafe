import type { Metadata } from "next";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDay, todayISO } from "@/lib/dates";
import { JOURNAL_BUCKET, formatSeconds } from "@/lib/journal";
import { Badge, EmptyState, RECENT_LIMIT, ShowAllLink, eyebrowClass } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { loadPlayer } from "../../section-data";
import { firstName } from "../../data";
import { SectionShell } from "../section-shell";
import { EditableEntry, JournalEntryForm, type JournalEntryValues, type JournalMentor } from "../../journal-client";
import { deleteJournalEntry, shareJournalEntry } from "../../journal-actions";

export const metadata: Metadata = { title: "My Journal · GGG.Cafe" };

const COLUMNS = "id, session_date, mentor_id, mentor_name, topic, notes, audio_path, audio_seconds, shared_with_mentor";

/** One entry as it reads (her view and her parents'). */
function Entry({ entry, mentor, audioUrl }: { entry: JournalEntryValues; mentor: string | null; audioUrl: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={`${eyebrowClass} flex flex-wrap items-center gap-2`}>
        <span>
          {formatDay(entry.session_date)}
          {mentor ? ` · with ${mentor}` : ""}
        </span>
        {entry.shared_with_mentor && <Badge tone="pink">Shared with {mentor ?? "her mentor"}</Badge>}
      </p>
      {entry.topic && <p className="font-display text-lg leading-tight font-bold tracking-wide uppercase">{entry.topic}</p>}
      {entry.notes && <p className="max-w-3xl text-sm whitespace-pre-wrap text-ink/90">{entry.notes}</p>}
      {entry.audio_path &&
        (audioUrl ? (
          <div className="flex flex-wrap items-center gap-3">
            <audio controls preload="none" src={audioUrl} className="h-10 max-w-full" />
            {entry.audio_seconds && <span className="font-display text-xs text-muted tabular-nums">{formatSeconds(entry.audio_seconds)}</span>}
          </div>
        ) : (
          <p className="text-xs text-muted">Voice memo (couldn&apos;t load it; reload the page).</p>
        ))}
    </div>
  );
}

// My Journal (user, 2026-11-12): her notes and voice memos from sessions with her mentors.
// She writes it; her approved parents read it (view as player); she can share an entry
// with that mentor. Coaches don't read it (the database gives them nothing).
export default async function JournalPage({ params, searchParams }: PageProps<"/players/[playerId]/journal">) {
  const { playerId } = await params;
  const { entries: show } = await searchParams;
  const access = await requirePlayerPage(playerId, "player.journal");
  const supabase = await createClient();
  const player = await loadPlayer(supabase, playerId);
  const name = firstName(player);
  const reader = access.isSelf || access.isParent;

  if (!reader) {
    return (
      <SectionShell title="My Journal" subtitle="Notes from mentor sessions">
        <EmptyState title="Private">
          {name}&apos;s journal is hers: only she and her parents read it, and a mentor reads an entry she shares with them. Coaches don&apos;t see it.
        </EmptyState>
      </SectionShell>
    );
  }

  const all = show === "all";
  const [{ data: rows, count }, { data: mentorRows }] = await Promise.all([
    supabase
      .from("player_journal_entries")
      .select(COLUMNS, { count: "exact" })
      .eq("player_id", player.id)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(all ? 1000 : RECENT_LIMIT),
    supabase.rpc("player_mentors", { p_player_id: player.id }),
  ]);
  const entries = (rows ?? []) as JournalEntryValues[];
  const mentors = (mentorRows ?? []) as JournalMentor[];
  const mentorName = new Map(mentors.map((m) => [m.mentor_id, m.display_name]));
  const paths = entries.flatMap((e) => (e.audio_path ? [e.audio_path] : []));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(JOURNAL_BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  const today = todayISO();
  const who = (e: JournalEntryValues) => (e.mentor_id ? (mentorName.get(e.mentor_id) ?? "a former mentor") : e.mentor_name);

  return (
    <SectionShell title="My Journal" subtitle={access.isSelf ? "Notes from your mentor sessions" : `${name}'s notes from mentor sessions`}>
      <div className="flex flex-col gap-10">
        {access.isSelf && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">New entry</h2>
              <p className="mt-1 max-w-3xl text-sm text-muted">
                Right after a session, while it&apos;s fresh: what you worked on, the cues that clicked, what to do before next time. Type it, record
                it, or both. It&apos;s yours: your parents can read it, your coaches can&apos;t, and a mentor sees only what you share.
              </p>
            </div>
            <JournalEntryForm playerId={player.id} mentors={mentors} today={today} />
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">
            {count ? `${count} ${count === 1 ? "entry" : "entries"}` : "Entries"}
          </h2>
          {entries.length === 0 ? (
            <EmptyState>{access.isSelf ? "Nothing yet. Your first entry goes above." : `${name} hasn't written in her journal yet.`}</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-navy-800">
              {entries.map((e) => {
                const audioUrl = e.audio_path ? (urls.get(e.audio_path) ?? null) : null;
                const read = <Entry entry={e} mentor={who(e)} audioUrl={audioUrl} />;
                return (
                  <li key={e.id} className="py-5 first:pt-0">
                    {access.isSelf ? (
                      <EditableEntry playerId={player.id} mentors={mentors} today={today} entry={e} audioUrl={audioUrl}>
                        {read}
                        <div className="flex flex-wrap items-center gap-4">
                          {e.mentor_id && mentorName.has(e.mentor_id) && (
                            <ActionForm action={shareJournalEntry}>
                              <input type="hidden" name="player_id" value={player.id} />
                              <input type="hidden" name="id" value={e.id} />
                              {!e.shared_with_mentor && <input type="hidden" name="share" value="on" />}
                              <button type="submit" className="text-sm font-semibold text-link hover:underline">
                                {e.shared_with_mentor ? "Stop sharing" : `Share with ${mentorName.get(e.mentor_id)}`}
                              </button>
                            </ActionForm>
                          )}
                          <ActionForm action={deleteJournalEntry}>
                            <input type="hidden" name="player_id" value={player.id} />
                            <input type="hidden" name="id" value={e.id} />
                            <ConfirmSubmit message="Delete this entry? Its voice memo goes too. This can't be undone." className="text-sm text-muted hover:text-danger">
                              Delete
                            </ConfirmSubmit>
                          </ActionForm>
                        </div>
                      </EditableEntry>
                    ) : (
                      read
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <ShowAllLink shown={entries.length} total={count ?? entries.length} href={`/players/${player.id}/journal?entries=all`} noun="entries" />
        </section>
      </div>
    </SectionShell>
  );
}
