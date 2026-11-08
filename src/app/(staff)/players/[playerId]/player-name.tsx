// Her name at the top of the player menu, with the Leader Badge on the same line
// when she's earned it (only passed for coaches/admins and the player herself).
// "Team Lead" sits centered above the badge in the same lettering as "Player
// menu" (user, 2026-11-08). The badge (not the label) centers on her name. When
// her name fills the line (phones, narrow windows) the badge takes its own row
// just under it; the header clips overflow, so the label never hangs outside.
import Link from "next/link";
import { LeaderBadge } from "@/components/leader-badge";

export function PlayerName({ first, last, leaderHref }: { first: string; last: string; leaderHref?: string | null }) {
  return (
    <h1
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-4 text-5xl leading-none font-bold tracking-tight text-highlight uppercase sm:gap-x-5 sm:text-7xl ${
        leaderHref ? "mt-6 sm:mt-8" : "mt-3"
      }`}
    >
      <span>
        {first} <span className="text-ink">{last}</span>
      </span>
      {leaderHref && (
        // -top-2.5: half the label's height, so the badge (not the label) centers on her name
        <Link
          href={leaderHref}
          className="relative -top-2.5 flex shrink-0 flex-col items-center gap-1.5 transition hover:scale-105"
          title="Team Lead · Certificate of Leadership"
        >
          <span className="pl-[0.35em] font-mono text-xs leading-none font-normal tracking-[0.35em] whitespace-nowrap text-pink-soft">TEAM LEAD</span>
          <LeaderBadge className="block h-auto w-11 sm:w-14" size={56} />
        </Link>
      )}
    </h1>
  );
}
