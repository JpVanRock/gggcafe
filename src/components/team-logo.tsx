// The team's logo, large, to the right of a home page's title (user, 2026-11-13): the Coaches
// Dugout (coaches, team admins), the family page (parents) and the player dashboard (her, her
// coaches, her parents viewing as her). Nothing when the team has no logo. Team logos are private
// (signed-in only), shown through a short-lived signed link (lib/team-logos.ts).
import { myTeamLogo, type TeamLogo } from "@/lib/team-logos";

export function TeamLogoMark({ logo, className = "" }: { logo: TeamLogo | null; className?: string }) {
  if (!logo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
    <img src={logo.url} alt={`${logo.name} logo`} title={logo.name} className={`h-16 w-16 shrink-0 rounded-xl object-contain sm:h-24 sm:w-24 ${className}`} />
  );
}

/** The signed-in coach's or parent's own team (the Dugout, the family page). */
export async function MyTeamLogo() {
  return <TeamLogoMark logo={await myTeamLogo()} />;
}
