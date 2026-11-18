// Her name at the top of the player menu, with the Leader Badge on the same line
// when she's earned it (only passed for coaches/admins and the player herself).
// "Team Lead" sits centered above the badge in the same lettering as "Player
// menu" (user, 2026-11-08). The badge (not the label) centers on her name. When
// her name fills the line (phones, narrow windows) the badge takes its own row
// just under it; the header clips overflow, so the label never hangs outside.
import Link from "next/link";
import { LeaderBadge } from "@/components/leader-badge";

export function PlayerName({ first, last, leaderHref }: { first: string; last: string; leaderHref?: string | null }) {
  // The heading is just her name, with an explicit label (screen readers ran the two-tone halves together as
  // "MAYATORRES"), and the Team Lead badge is a link beside it, not inside it (design audit 2026-11-18, A5).
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-4 sm:gap-x-5 ${leaderHref ? "mt-6 sm:mt-8" : "mt-3"}`}
    >
      <h1 aria-label={`${first} ${last}`} className="text-5xl leading-none font-bold tracking-tight text-highlight uppercase sm:text-7xl">
        {first} <span className="text-ink">{last}</span>
      </h1>
      {leaderHref && (
        // beside her name (640px up) -top-2.5 centers the badge, not its label, on the name; when it wraps under
        // the name on a phone it keeps the full gap, so "TEAM LEAD" doesn't touch the name (design audit P5)
        <Link
          href={leaderHref}
          className="relative flex shrink-0 flex-col items-center gap-1.5 transition hover:scale-105 sm:-top-2.5"
          title="Team Lead · Certificate of Leadership"
        >
          <span className="pl-[0.35em] font-mono text-xs leading-none font-normal tracking-[0.35em] whitespace-nowrap text-pink-soft">TEAM LEAD</span>
          <LeaderBadge className="block h-auto w-11 sm:w-14" size={56} />
        </Link>
      )}
    </div>
  );
}
