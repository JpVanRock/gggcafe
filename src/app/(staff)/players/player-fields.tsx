"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import {
  BATS, BATS_LABEL, MAX_WALK_UP_SONGS, POSITIONS, POSITION_LABEL, THROWS, THROWS_LABEL, type Player, type WalkUpSong,
} from "@/lib/softball";
import { PhotoField } from "./photo-field";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 sm:col-span-6 sm:grid-cols-6">
      <legend className="mb-1 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

const span2 = "sm:col-span-2";
const span3 = "sm:col-span-3";

/** Walk-up songs: up to three, each a title with an optional artist and link. */
function WalkUpSongs({ songs }: { songs: WalkUpSong[] }) {
  const [rows, setRows] = useState(() => songs.map((s, i) => ({ ...s, key: i })));
  const [next, setNext] = useState(songs.length);
  return (
    <div className="flex flex-col gap-3 sm:col-span-6">
      {rows.map((row, i) => (
        <div key={row.key} className="grid gap-2 rounded-lg border border-navy-700 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input name="song_title" defaultValue={row.title} maxLength={120} placeholder="Song" aria-label={`Song ${i + 1}`} className={inputClass} />
          <input name="song_artist" defaultValue={row.artist ?? ""} maxLength={120} placeholder="Artist" aria-label={`Song ${i + 1} artist`} className={inputClass} />
          <input
            name="song_link"
            type="url"
            defaultValue={row.link ?? ""}
            maxLength={500}
            placeholder="Link (optional)"
            aria-label={`Song ${i + 1} link`}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
            className="justify-self-start rounded-md px-2 py-1.5 text-sm text-muted hover:text-danger"
          >
            Remove
          </button>
        </div>
      ))}
      {rows.length < MAX_WALK_UP_SONGS && (
        <button
          type="button"
          onClick={() => {
            setRows((list) => [...list, { key: next, title: "", artist: null, link: null }]);
            setNext((n) => n + 1);
          }}
          className="self-start rounded-md border border-dashed border-navy-600 px-3 py-1.5 text-sm text-muted hover:border-pink hover:text-ink"
        >
          + Add a walk-up song
        </button>
      )}
    </div>
  );
}

/**
 * The player's own details, shared by the intake form and "Edit profile".
 * `required` marks the intake form's must-haves (the edit form stays lenient so
 * older players without a birth date can still be saved).
 */
export function PlayerFields({
  player,
  required = false,
  photoUrl,
  teamFields,
}: {
  player?: Player;
  required?: boolean;
  photoUrl?: string | null;
  /** intake only: current team and jersey number, shown with the name */
  teamFields?: React.ReactNode;
}) {
  return (
    <>
      <Section title="Player">
        <div className={span2}>
          <Field label="First name">
            <input name="first_name" required defaultValue={player?.first_name ?? ""} autoComplete="off" className={inputClass} />
          </Field>
        </div>
        <div className={span2}>
          <Field label="Last name">
            <input name="last_name" required defaultValue={player?.last_name ?? ""} autoComplete="off" className={inputClass} />
          </Field>
        </div>
        <div className={span2}>
          <Field label="Goes by" hint="Optional nickname">
            <input name="preferred_name" defaultValue={player?.preferred_name ?? ""} autoComplete="off" className={inputClass} />
          </Field>
        </div>
        {teamFields}
        <div className={span2}>
          <Field label="Date of birth">
            <input type="date" name="birth_date" required={required} min="1990-01-01" defaultValue={player?.birth_date ?? ""} className={inputClass} />
          </Field>
        </div>
        <div className={span2}>
          <Field label="Class year" hint="High school graduation year">
            <input
              name="grad_year"
              required={required}
              inputMode="numeric"
              maxLength={4}
              placeholder="2030"
              defaultValue={player?.grad_year ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section title="On the field">
        <div className={span2}>
          <Field label="Batting hand">
            <select name="bats" required={required} defaultValue={player?.bats ?? ""} className={inputClass}>
              <option value="">—</option>
              {BATS.map((b) => (
                <option key={b} value={b}>
                  {BATS_LABEL[b]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className={span2}>
          <Field label="Throwing hand">
            <select name="throws" required={required} defaultValue={player?.throws ?? ""} className={inputClass}>
              <option value="">—</option>
              {THROWS.map((t) => (
                <option key={t} value={t}>
                  {THROWS_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className={span2}>
          <Field label="Primary position">
            <select name="primary_position" required={required} defaultValue={player?.primary_position ?? ""} className={inputClass}>
              <option value="">—</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p} · {POSITION_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="sm:col-span-6">
          <p className="mb-1.5 text-sm font-medium">Also plays</p>
          <div className="flex flex-wrap gap-2">
            {POSITIONS.map((p) => (
              <label
                key={p}
                title={POSITION_LABEL[p]}
                className="cursor-pointer rounded-full border border-navy-600 px-3 py-1 text-sm text-muted transition select-none hover:border-pink has-checked:border-pink has-checked:bg-pink has-checked:text-on-accent has-focus-visible:ring-2 has-focus-visible:ring-pink/40"
              >
                <input
                  type="checkbox"
                  name="secondary_positions"
                  value={p}
                  defaultChecked={player?.secondary_positions.includes(p) ?? false}
                  className="sr-only"
                />
                {p}
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Optional">
        <div className={span3}>
          <p className="mb-1.5 text-sm font-medium">Profile picture</p>
          <PhotoField folder={player?.id} path={player?.photo_path} previewUrl={photoUrl} />
        </div>
        <div className="sm:col-span-6">
          <p className="mb-1.5 text-sm font-medium">Walk-up song(s)</p>
          <WalkUpSongs songs={player?.walk_up_songs ?? []} />
        </div>
      </Section>
    </>
  );
}
