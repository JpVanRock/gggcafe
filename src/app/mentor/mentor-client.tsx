"use client";

// Mentor forms: a message (text, a photo, a suggested drill from the library or a new one;
// shared with the coaches only if she ticks it), training on her players' weeks (one player
// or a group, once or every week), and asking to work with a team or player.
import { useRef, useState, useTransition } from "react";
import { Field, buttonClass, fieldClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/client";
import { MESSAGE_MAX, MESSAGE_PHOTO_BUCKET } from "@/lib/mentors";
import { addMentorTraining, deleteMentorMessage, requestMentor, sendMentorMessage } from "./actions";
import { confirmAction } from "@/components/confirm-submit";

const MAX_SIDE = 1600; // px: sharp enough to show a grip or a swing frame

/** Shrinks a photo in the browser (phone photos are often 5+ MB) to a JPEG. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that image."))), "image/jpeg", 0.85),
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  ) : null;
}

const label = "font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

export type LibraryDrill = { id: string; name: string; video_url: string | null };

export function MessageForm({
  playerId,
  mentorId,
  playerName,
  drills,
}: {
  playerId: string;
  mentorId: string;
  playerName: string;
  drills: LibraryDrill[];
}) {
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<{ path: string; preview: string } | null>(null);
  const [drillMode, setDrillMode] = useState<"none" | "library" | "new">("none");
  const [drillId, setDrillId] = useState("");
  const [newDrill, setNewDrill] = useState({ name: "", videoUrl: "", description: "" });
  const [share, setShare] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function pick(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Pick a photo (JPG, PNG or HEIC from a phone is fine).");
    setUploading(true);
    try {
      const blob = await shrink(file);
      const path = `${mentorId}/${Date.now()}.jpg`;
      const { error: upErr } = await createClient().storage.from(MESSAGE_PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) return setError("The photo didn't upload. Try again.");
      setPhoto((old) => {
        if (old) URL.revokeObjectURL(old.preview);
        return { path, preview: URL.createObjectURL(blob) };
      });
    } catch {
      setError("Couldn't read that photo. Try a JPG or PNG.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function send() {
    setError(null);
    setSent(false);
    startTransition(async () => {
      const res = await sendMentorMessage({
        playerId,
        body,
        photoPath: photo?.path,
        drillId: drillMode === "library" ? drillId : undefined,
        newDrill: drillMode === "new" ? newDrill : null,
        share,
      });
      if (res.error) return setError(res.error);
      setBody("");
      if (photo) URL.revokeObjectURL(photo.preview);
      setPhoto(null);
      setDrillMode("none");
      setDrillId("");
      setNewDrill({ name: "", videoUrl: "", description: "" });
      setShare(false);
      setSent(true);
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className={label}>Message {playerName}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MESSAGE_MAX}
          rows={3}
          placeholder="Great pen today. Keep your front side closed on the drop ball."
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileInput} type="file" accept="image/*" className="sr-only" id={`photo-${playerId}`} onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        <label htmlFor={`photo-${playerId}`} className={`${secondaryButtonClass} cursor-pointer`}>
          {uploading ? "Uploading…" : photo ? "Change photo" : "+ Photo"}
        </label>
        {photo && (
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the upload */}
            <img src={photo.preview} alt="Photo to send" className="h-14 w-14 rounded-lg object-cover" />
            <button type="button" onClick={() => setPhoto(null)} className="text-xs text-muted underline hover:text-danger">
              Remove
            </button>
          </span>
        )}
        <span className="flex flex-wrap gap-1.5">
          {(
            [
              ["none", "No drill"],
              ["library", "Suggest a drill"],
              ["new", "+ New drill"],
            ] as const
          ).map(([mode, text]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={drillMode === mode}
              onClick={() => setDrillMode(mode)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wider uppercase transition ${
                drillMode === mode ? "border-pink bg-pink text-on-accent" : "border-navy-500 text-muted hover:border-pink hover:text-ink"
              }`}
            >
              {text}
            </button>
          ))}
        </span>
      </div>

      {drillMode === "library" && (
        <label className="flex max-w-xl flex-col gap-1.5 text-sm">
          <span className="text-muted">From the Drill Library</span>
          <select value={drillId} onChange={(e) => setDrillId(e.target.value)} className={inputClass}>
            <option value="">{drills.length ? "Pick a drill" : "The library is empty: add a new drill"}</option>
            {drills.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.video_url ? " · video" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {drillMode === "new" && (
        <div className="grid max-w-2xl gap-2 rounded-xl border border-navy-700 p-3 sm:grid-cols-2">
          <p className="text-xs text-muted sm:col-span-2">It goes into the Drill Library for everyone, then to {playerName}.</p>
          <input
            value={newDrill.name}
            onChange={(e) => setNewDrill({ ...newDrill, name: e.target.value })}
            maxLength={120}
            placeholder="Drill name"
            aria-label="Drill name"
            className={inputClass}
          />
          <input
            value={newDrill.videoUrl}
            onChange={(e) => setNewDrill({ ...newDrill, videoUrl: e.target.value })}
            placeholder="Video link (https://…)"
            aria-label="Video link"
            className={inputClass}
          />
          <textarea
            value={newDrill.description}
            onChange={(e) => setNewDrill({ ...newDrill, description: e.target.value })}
            maxLength={2000}
            rows={2}
            placeholder="How to run it"
            aria-label="How to run it"
            className={`${inputClass} sm:col-span-2`}
          />
        </div>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 size-4 accent-pink" />
        <span>
          Share with her coaches
          <span className="block text-xs text-muted">Off: only {playerName}, her parents and the site admins see it.</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || uploading} className={buttonClass}>
          {pending ? "Sending…" : "Send"}
        </button>
        {sent && <span className="text-sm font-semibold text-highlight">Sent. It shows up on {playerName}&apos;s menu.</span>}
        <ErrorLine error={error} />
      </div>
    </form>
  );
}

const WEEKDAYS: [number, string][] = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [7, "Sun"]];

export type TrainingPlayer = { id: string; label: string };
export type TrainingGroup = { name: string; players: TrainingPlayer[] };

/**
 * Training on her players' weeks: one player (`single`), or the players she ticks from her
 * groups (a team, her individual players). Once, or every week on the days she picks.
 */
export function TrainingForm({ single, groups = [], preset = [] }: { single?: TrainingPlayer; groups?: TrainingGroup[]; preset?: string[] }) {
  const [weekly, setWeekly] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(single ? [single.id] : preset));
  const toggle = (ids: string[], on: boolean) =>
    setPicked((old) => {
      const next = new Set(old);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  return (
    <ActionForm action={addMentorTraining} className="flex flex-col gap-4">
      {single ? (
        <input type="hidden" name="player_id" value={single.id} />
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className={label}>Who</legend>
          {groups.map((g) => {
            const ids = g.players.map((p) => p.id);
            const all = ids.length > 0 && ids.every((id) => picked.has(id));
            return (
              <div key={g.name} className="rounded-xl border border-navy-700 p-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={all} onChange={(e) => toggle(ids, e.target.checked)} className="size-4 accent-pink" />
                  {g.name} <span className="font-normal text-muted">· all {ids.length}</span>
                </label>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {g.players.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="player_id"
                        value={p.id}
                        checked={picked.has(p.id)}
                        onChange={(e) => toggle([p.id], e.target.checked)}
                        className="size-4 accent-pink"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <Field label="What">
            <input name="title" maxLength={120} required placeholder="Pitching lesson" className={inputClass} />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label={weekly ? "First day" : "Day"}>
            <input type="date" name="date" required className={inputClass} />
          </Field>
        </div>
        <div className="sm:col-span-6">
          <Field label="Note (optional)">
            <input name="note" maxLength={500} placeholder="5:30 at the facility. Bring your glove." className={inputClass} />
          </Field>
        </div>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className={label}>Repeats</legend>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["once", "One time"],
              ["weekly", "Every week"],
            ] as const
          ).map(([value, text]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold tracking-wider uppercase transition has-focus-visible:ring-2 has-focus-visible:ring-pink ${
                (value === "weekly") === weekly ? "border-pink bg-pink text-on-accent" : "border-navy-500 text-muted hover:border-pink hover:text-ink"
              }`}
            >
              <input type="radio" name="repeat" value={value} checked={(value === "weekly") === weekly} onChange={() => setWeekly(value === "weekly")} className="sr-only" />
              {text}
            </label>
          ))}
        </div>
        {weekly && (
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">On</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map(([n, d]) => (
                  <label key={n} className="flex items-center gap-1.5 rounded-md border border-navy-600 px-2 py-1 text-sm">
                    <input type="checkbox" name="days" value={n} className="size-4 accent-pink" />
                    {d}
                  </label>
                ))}
              </div>
              <span className="text-xs text-muted">None ticked: the first day&apos;s weekday.</span>
            </div>
            <Field label="Last day">
              <input type="date" name="until" required className={`${fieldClass} w-44`} />
            </Field>
          </div>
        )}
      </fieldset>
      <div>
        <SubmitButton pendingLabel="Adding…">{single ? `Add to ${single.label}'s week` : "Add to their weeks"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Ask to work with a whole team (its head coach approves) or one player (her parents approve). */
export function RequestForm({ defaults }: { defaults?: { code?: string; scope?: "team" | "player"; player?: string } }) {
  const [scope, setScope] = useState<"team" | "player">(defaults?.scope ?? "player");
  return (
    <ActionForm action={requestMentor} className="grid gap-4 sm:grid-cols-6">
      <div className="sm:col-span-2">
        <Field label="Team code" hint="Six characters, from the coach or a parent">
          <input name="code" defaultValue={defaults?.code} required autoComplete="off" className={`${inputClass} font-mono uppercase`} />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2 sm:col-span-4">
        <legend className="mb-1.5 text-sm font-medium">Who you work with</legend>
        {(
          [
            ["player", "One player", "Her parents approve you."],
            ["team", "The whole team", "The head coach approves you."],
          ] as const
        ).map(([value, text, hint]) => (
          <label key={value} className="flex items-start gap-2 text-sm">
            <input type="radio" name="scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="mt-0.5 size-4 accent-pink" />
            <span>
              {text}
              <span className="block text-xs text-muted">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {scope === "player" && (
        <div className="sm:col-span-4">
          <Field label="Her first and last name" hint="As the team has it on the roster">
            <input name="player" defaultValue={defaults?.player} required maxLength={80} className={inputClass} />
          </Field>
        </div>
      )}
      <div className="sm:col-span-6">
        <SubmitButton pendingLabel="Sending…">Ask for approval</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function RemoveMessage({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (await confirmAction("Take this message back? She won't see it any more.")) startTransition(async () => void (await deleteMentorMessage({ id })));
      }}
      className="text-xs text-muted underline hover:text-danger"
    >
      {pending ? "Removing…" : "Take back"}
    </button>
  );
}
