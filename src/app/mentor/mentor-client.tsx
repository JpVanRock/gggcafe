"use client";

// Mentor forms: a message (text, a photo, a suggested drill from the library or a
// new one), a date on her TWIS, and removing either.
import { useRef, useState, useTransition } from "react";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { MESSAGE_MAX, MESSAGE_PHOTO_BUCKET } from "@/lib/mentors";
import { addMentorDate, deleteMentorMessage, removeMentorDate, sendMentorMessage } from "./actions";
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
      });
      if (res.error) return setError(res.error);
      setBody("");
      if (photo) URL.revokeObjectURL(photo.preview);
      setPhoto(null);
      setDrillMode("none");
      setDrillId("");
      setNewDrill({ name: "", videoUrl: "", description: "" });
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

export function DateForm({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await addMentorDate({ playerId, title, date, note });
          if (res.error) return setError(res.error);
          setTitle("");
          setDate("");
          setNote("");
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">What</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Pitching lesson" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Day</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </label>
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
        <span className="text-muted">Note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="5:30 at the facility" className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        {pending ? "Adding…" : `Add to ${playerName}'s week`}
      </button>
      <ErrorLine error={error} />
    </form>
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

export function RemoveDate({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await removeMentorDate({ id })))}
      className="text-xs text-muted underline hover:text-danger"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
