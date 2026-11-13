// The team's logo, when the team has one. Team logos are private (signed-in only), shown through a
// short-lived signed link (lib/team-logos.ts).
// - HeaderTeamLogo: next to the GGG.Cafe logo at the top left of parents' pages (user, 2026-11-12).
// - DugoutTeamLogo: coaches see it large, to the right of the Coaches Dugout title on every Dugout
//   tab, under the Switchboard (user, 2026-11-13); it left their header.
import { headerTeamLogo } from "@/lib/team-logos";

export async function HeaderTeamLogo() {
  const logo = await headerTeamLogo();
  if (!logo) return null;
  return (
    <span className="flex shrink-0 items-center gap-3">
      <span aria-hidden className="h-8 w-px bg-navy-700" />
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL */}
      <img src={logo.url} alt={`${logo.name} logo`} title={logo.name} className="h-11 w-11 rounded-lg object-contain" />
    </span>
  );
}

export async function DugoutTeamLogo() {
  const logo = await headerTeamLogo();
  if (!logo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
    <img
      src={logo.url}
      alt={`${logo.name} logo`}
      title={logo.name}
      className="h-16 w-16 shrink-0 rounded-xl object-contain sm:h-24 sm:w-24"
    />
  );
}
