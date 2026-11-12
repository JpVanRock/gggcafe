// The team's logo next to the GGG.Cafe logo at the top left of coaches' and parents' pages, when the
// team has one (user, 2026-11-12). Team logos are private (signed-in only), shown through a
// short-lived signed link (lib/team-logos.ts).
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
