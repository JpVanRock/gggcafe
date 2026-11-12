import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { PageHeader, badgeClass, eyebrowClass } from "@/components/ui";
import { formatLongDateAt } from "@/lib/dates";
import { ALWAYS_ON, AUDIENCES, switchesFor, type SwitchKey } from "@/lib/switchboard";
import { loadDugoutTeam } from "../dugout/data";
import { NoOwnTeam, TeamPicker } from "../dugout/team-picker";
import { setAudience, setFeature } from "./actions";

export const metadata: Metadata = { title: "Switchboard · GGG.Cafe" };

/** One on/off switch: a submit button that flips it. */
function Toggle({ teamId, feature, on, label }: { teamId: string; feature: SwitchKey; on: boolean; label: string }) {
  return (
    <ActionForm action={setFeature} className="flex shrink-0 flex-col items-end">
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="feature" value={feature} />
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
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const [{ data: offRows }, { data: teamRow }] = await Promise.all([
    supabase.from("team_features_off").select("feature, turned_off_at").eq("team_id", team.id),
    supabase.from("teams").select("team_code").eq("id", team.id).maybeSingle(),
  ]);
  const off = new Map((offRows ?? []).map((r) => [r.feature, r.turned_off_at]));
  const offCount = off.size;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Switchboard"
        description={`What players, parents and mentors on ${team.name} can use. Everything starts on. Off hides it on the site and stops new posts; nothing saved is lost, and switching it back on brings it all back.`}
      />
      <TeamPicker teams={teams} current={team.id} basePath="/switchboard" />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-navy-700 bg-navy-900/60 px-4 py-3 text-sm">
        <span>
          <span className={eyebrowClass}>Sign-up with the team code</span>{" "}
          <span className={badgeClass(teamRow?.team_code ? "neon" : "neutral")}>{teamRow?.team_code ? "On" : "Off"}</span>
        </span>
        <span className="text-muted">
          New players, parents, assistant coaches and mentors join with it.{" "}
          <Link href={`/dugout/roster?team=${team.id}`} className="text-link underline underline-offset-2">
            Change it on the Roster tab →
          </Link>
        </span>
        <span className="ml-auto font-display text-sm text-muted tabular-nums">{offCount ? `${offCount} switched off` : "Everything on"}</span>
      </div>

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
