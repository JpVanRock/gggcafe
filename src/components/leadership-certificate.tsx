// The Certificate of Leadership (G3 Leadership Guide), drawn as a letter-size
// landscape sheet: paper white with a navy frame and pink pinstripe, a navy band
// across the top, her team's logo (the GGG logo when the team has none) in the
// seal, her name, the Leader Badge, and the coach's signature line. Sizes are in
// container units (cqw), so it scales on screen and prints at full size. Colors
// are fixed (paper), not theme tokens; the printing rules live in globals.css
// (.certificate-print). Content comes in as props from the server page.
import { LeaderBadge } from "./leader-badge";
import { SpeedStripes } from "./athletic";

const NAVY = "#000A2D";
const PINK = "#FE1F7C";
/** small pink type on the cream paper: brand pink is 3.6:1 there, this is 5.6:1 */
const PINK_TEXT = "#C2135D";
const NEON = "#E7FB06";

export type CertificateText = { title: string; honor: string; presented: string; completed: string; detail: string; creed: string };

export function LeadershipCertificate({
  name,
  number,
  teamName,
  logoUrl,
  coachName,
  date,
  text,
  rungs,
}: {
  name: string;
  number: string | null;
  teamName: string | null;
  /** her team's logo; the GGG logo when null */
  logoUrl: string | null;
  coachName: string | null;
  /** "November 8, 2026" */
  date: string;
  text: CertificateText;
  /** the leadership ladder, bottom rung first */
  rungs: readonly string[];
}) {
  const sub = [number && `#${number}`, teamName].filter(Boolean).join(" · ");
  return (
    <div className="certificate-print @container mx-auto w-full max-w-5xl">
      <div
        className="relative aspect-[11/8.5] w-full overflow-hidden bg-[#FCFCF8] shadow-[0_20px_60px_-20px_rgb(0_0_0/0.6)]"
        style={{ color: NAVY }}
        role="img"
        aria-label={`${text.title}: ${name}, ${text.honor}`}
      >
        {/* frame: navy rule, pink pinstripe */}
        <div className="pointer-events-none absolute inset-[2cqw] border-[0.5cqw]" style={{ borderColor: NAVY }} />
        <div className="pointer-events-none absolute inset-[3cqw] border-[0.15cqw]" style={{ borderColor: PINK }} />
        {/* speed stripes in the lower corners */}
        <SpeedStripes className="absolute bottom-[4.2cqw] left-[4.2cqw] h-[2cqw] w-[6cqw] text-[#FE1F7C]" />
        <SpeedStripes className="absolute right-[4.2cqw] bottom-[4.2cqw] h-[2cqw] w-[6cqw] -scale-x-100 text-[#FE1F7C]" />

        <div className="absolute inset-[3.6cqw] flex flex-col items-center text-center">
          {/* the band */}
          <div className="flex h-[10cqw] w-full shrink-0 items-start justify-between px-[2.4cqw] pt-[2cqw]" style={{ background: NAVY }}>
            <span className="font-mono text-[1.15cqw] font-bold tracking-[0.3em] uppercase" style={{ color: NEON }}>
              G3 Advanced
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- printed sheet; plain img keeps the print sizing simple */}
            <img src="/brand/ggg-cafe-wordmark.png" alt="GGG.Cafe" className="h-auto w-[12cqw]" />
          </div>

          {/* the seal: her team's logo, or ours */}
          <div
            className="-mt-[6.2cqw] grid size-[11cqw] shrink-0 place-items-center overflow-hidden rounded-full bg-white p-[1cqw]"
            style={{ boxShadow: `0 0 0 0.45cqw ${NAVY}, 0 0 0 0.8cqw #FCFCF8, 0 0 0 1cqw ${PINK}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Storage URL or our logo, printed */}
            <img src={logoUrl ?? "/brand/ggg-cafe-logo.webp"} alt={teamName ? `${teamName} logo` : "GGG Cafe"} className="size-full object-contain" />
          </div>

          <p className="mt-[2cqw] font-display text-[2.5cqw] leading-none font-bold tracking-[0.32em] uppercase">{text.title}</p>
          <span className="mt-[1.1cqw] h-[0.3cqw] w-[6cqw]" style={{ background: PINK }} />

          <p className="mt-[1.8cqw] font-mono text-[1.15cqw] tracking-[0.3em] uppercase opacity-70">{text.presented}</p>
          <p className="mt-[0.8cqw] font-display text-[6.2cqw] leading-none font-bold tracking-tight uppercase">{name}</p>
          {sub && (
            <p className="mt-[0.9cqw] font-mono text-[1.35cqw] font-bold tracking-[0.2em] uppercase" style={{ color: PINK_TEXT }}>
              {sub}
            </p>
          )}
          <p className="mt-[1.6cqw] text-[1.75cqw] font-semibold">{text.completed}</p>
          <p className="mt-[0.5cqw] max-w-[62cqw] text-[1.2cqw] leading-snug opacity-75">{text.detail}</p>

          {/* the honor */}
          <div className="mt-[1.8cqw] flex items-center gap-[2cqw]">
            <span className="keep-night block w-[7cqw]">
              <LeaderBadge size={120} label className="h-auto w-full" />
            </span>
            <span className="text-left">
              <span className="block font-display text-[5cqw] leading-none font-black tracking-[0.06em] uppercase" style={{ color: PINK }}>
                {text.honor}
              </span>
              <span className="mt-[0.6cqw] block max-w-[42cqw] text-[1.2cqw] leading-snug italic">{text.creed}</span>
            </span>
          </div>

          {/* signatures, with the ladder between them */}
          <div className="mt-auto grid w-full grid-cols-[1fr_auto_1fr] items-end gap-[3cqw] px-[4cqw] pb-[3.2cqw]">
            {/* left blank for the coach to sign by hand; the printed name goes under the line */}
            <div className="text-left">
              <div className="h-[5.4cqw]" />
              <div className="h-[0.12cqw]" style={{ background: NAVY }} />
              <p className="mt-[0.5cqw] font-mono text-[0.95cqw] tracking-[0.25em] uppercase opacity-70">Head Coach signature</p>
              {coachName && <p className="mt-[0.2cqw] font-display text-[1.25cqw] font-semibold">{coachName}</p>}
            </div>
            <ol className="flex flex-col-reverse items-center gap-[0.25cqw]" aria-label="The leadership ladder">
              {rungs.map((r, i) => (
                <li key={r} className="flex items-center gap-[0.6cqw] font-mono text-[0.8cqw] tracking-[0.15em] uppercase">
                  <span className="h-[0.25cqw] w-[2.4cqw]" style={{ background: i === rungs.length - 1 ? PINK : NAVY, opacity: 0.35 + (0.65 * (i + 1)) / rungs.length }} />
                  <span className="w-[19cqw] text-left opacity-80">{r}</span>
                </li>
              ))}
            </ol>
            <div className="text-right">
              <div className="flex h-[5.4cqw] items-end justify-end pb-[0.4cqw]">
                <p className="font-display text-[1.6cqw] font-semibold tabular-nums">{date}</p>
              </div>
              <div className="h-[0.12cqw]" style={{ background: NAVY }} />
              <p className="mt-[0.5cqw] font-mono text-[0.95cqw] tracking-[0.25em] uppercase opacity-70">Date</p>
              {coachName && <p className="mt-[0.2cqw] text-[1.25cqw]">&nbsp;</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
