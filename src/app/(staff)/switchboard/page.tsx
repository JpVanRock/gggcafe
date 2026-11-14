import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { PageHeader, badgeClass, eyebrowClass } from "@/components/ui";
import { formatLongDateAt } from "@/lib/dates";
import { ALWAYS_ON, AUDIENCES, switchesFor, type SwitchKey } from "@/lib/switchboard";
import { NoOwnTeam, pickTeam } from "../dugout/team-picker";
import { setAudience, setFeature, setMentorVideo, setTeamVideo } from "./actions";
import { zoomConfigured } from "@/lib/zoom";
import type { FormState } from "@/lib/form";
import { TitleWithTeamLogo } from "@/components/team-logo";
import { TeamSelect } from "@/components/team-select";
import { signedLogoUrl } from "@/lib/team-logos";

export const metadata: Metadata = { title: "Switchboard · GGG.Cafe" };

/** One on/off switch: a submit button that flips it (a Switchboard feature, or video calls). */
function Toggle({
  teamId,
  feature,
  on,
  label,
  action = setFeature,
}: {
  teamId: string;
  feature?: SwitchKey;
  on: boolean;
  label: string;
  action?: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  return (
    <ActionForm action={action} className="flex shrink-0 flex-col items-end">
      <input type="hidden" name="team_id" value={teamId} />
      {feature && <input type="hidden" name="feature" value={feature} />}
      <input type="hidden" name="on" value={on ? "false" : "true"} />
      <button
        type="submit"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className="group inline-flex items-center gap-2 text-2xs font-bold tracking-[0.14em] uppercase"
      >
        <span className={on ? "text-highlight" : "text-muted"}>{on ? "On" : "Off"}</span>
        <span className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${on ? "border-neon bg-neon" : "border-navy-600 bg-navy-800"}`}>
          <span className={`absolute size-4 rounded-full transition-all ${on ? "left-6 bg-navy-950" : "left-1 bg-muted"}`} />
        </span>
      </button>
    </ActionForm>
  );
}

// The Switchboard (user, 2026-11-12): the head coach turns parts of the site on or off for one
// team, for Players, Parents and Mentors. Everything starts on. Off hides it on the site and
// stops new posts; nothing saved is lost, and switching it back on brings it all back.
export default async function SwitchboardPage({ searchParams }: PageProps<"/switchboard">) {
  const user = await requireStaffPage();
  if (!isHeadCoach(user.staff.role)) notFound();
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  // our teams (not opponents), with what tells them apart in the dropdown, and every team's switched-off rows
  const [{ data: teamRows }, { data: allOff }] = await Promise.all([
    supabase.from("teams").select("id, name, age_group, organization, format, logo_path, team_code").eq("is_own_team", true).order("name"),
    supabase.from("team_features_off").select("team_id, feature, turned_off_at"),
  ]);
  const teams = teamRows ?? [];
  if (!teams.length) return <NoOwnTeam />;
  const team = pickTeam(teams, teamParam);
  const [{ data: video }, logoUrl] = await Promise.all([
    supabase.from("team_video_access").select("mentors_on").eq("team_id", team.id).maybeSingle(),
    signedLogoUrl(supabase, team.logo_path),
  ]);
  // video calls (user, 2026-11-12): a site admin turns them on per team; then the head coach decides for mentors
  const admin = user.staff.role === "admin";
  const offRows = (allOff ?? []).filter((r) => r.team_id === team.id);
  const off = new Map(offRows.map((r) => [r.feature, r.turned_off_at]));
  const offCount = off.size;
  const offByTeam = new Map<string, number>();
  for (const r of allOff ?? []) offByTeam.set(r.team_id, (offByTeam.get(r.team_id) ?? 0) + 1);
  // what sets one team apart from another with a similar name: age group, organization, slowpitch
  const details = (t: (typeof teams)[number]) => [t.age_group, t.organization, t.format === "slowpitch" ? "Slowpitch" : null].filter(Boolean).join(" · ");
  const options = teams.map((t) => {
    const n = offByTeam.get(t.id) ?? 0;
    return { id: t.id, label: [t.name, details(t), n ? `${n} off` : null].filter(Boolean).join(" · ") };
  });

  return (
    <div className="flex flex-col gap-8">
      <TitleWithTeamLogo logo={logoUrl ? { name: team.name, url: logoUrl } : null}>
        <PageHeader
          title="Switchboard"
          description={`What players, parents and mentors on ${team.name} can use. Everything starts on. Off hides it on the site and stops new posts; nothing saved is lost, and switching it back on brings it all back.`}
        />
      </TitleWithTeamLogo>
      {/* the team being adjusted, and (admins, or a coach of several teams) a dropdown of every registered
          team (user, 2026-11-14: "so it is easy to identify what team the admin is adjusting") */}
      <section aria-label="Team" className="-mt-2 flex flex-wrap items-end justify-between gap-4 rounded-2xl border-2 border-pink/70 bg-navy-900/70 p-4 sm:p-5">
        <div className="min-w-0">
          <p className={eyebrowClass}>Adjusting the switches for</p>
          <p className="mt-1 font-display text-2xl leading-tight font-bold tracking-wide break-words text-highlight uppercase sm:text-3xl">{team.name}</p>
          {details(team) && <p className="mt-1 text-sm text-muted">{details(team)}</p>}
        </div>
        {(admin || teams.length > 1) && (
          <TeamSelect
            teams={options}
            current={team.id}
            basePath="/switchboard"
            label="Switch team"
            hint={`${teams.length} registered ${teams.length === 1 ? "team" : "teams"}`}
          />
        )}
      </section>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-navy-700 bg-navy-900/60 px-4 py-3 text-sm">
        <span>
          <span className={eyebrowClass}>Sign-up with the team code</span>{" "}
          <span className={badgeClass(team.team_code ? "neon" : "neutral")}>{team.team_code ? "On" : "Off"}</span>
        </span>
        <span className="text-muted">
          New players, parents, assistant coaches and mentors join with it.{" "}
          <Link href={`/dugout/roster?team=${team.id}`} className="text-link underline underline-offset-2">
            Change it on the Roster tab →
          </Link>
        </span>
        <span className="ml-auto font-display text-sm text-muted tabular-nums">{offCount ? `${offCount} switched off on ${team.name}` : `Everything on for ${team.name}`}</span>
      </div>

      <section aria-labelledby="sb-video" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-navy-700 bg-navy-900/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id="sb-video" className="font-semibold">
            Video calls (Zoom) <span className={badgeClass(video ? "neon" : "neutral")}>{video ? "On" : "Off"}</span>
          </h2>
          <p className="text-xs text-muted">
            Mentors and head coaches book Zoom calls with one player, held here on GGG.Cafe. Her parents are told and can join; nothing is recorded.{" "}
            {admin ? "Only site admins turn this on or off for a team." : video ? "A site admin turned it on for this team." : "Only a site admin can turn it on for this team."}
            {admin && !zoomConfigured() && " Zoom isn't connected yet: add the Zoom keys in Vercel."}
          </p>
        </div>
        {admin && <Toggle teamId={team.id} on={Boolean(video)} label="Video calls for this team" action={setTeamVideo} />}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {AUDIENCES.map((a) => {
          const switches = switchesFor(a.key);
          const allOn = switches.every((s) => !off.has(s.key));
          const allOff = switches.every((s) => off.has(s.key));
          return (
            <section key={a.key} aria-labelledby={`sb-${a.key}`} className="flex flex-col gap-4 rounded-2xl border border-navy-700 bg-navy-900/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id={`sb-${a.key}`} className="font-display text-2xl leading-none font-bold tracking-wide text-highlight uppercase">
                    {a.label}
                  </h2>
                  <p className="mt-2 text-xs text-muted">{a.note}</p>
                </div>
                <div className="flex gap-3 text-xs font-semibold">
                  {!allOn && (
                    <ActionForm action={setAudience}>
                      <input type="hidden" name="team_id" value={team.id} />
                      <input type="hidden" name="audience" value={a.key} />
                      <input type="hidden" name="on" value="true" />
                      <button type="submit" className="text-link hover:underline">
                        All on
                      </button>
                    </ActionForm>
                  )}
                  {!allOff && (
                    <ActionForm action={setAudience}>
                      <input type="hidden" name="team_id" value={team.id} />
                      <input type="hidden" name="audience" value={a.key} />
                      <input type="hidden" name="on" value="false" />
                      <button type="submit" className="text-muted hover:text-danger">
                        All off
                      </button>
                    </ActionForm>
                  )}
                </div>
              </div>
              <ul className="flex flex-col divide-y divide-navy-800">
                {switches.map((sw) => {
                  const since = off.get(sw.key);
                  return (
                    <li key={sw.key} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className={`font-semibold ${since ? "text-muted" : ""}`}>{sw.label}</p>
                        <p className="text-xs text-muted">{sw.detail}</p>
                        {since && <p className="mt-0.5 text-2xs text-muted">Off since {formatLongDateAt(since)}</p>}
                      </div>
                      <Toggle teamId={team.id} feature={sw.key} on={!since} label={`${a.label}: ${sw.label}`} />
                    </li>
                  );
                })}
                {a.key === "mentors" && (
                  <li className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className={`font-semibold ${video?.mentors_on ? "" : "text-muted"}`}>Video calls</p>
                      <p className="text-xs text-muted">Book Zoom calls with players; her parents are told and can join. Starts off.</p>
                    </div>
                    {video ? (
                      <Toggle teamId={team.id} on={video.mentors_on} label="Mentors: Video calls" action={setMentorVideo} />
                    ) : (
                      <span className={badgeClass("neutral")}>Needs a site admin</span>
                    )}
                  </li>
                )}
                {ALWAYS_ON.filter((x) => x.audience === a.key).map((x) => (
                  <li key={x.label} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{x.label}</p>
                      <p className="text-xs text-muted">{x.why}</p>
                    </div>
                    <span className={badgeClass("neutral")}>Always on</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        A player on more than one team loses a feature when any of her teams switches it off. Coaches and admins always see everything.
      </p>
    </div>
  );
}
