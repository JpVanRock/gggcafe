"use client";

// My Journal (user, 2026-11-12): the entry form, with a voice memo recorded in the browser
// and uploaded to her own folder in the private journal-audio bucket.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, FormMessage, buttonStyles, fieldClass, inputClass, secondaryButtonClass } from "@/components/ui";
import {
  JOURNAL_BUCKET, JOURNAL_MENTOR_NAME_MAX, JOURNAL_NOTES_MAX, JOURNAL_TOPIC_MAX, MEMO_MAX_BYTES, MEMO_MAX_SECONDS, RECORDING_TYPES,
  formatSeconds, memoFileType, memoPath,
} from "@/lib/journal";
import { discardJournalMemo, saveJournalEntry } from "./journal-actions";

export type JournalMentor = { mentor_id: string; display_name: string; specialty: string | null };
export type JournalEntryValues = {
  id: string;
  session_date: string;
  mentor_id: string | null;
  mentor_name: string | null;
  topic: string | null;
  notes: string | null;
  audio_path: string | null;
  audio_seconds: number | null;
  shared_with_mentor: boolean;
};

type Memo = { path: string; seconds: number; url: string | null; fresh: boolean };

/** Record, listen back, record again or remove. Uploads when she stops. */
function VoiceMemo({ playerId, memo, onChange }: { playerId: string; memo: Memo | null; onChange: (memo: Memo | null) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "uploading">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);

  // stop the microphone if she leaves mid-recording
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function start() {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't record audio. Type your notes instead.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("The microphone is blocked. Allow it in your browser's settings for this site, then try again.");
      return;
    }
    const mime = RECORDING_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      const seconds = Math.max(1, Math.round((Date.now() - started.current) / 1000));
      const type = memoFileType(rec.mimeType || mime || "");
      const blob = new Blob(chunks, { type: type?.contentType });
      if (!type) return setState("idle"), setError("This browser records in a format we can't keep. Type your notes instead.");
      if (blob.size > MEMO_MAX_BYTES) return setState("idle"), setError("That memo is too big to keep. Try a shorter one.");
      setState("uploading");
      const path = memoPath(playerId, crypto.randomUUID(), type.ext);
      const { error: upErr } = await createClient().storage.from(JOURNAL_BUCKET).upload(path, blob, { contentType: type.contentType });
      setState("idle");
      if (upErr) return setError("The voice memo didn't upload. Check your connection and record it again.");
      if (memo?.fresh) void discardJournalMemo(playerId, memo.path);
      onChange({ path, seconds, url: URL.createObjectURL(blob), fresh: true });
    };
    recorder.current = rec;
    started.current = Date.now();
    setElapsed(0);
    rec.start();
    setState("recording");
    timer.current = setInterval(() => {
      const s = Math.round((Date.now() - started.current) / 1000);
      setElapsed(s);
      if (s >= MEMO_MAX_SECONDS && rec.state === "recording") rec.stop();
    }, 250);
  }

  function remove() {
    if (memo?.fresh) void discardJournalMemo(playerId, memo.path);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Voice memo (optional)</span>
      <div className="flex flex-wrap items-center gap-3">
        {state === "recording" ? (
          <button type="button" onClick={() => recorder.current?.stop()} className={buttonStyles("danger")}>
            <span aria-hidden className="mr-1.5 inline-block size-2.5 animate-pulse rounded-full bg-current" />
            Stop · {formatSeconds(elapsed)}
          </button>
        ) : (
          <button type="button" onClick={start} disabled={state === "uploading"} className={secondaryButtonClass}>
            {state === "uploading" ? "Saving the memo…" : memo ? "Record again" : "● Record a voice memo"}
          </button>
        )}
        {memo && state === "idle" && (
          <>
            {memo.url ? (
              <audio controls src={memo.url} className="h-10 max-w-full" />
            ) : (
              <span className="text-sm text-muted">Voice memo · {formatSeconds(memo.seconds)}</span>
            )}
            <button type="button" onClick={remove} className="text-sm text-muted hover:text-danger">
              Remove memo
            </button>
          </>
        )}
      </div>
      <p className="text-xs text-muted" aria-live="polite">
        {state === "recording" ? `Recording. It stops by itself at ${formatSeconds(MEMO_MAX_SECONDS)}.` : `Up to ${MEMO_MAX_SECONDS / 60} minutes. Only you and your parents can play it, and the mentor if you share the entry.`}
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function JournalEntryForm({
  playerId,
  mentors,
  today,
  entry,
  audioUrl = null,
  onDone,
}: {
  playerId: string;
  mentors: JournalMentor[];
  today: string;
  /** changing an entry */
  entry?: JournalEntryValues;
  audioUrl?: string | null;
  onDone?: () => void;
}) {
  const known = entry?.mentor_id && mentors.some((m) => m.mentor_id === entry.mentor_id);
  const [date, setDate] = useState(entry?.session_date ?? today);
  const [mentor, setMentor] = useState(entry ? (known ? entry.mentor_id! : entry.mentor_name ? "other" : "") : mentors.length === 1 ? mentors[0].mentor_id : "");
  const [mentorName, setMentorName] = useState(entry?.mentor_name ?? "");
  const [topic, setTopic] = useState(entry?.topic ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [memo, setMemo] = useState<Memo | null>(entry?.audio_path ? { path: entry.audio_path, seconds: entry.audio_seconds ?? 0, url: audioUrl, fresh: false } : null);
  const [shared, setShared] = useState(entry?.shared_with_mentor ?? false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const isMentor = mentor !== "" && mentor !== "other";
  const mentorLabel = mentors.find((m) => m.mentor_id === mentor)?.display_name;

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveJournalEntry({
        playerId,
        id: entry?.id ?? null,
        sessionDate: date,
        mentor,
        mentorName,
        topic,
        notes,
        audioPath: memo?.path ?? null,
        audioSeconds: memo?.seconds ?? null,
        shared: shared && isMentor,
      });
      if (res.error) return setError({ message: res.error, field: res.field });
      if (entry) return onDone?.();
      setTopic("");
      setNotes("");
      setMemo(null);
      setShared(false);
      setDate(today);
      setSaved(true);
    });
  }

  // one object per error, so the form marks and focuses the field once
  const fields = useMemo(() => (error?.field ? { [error.field]: error.message } : undefined), [error]);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <Field label="Session day">
          <input type="date" name="session_date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required className={`${fieldClass} w-44`} />
        </Field>
        <Field label="Who was it with?">
          <select name="mentor" value={mentor} onChange={(e) => setMentor(e.target.value)} className={inputClass}>
            <option value="">Choose…</option>
            {mentors.map((m) => (
              <option key={m.mentor_id} value={m.mentor_id}>
                {m.display_name}
                {m.specialty ? ` · ${m.specialty}` : ""}
              </option>
            ))}
            <option value="other">Someone else</option>
          </select>
        </Field>
      </div>
      {mentor === "other" && (
        <Field label="Their name (optional)">
          <input name="mentor_name" value={mentorName} onChange={(e) => setMentorName(e.target.value)} maxLength={JOURNAL_MENTOR_NAME_MAX} className={inputClass} />
        </Field>
      )}
      <Field label="What you worked on">
        <input
          name="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={JOURNAL_TOPIC_MAX}
          placeholder="Drop ball spin, front side closed"
          className={inputClass}
        />
      </Field>
      <Field label="Notes" hint="What clicked, the cues to remember, what to work on before next time">
        <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={JOURNAL_NOTES_MAX} rows={5} className={inputClass} />
      </Field>
      <VoiceMemo playerId={playerId} memo={memo} onChange={setMemo} />
      {isMentor && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="mt-0.5 size-4 accent-pink" />
          <span>
            Share this entry with {mentorLabel ?? "your mentor"}
            <span className="block text-xs text-muted">They see it (and can play the memo) on their page for you. You can stop sharing any time.</span>
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonStyles("primary")}>
          {pending ? "Saving…" : entry ? "Save changes" : "Save to my journal"}
        </button>
        {entry && onDone && (
          <button type="button" onClick={onDone} className={secondaryButtonClass}>
            Cancel
          </button>
        )}
        <FormMessage error={error?.message ?? null} saved={saved} fields={fields} />
      </div>
    </form>
  );
}

/** One of her entries, with Edit in place. */
export function EditableEntry({
  playerId,
  mentors,
  today,
  entry,
  audioUrl,
  children,
}: {
  playerId: string;
  mentors: JournalMentor[];
  today: string;
  entry: JournalEntryValues;
  audioUrl: string | null;
  /** the entry as she reads it, with its own buttons */
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) return <JournalEntryForm playerId={playerId} mentors={mentors} today={today} entry={entry} audioUrl={audioUrl} onDone={() => setEditing(false)} />;
  return (
    <div className="flex flex-col gap-3">
      {children}
      <div>
        <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-link hover:underline">
          Edit
        </button>
      </div>
    </div>
  );
}
