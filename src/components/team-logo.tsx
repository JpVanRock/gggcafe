// The team's logo, large, to the right of a home page's title (user, 2026-11-13): the Coaches
// Dugout (coaches, team admins), the family page (parents) and the player dashboard (her, her
// coaches, her parents viewing as her). Nothing when the team has no logo. Team logos are private
// (signed-in only), shown through a short-lived signed link (lib/team-logos.ts).
import { Suspense, type ReactNode } from "react";
import { myTeamLogo, type TeamLogo } from "@/lib/team-logos";

/** Twice the first size (user, 2026-11-13), then 20% smaller (user, 2026-11-14): 104px on phones, 152px from tablets up. */
const LOGO_SIZE = "h-26 w-26 sm:h-38 sm:w-38";

export function TeamLogoMark({ logo, className = "", sizeClass = LOGO_SIZE }: { logo: TeamLogo | null; className?: string; sizeClass?: string }) {
  if (!logo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
    <img src={logo.url} alt={`${logo.name} logo`} title={logo.name} className={`${sizeClass} shrink-0 rounded-xl object-contain ${className}`} />
  );
}

/** The signed-in coach's or parent's own team (the Dugout, the family page). */
export async function MyTeamLogo() {
  return <TeamLogoMark logo={await myTeamLogo()} />;
}

/**
 * A page's title (its <PageHeader>) with the team's logo to the right, tops lined up (user,
 * 2026-11-13): the Coaches Dugout, the coaches' other main pages (Dashboard, Teams, Players...)
 * and the family page, so the logo is in the same spot on each. Nothing extra without a logo.
 */
export function TitleWithTeamLogo({ children, logo }: { children: ReactNode; /** a page about one chosen team (the Switchboard) passes that team's logo, or null for none */ logo?: TeamLogo | null }) {
  return (
    // mb-4: less empty space under the title and logo (user, 2026-11-14)
    <div className="mb-4 flex items-start justify-between gap-4 [&>header]:mb-0">
      {children}
      {logo !== undefined ? (
        <TeamLogoMark logo={logo} />
      ) : (
        <Suspense fallback={null}>
          <MyTeamLogo />
        </Suspense>
      )}
    </div>
  );
}
