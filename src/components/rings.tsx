// Championship rings for the playbook IQ levels. Every ring is the GGG
// championship ring design (public/awards/championship-ring.webp, cut out of the
// user's render with the reflection removed). Earned rings show in full color;
// rings still to earn show dimmed and gray. Works in server and client components.
import Image from "next/image";
import ringImage from "../../public/awards/championship-ring.webp";

export type RingTrack = "defense" | "baserunning";

export const TRACK_LABEL: Record<RingTrack, string> = { defense: "Defense IQ", baserunning: "Baserunning IQ" };

/** One ring. `size` is its width in pixels. */
export function Ring({
  track,
  level,
  earned,
  size = 52,
}: {
  track: RingTrack;
  level: number;
  earned: boolean;
  size?: number;
}) {
  const label = `${TRACK_LABEL[track]} Level ${level} championship ring${earned ? "" : ", not earned yet"}`;
  return (
    <Image
      src={ringImage}
      alt={label}
      title={label}
      width={size}
      height={Math.round((size * ringImage.height) / ringImage.width)}
      className={earned ? "drop-shadow-[0_6px_16px_rgba(233,250,5,0.16)]" : "opacity-25 grayscale"}
    />
  );
}

/** The ring case: all six rings, earned ones in full color. */
export function RingCase({
  earned,
  size = 52,
  showLabels = true,
}: {
  earned: { track: RingTrack; level: number; earned_on: string }[];
  size?: number;
  showLabels?: boolean;
}) {
  const has = (track: RingTrack, level: number) => earned.some((r) => r.track === track && r.level === level);
  return (
    <div className="flex flex-wrap items-end justify-center gap-x-8 gap-y-4">
      {(["defense", "baserunning"] as RingTrack[]).map((track) => (
        <div key={track} className="flex flex-col items-center gap-2">
          <div className="flex items-end gap-2">
            {[1, 2, 3].map((level) => (
              <div key={level} className="flex flex-col items-center gap-1">
                <Ring track={track} level={level} earned={has(track, level)} size={size} />
                {showLabels && <span className="font-mono text-[10px] text-muted">L{level}</span>}
              </div>
            ))}
          </div>
          {showLabels && <p className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">{TRACK_LABEL[track]}</p>}
        </div>
      ))}
    </div>
  );
}
