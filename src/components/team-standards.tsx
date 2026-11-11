// How a team's Standards and Culture look to players: on the player dashboard
// (pop-ups above TWIS) and as the preview in the Coaches Dugout. Server-safe.
import { OutlineText, SpeedStripes } from "@/components/athletic";
import { RichText } from "@/components/rich-text";

export type TeamStandard = { title: string; detail: string | null; /** its row, when saved: a save keeps it by id */ id?: string };
export type TeamCulture = { headline: string | null; statement: string | null; /** the season motto (Phase 5) */ motto?: string | null };

/** Numbered standards with outlined numerals, like a locker-room wall. */
export function StandardsList({ standards }: { standards: TeamStandard[] }) {
  return (
    <ol className="grid gap-x-10 gap-y-6 md:grid-cols-2">
      {standards.map((s, i) => (
        <li key={i} className="flex gap-4">
          <OutlineText className="w-14 shrink-0 text-5xl" stroke="var(--color-pink)">
            {String(i + 1).padStart(2, "0")}
          </OutlineText>
          <div className="min-w-0 border-l border-navy-700 pl-4">
            <p className="text-lg leading-snug font-semibold text-ink uppercase tracking-wide">{s.title}</p>
            {s.detail && <p className="mt-1 text-sm text-muted">{s.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Headline in big type, then the coach's description, one paragraph per blank line. */
export function CultureStatement({ culture }: { culture: TeamCulture }) {
  const paragraphs = (culture.statement ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className="mx-auto max-w-3xl">
      {culture.headline && (
        <div className="mb-6">
          <SpeedStripes className="h-4 w-12 text-link" />
          <p className="mt-3 font-display text-3xl leading-tight font-bold tracking-tight text-highlight uppercase sm:text-4xl">
            {culture.headline}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-4 text-base leading-relaxed text-ink">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            <RichText text={p} />
          </p>
        ))}
      </div>
    </div>
  );
}

export function hasCulture(culture: TeamCulture | null): culture is TeamCulture {
  return Boolean(culture && (culture.headline || culture.statement));
}
