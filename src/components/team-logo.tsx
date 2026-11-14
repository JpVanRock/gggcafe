// The team's logo, large, to the right of a home page's title (user, 2026-11-13): the Coaches
// Dugout (coaches, team admins), the family page (parents) and the player dashboard (her, her
// coaches, her parents viewing as her). Nothing when the team has no logo. Team logos are private
// (signed-in only), shown through a short-lived signed link (lib/team-logos.ts).
import { myTeamLogo, type TeamLogo } from "@/lib/team-logos";

/** Twice the first size (user, 2026-11-13): 128px on phones, 192px from tablets up. */
const LOGO_SIZE = "h-32 w-32 sm:h-48 sm:w-48";

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
