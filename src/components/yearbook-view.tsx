"use client";

// The Team Yearbook (G3 Advanced): a cover, then the season month by month as
// magazine-style spreads (a feature photo and a rhythm of tile sizes), or a
// thumbnail grid. Search by player (tags). Tap a photo for the full view: caption,
// who's in it, and (uploader or coach) edit or remove. Coaches and parents of G3
// Advanced players add photos: shrunk in the browser to a 1600px photo and a
// 480px thumbnail before upload. Data and links come from the server as props.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SpeedStripes } from "@/components/athletic";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  CAPTION_MAX, FULL_SIDE, THUMB_SIDE, YEARBOOK_BUCKET, monthSpreads, photoDay, photoPaths, photosOf, tagCounts, tileSize,
  type YearbookData, type YearbookPhoto,
} from "@/lib/yearbook";
import { addYearbookPhotos, deleteYearbookPhoto, setYearbookCaption, setYearbookTags } from "@/app/yearbook/actions";

const label = "font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase";

async function shrink(file: File, side: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image."))), "image/jpeg", side === THUMB_SIDE ? 0.78 : 0.85),
  );
  return { blob, width: canvas.width, height: canvas.height };
}

function dayLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${iso}T00:00:00Z`));
}

function TagChips({
  roster,
  selected,
  onToggle,
}: {
  roster: YearbookData["roster"];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {roster.map((r) => {
        const on = selected.includes(r.player_id);
        return (
          <button
            key={r.player_id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(r.player_id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
              on ? "border-neon bg-neon text-on-accent" : "border-navy-500 text-muted hover:border-pink hover:text-ink"
            }`}
          >
            {r.jersey ? `#${r.jersey} ` : ""}
            {r.name}
          </button>
        );
      })}
    </div>
  );
}

