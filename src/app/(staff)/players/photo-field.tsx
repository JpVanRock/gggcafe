"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_SIDE = 900; // px; plenty for a profile picture
const BUCKET = "player-photos";

/** Shrinks a photo in the browser (phone photos are often 5+ MB) and returns a JPEG. */
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

/**
 * Optional profile picture. Uploads as soon as one is picked (to the private
 * player-photos bucket) and puts the file's path in a hidden `photo_path`
 * input, so the form saves it with everything else.
 */
export function PhotoField({ folder, path, previewUrl }: { folder?: string; path?: string | null; previewUrl?: string | null }) {
  const [value, setValue] = useState(path ?? "");
  const [preview, setPreview] = useState(previewUrl ?? null);
  const [status, setStatus] = useState<{ error?: string; busy?: boolean }>({});
  const folderRef = useRef(folder ?? null);
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File) {
    if (!file.type.startsWith("image/")) return setStatus({ error: "Pick a photo (JPG, PNG or HEIC from a phone is fine)." });
    setStatus({ busy: true });
    try {
      const blob = await shrink(file);
      folderRef.current ??= crypto.randomUUID();
      const newPath = `${folderRef.current}/${Date.now()}.jpg`;
      const { error } = await createClient()
        .storage.from(BUCKET)
        .upload(newPath, blob, { contentType: "image/jpeg", cacheControl: "3600" });
      if (error) {
        setStatus({ error: error.message.includes("row-level security") ? "Only coaches and admins can add photos." : "Upload failed. Try again." });
        return;
      }
      setValue(newPath);
      setPreview((old) => {
        if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      setStatus({});
    } catch {
      setStatus({ error: "Couldn't read that photo. Try a JPG or PNG." });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name="photo_path" value={value} />
      <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-navy-600 bg-navy-950">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL or local preview
          <img src={preview} alt="Profile picture" className="size-full object-cover" />
        ) : (
          <span className="font-mono text-[10px] tracking-wider text-muted uppercase">No photo</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          <label
            className={`cursor-pointer rounded-md border border-navy-600 px-3 py-1.5 text-sm transition hover:border-pink hover:bg-navy-800 ${
              status.busy ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {status.busy ? "Uploading…" : value ? "Change photo" : "Add profile picture"}
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={status.busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pick(file);
              }}
            />
          </label>
          {value && !status.busy && (
            <button
              type="button"
              onClick={() => {
                setValue("");
                setPreview(null);
              }}
              className="rounded-md px-2 py-1.5 text-sm text-muted hover:text-danger"
            >
              Remove
            </button>
          )}
        </div>
        <span className={`text-xs ${status.error ? "text-danger" : "text-muted"}`}>
          {status.error ?? "Optional. Only signed-in staff can see it."}
        </span>
      </div>
    </div>
  );
}
