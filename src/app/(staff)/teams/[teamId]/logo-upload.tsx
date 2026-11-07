"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { buttonClass, secondaryButtonClass } from "@/components/ui";
import { setTeamLogo } from "../actions";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_BYTES = 2 * 1024 * 1024;

/** Coaches upload the team logo (Storage bucket team-logos). */
export function LogoUpload({ teamId, logoUrl }: { teamId: string; logoUrl: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    setError(null);
    setStatus(null);
    const ext = TYPES[file.type];
    if (!ext) return setError("Use a PNG, JPG or WebP image.");
    if (file.size > MAX_BYTES) return setError("Logos must be 2 MB or smaller.");

    startTransition(async () => {
      const path = `${teamId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await createClient()
        .storage.from("team-logos")
        .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (uploadError) {
        setError(uploadError.message.includes("row-level security") ? "Only coaches and admins can change the logo." : "Upload failed. Try again.");
        return;
      }
      const result = await setTeamLogo({ teamId, path });
      if (result.error) return setError(result.error);
      setStatus("Logo saved.");
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- remote Storage URL, shown as-is */}
      <img
        src={logoUrl ?? "/brand/ggg-cafe-logo.webp"}
        alt={logoUrl ? "Team logo" : "GGG badge (used until a team logo is uploaded)"}
        className="size-20 rounded-full border border-navy-600 bg-navy-950 object-contain p-1"
      />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <label className={`${buttonClass} cursor-pointer ${pending ? "pointer-events-none opacity-60" : ""}`}>
            {pending ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
              }}
            />
          </label>
          {logoUrl && (
            <button
              type="button"
              disabled={pending}
              className={secondaryButtonClass}
              onClick={() =>
                startTransition(async () => {
                  const result = await setTeamLogo({ teamId, path: null });
                  setError(result.error);
                  setStatus(result.error ? null : "Logo removed. Rings show the GGG badge again.");
                })
              }
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-muted">PNG, JPG or WebP, up to 2 MB. A square image with a transparent background looks best.</p>
        <p aria-live="polite" className={`min-h-4 text-xs ${error ? "text-danger" : "text-highlight"}`}>
          {error ?? status}
        </p>
      </div>
    </div>
  );
}