/** Coaches and parents: add a batch of photos with one caption, day and set of tags. */
function AddPhotos({ data, onDone }: { data: YearbookData; onDone: () => void }) {
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [caption, setCaption] = useState("");
  const [takenOn, setTakenOn] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.preview)), [files]);

  async function upload() {
    if (!data.season) return setError("This team has no season yet.");
    if (files.length === 0) return setError("Pick some photos first.");
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const uploaded: { path: string; thumbPath: string; width: number; height: number }[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setStatus(`Uploading ${i + 1} of ${files.length}…`);
        const [full, thumb] = await Promise.all([shrink(files[i].file, FULL_SIDE), shrink(files[i].file, THUMB_SIDE)]);
        const paths = photoPaths(data.team.id, data.season.id, Date.now(), Math.random().toString(36).slice(2, 10));
        const [a, b] = await Promise.all([
          supabase.storage.from(YEARBOOK_BUCKET).upload(paths.path, full.blob, { contentType: "image/jpeg" }),
          supabase.storage.from(YEARBOOK_BUCKET).upload(paths.thumb_path, thumb.blob, { contentType: "image/jpeg" }),
        ]);
        if (a.error || b.error) throw new Error("upload");
        uploaded.push({ path: paths.path, thumbPath: paths.thumb_path, width: full.width, height: full.height });
      }
    } catch {
      setBusy(false);
      setStatus(null);
      return setError(uploaded.length ? `Uploaded ${uploaded.length}, then one failed. Try the rest again.` : "The upload didn't work. Try again.");
    }
    setStatus("Saving…");
    startTransition(async () => {
      const res = await addYearbookPhotos({ teamId: data.team.id, seasonId: data.season!.id, photos: uploaded, caption, takenOn, tags });
      setBusy(false);
      setStatus(null);
      if (res.error) return setError(res.error);
      setFiles([]);
      setCaption("");
      setTags([]);
      onDone();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-pink bg-pink/5 p-4 sm:p-5">
      <p className={label}>Add photos to the {data.season?.name ?? ""} yearbook</p>
      <label className={`${secondaryButtonClass} cursor-pointer self-start`}>
        {files.length ? "Pick different photos" : "Pick photos"}
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            const picked = [...(e.target.files ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, 40);
            setFiles(picked.map((file) => ({ file, preview: URL.createObjectURL(file) })));
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {files.map((f) => (
            // eslint-disable-next-line @next/next/no-img-element -- local preview before upload
            <img key={f.preview} src={f.preview} alt="" className="aspect-square w-full rounded-md object-cover" />
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={CAPTION_MAX} placeholder="Caption (optional): Senior Night, the walk-off…" aria-label="Caption" className={inputClass} />
        <input type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} aria-label="Day they were taken" className={inputClass} />
      </div>
      {data.roster.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">Who&apos;s in them? Tag players so they can find themselves.</p>
          <TagChips roster={data.roster} selected={tags} onToggle={(id) => setTags((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || files.length === 0} onClick={upload} className={buttonClass}>
          {busy ? (status ?? "Working…") : `Add ${files.length || ""} photo${files.length === 1 ? "" : "s"}`}
        </button>
        <span className="text-xs text-muted">Photos are shrunk on your device first, so uploads are quick.</span>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

/** The full view of one photo, with arrows; the uploader or a coach can edit or remove it. */
function Lightbox({
  photos,
  index,
  urls,
  data,
  onClose,
  onMove,
}: {
  photos: YearbookPhoto[];
  index: number;
  urls: Record<string, string>;
  data: YearbookData;
  onClose: () => void;
  onMove: (i: number) => void;
}) {
  const photo = photos[index];
  const canEdit = data.access === "manage" || photo.mine;
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [takenOn, setTakenOn] = useState(photo.taken_on ?? "");
  const [tags, setTags] = useState(photo.tags.map((t) => t.player_id));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === "ArrowRight" && index < photos.length - 1) onMove(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onMove(index - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, photos.length, onMove, editing]);

  function save() {
    setError(null);
    startTransition(async () => {
      const a = await setYearbookCaption({ photoId: photo.id, caption, takenOn });
      if (a.error) return setError(a.error);
      const b = await setYearbookTags({ photoId: photo.id, playerIds: tags });
      if (b.error) return setError(b.error);
      setEditing(false);
    });
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="m-auto h-[100dvh] max-h-none w-screen max-w-none bg-navy-950/95 p-0 text-ink backdrop:bg-black/80"
      aria-label={photo.caption ?? "Yearbook photo"}
    >
      <div className="flex h-full flex-col gap-3 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs tracking-wider text-muted uppercase">
            {index + 1} / {photos.length} · {dayLabel(photoDay(photo))}
          </span>
          <button type="button" onClick={onClose} className={secondaryButtonClass} autoFocus>
            Close
          </button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL */}
          <img src={urls[photo.path] ?? urls[photo.thumb_path]} alt={photo.caption ?? "Yearbook photo"} className="max-h-full max-w-full rounded-lg object-contain" />
          {index > 0 && (
            <button
              type="button"
              onClick={() => onMove(index - 1)}
              aria-label="Previous photo"
              className="absolute top-1/2 left-1 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-navy-950/70 text-2xl text-ink hover:bg-pink hover:text-on-accent"
            >
              ‹
            </button>
          )}
          {index < photos.length - 1 && (
            <button
              type="button"
              onClick={() => onMove(index + 1)}
              aria-label="Next photo"
              className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-navy-950/70 text-2xl text-ink hover:bg-pink hover:text-on-accent"
            >
              ›
            </button>
          )}
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          {editing ? (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={CAPTION_MAX} placeholder="Caption" aria-label="Caption" className={inputClass} />
                <input type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} aria-label="Day it was taken" className={inputClass} />
              </div>
              <TagChips roster={data.roster} selected={tags} onToggle={(id) => setTags((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))} />
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" disabled={pending} onClick={save} className={buttonClass}>
                  {pending ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="text-sm text-muted underline">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {photo.caption && <p className="text-lg font-semibold">{photo.caption}</p>}
              {photo.tags.length > 0 && (
                <p className="flex flex-wrap gap-1.5">
                  {photo.tags.map((t) => (
                    <span key={t.player_id} className="rounded-full border border-neon/60 px-2.5 py-0.5 text-xs font-semibold text-highlight">
                      {t.name}
                    </span>
                  ))}
                </p>
              )}
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span>Added by {photo.uploader_name}</span>
                {canEdit && (
                  <>
                    <button type="button" onClick={() => setEditing(true)} className="text-pink underline">
                      Edit caption &amp; tags
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm("Remove this photo from the yearbook?")) return;
                        startTransition(async () => {
                          const res = await deleteYearbookPhoto({ photoId: photo.id });
                          if (res.error) return setError(res.error);
                          onClose();
                        });
                      }}
                      className="underline hover:text-danger"
                    >
                      Remove
                    </button>
                  </>
                )}
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}

function Tile({ photo, size, url, onOpen }: { photo: YearbookPhoto; size: ReturnType<typeof tileSize>; url: string | undefined; onOpen: () => void }) {
  const span = size === "feature" ? "col-span-2 row-span-2" : size === "wide" ? "col-span-2" : size === "tall" ? "row-span-2" : "";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative overflow-hidden rounded-xl border border-navy-700 bg-navy-900 text-left transition hover:border-neon ${span}`}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
        <img src={url} alt={photo.caption ?? "Yearbook photo"} loading="lazy" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105" />
      )}
      {(photo.caption || photo.tags.length > 0) && (
        <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-navy-950/95 via-navy-950/60 to-transparent px-3 pt-8 pb-2.5">
          {photo.caption && <span className={`block font-semibold text-white ${size === "feature" ? "text-lg" : "truncate text-sm"}`}>{photo.caption}</span>}
          {photo.tags.length > 0 && (
            <span className="block truncate font-mono text-[10px] tracking-wider text-neon uppercase">{photo.tags.map((t) => t.name.split(" ")[0]).join(" · ")}</span>
          )}
        </span>
      )}
    </button>
  );
}

export function YearbookView({
  data,
  urls,
  seasonLink,
}: {
  data: YearbookData;
  urls: Record<string, string>;
  /** link to another season's yearbook: this, then the season id */
  seasonLink: string;
}) {
  const [view, setView] = useState<"yearbook" | "thumbnails">("yearbook");
  const [player, setPlayer] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const counts = useMemo(() => tagCounts(data.photos), [data.photos]);
  const shown = useMemo(() => photosOf(data.photos, player), [data.photos, player]);
  const spreads = useMemo(() => monthSpreads(shown), [shown]);
  const ordered = useMemo(() => spreads.flatMap((s) => s.photos), [spreads]);
  const indexOf = (id: string) => ordered.findIndex((p) => p.id === id);
  const move = useCallback((i: number) => setOpen(i), []);
  const canAdd = data.access === "manage" || data.access === "add";
  const matches = data.roster.filter((r) => !query || r.name.toLowerCase().includes(query.toLowerCase()));
  const picked = data.roster.find((r) => r.player_id === player);
  const cover = data.photos.slice(0, 3);
  const taggedPlayers = counts.size;

  return (
    <div className="flex flex-col gap-8">
      {/* the cover */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-neon bg-linear-to-br from-navy-950 via-navy-900 to-navy-950 p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-80 sm:block" aria-hidden>
          {cover.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
            <img
              key={p.id}
              src={urls[p.thumb_path]}
              alt=""
              className={`absolute rounded-xl border-4 border-navy-950 object-cover shadow-2xl ${
                i === 0 ? "top-6 right-10 h-48 w-40 rotate-6" : i === 1 ? "top-24 right-44 h-40 w-36 -rotate-6" : "right-4 bottom-4 h-36 w-32 rotate-2"
              }`}
            />
          ))}
        </div>
        <div className="relative max-w-xl">
          <p className="flex items-center gap-3 font-mono text-xs tracking-[0.35em] text-pink-soft uppercase">
            <SpeedStripes className="h-3 w-9 text-pink" />
            {data.season?.name ?? "This season"}
          </p>
          <p className="mt-3 text-sm font-semibold tracking-[0.3em] text-ink uppercase">{data.team.name}</p>
          <h2 className="font-display text-6xl leading-[0.9] font-black tracking-tight text-highlight uppercase italic drop-shadow-[0_4px_18px_rgb(0_10_45/0.9)] sm:text-8xl">
            Yearbook
          </h2>
          <p className="mt-4 font-mono text-sm text-muted">
            {data.photos.length} photo{data.photos.length === 1 ? "" : "s"} · {taggedPlayers} player{taggedPlayers === 1 ? "" : "s"} tagged
          </p>
        </div>
      </section>

      {/* seasons, views, search, add */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="View">
            {(
              [
                ["yearbook", "Yearbook"],
                ["thumbnails", "Thumbnails"],
              ] as const
            ).map(([v, text]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold tracking-wider uppercase transition ${
                  view === v ? "border-pink bg-pink text-on-accent" : "border-navy-500 text-muted hover:border-pink hover:text-ink"
                }`}
              >
                {text}
              </button>
            ))}
            {data.seasons.length > 1 &&
              data.seasons.map((s) => (
                <Link
                  key={s.id}
                  href={`${seasonLink}${s.id}`}
                  aria-current={s.id === data.season?.id ? "page" : undefined}
                  className={`ml-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                    s.id === data.season?.id ? "border-neon text-highlight" : "border-navy-600 text-muted hover:border-pink"
                  }`}
                >
                  {s.name}
                </Link>
              ))}
          </div>
          {canAdd && (
            <button type="button" onClick={() => setAdding((a) => !a)} className={adding ? secondaryButtonClass : buttonClass}>
              {adding ? "Close" : "+ Add photos"}
            </button>
          )}
        </div>
        {adding && <AddPhotos data={data} onDone={() => setAdding(false)} />}
        {data.roster.length > 0 && data.photos.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-navy-700 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a player"
                aria-label="Find a player"
                className={`${inputClass} w-full max-w-xs`}
              />
              {picked && (
                <button type="button" onClick={() => setPlayer(null)} className="rounded-full border border-neon bg-neon px-3 py-1 text-xs font-bold text-on-accent">
                  {picked.name} · {counts.get(picked.player_id) ?? 0} ×
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {matches.map((r) => (
                <button
                  key={r.player_id}
                  type="button"
                  aria-pressed={player === r.player_id}
                  onClick={() => setPlayer(player === r.player_id ? null : r.player_id)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                    player === r.player_id ? "border-neon text-highlight" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
                  } ${counts.get(r.player_id) ? "" : "opacity-50"}`}
                >
                  {r.name} <span className="font-display tabular-nums">{counts.get(r.player_id) ?? 0}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-navy-600 p-8 text-center text-muted">
          {player
            ? `No photos of ${picked?.name ?? "her"} yet.`
            : canAdd
              ? "No photos yet. Add the first ones: game days, practices, the bus rides, the dugout."
              : "No photos yet. Coaches and parents add them through the season."}
        </p>
      ) : view === "thumbnails" ? (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-7">
          {ordered.map((p, i) => (
            <button key={p.id} type="button" onClick={() => setOpen(i)} className="group relative aspect-square overflow-hidden rounded-md bg-navy-900">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL */}
              <img src={urls[p.thumb_path]} alt={p.caption ?? "Yearbook photo"} loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          {spreads.map((s) => (
            <section key={s.key} aria-label={`${s.month} ${s.year}`}>
              <header className="relative mb-4 flex items-end gap-4">
                <h3 className="font-display text-5xl leading-none font-black tracking-tight text-ink/90 uppercase sm:text-7xl">{s.month}</h3>
                <span className="mb-1 flex items-center gap-2 font-mono text-xs tracking-[0.3em] text-pink-soft uppercase">
                  <SpeedStripes className="h-3 w-8 text-pink" />
                  {s.year} · {s.photos.length} photo{s.photos.length === 1 ? "" : "s"}
                </span>
              </header>
              <div className="grid auto-rows-[9rem] grid-flow-dense grid-cols-2 gap-2 sm:auto-rows-[11rem] sm:grid-cols-4">
                {s.photos.map((p, i) => {
                  const size = tileSize(i, s.photos.length);
                  return (
                    <Tile
                      key={p.id}
                      photo={p}
                      size={size}
                      url={size === "regular" ? urls[p.thumb_path] : (urls[p.path] ?? urls[p.thumb_path])}
                      onOpen={() => setOpen(indexOf(p.id))}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {open !== null && ordered[open] && (
        <Lightbox key={ordered[open].id} photos={ordered} index={open} urls={urls} data={data} onClose={() => setOpen(null)} onMove={move} />
      )}
    </div>
  );
}
