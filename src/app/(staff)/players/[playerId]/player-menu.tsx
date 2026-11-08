import Link from "next/link";
import { OutlineText, SpeedStripes } from "@/components/athletic";
import { GOAL_METHOD_LABEL, batsThrows, playerName, type Player } from "@/lib/softball";
import {
  currentRostering, firstName, possessive,
  type HaradaChart, type IqData, type MentalPlan, type Performance, type PopReport,
  type SmartGoal, type StyleVersion, type TeamDugout, type TwisWeek,
} from "./data";
import { DugoutStrip } from "@/components/dugout-strip";
import { GoalsSummary } from "./goals";
import { IqSummary, buildPositions, buildQuizzes, buildTracks, buildBadgeTracks } from "./iq";
import { TrophyRoomSummary, buildTrophyRoom } from "./trophy-room";
import { StolenBasePlaque } from "@/components/stolen-base-plaque";
import { ChampionsTrophy } from "@/components/champions-trophy";
import { RingCase } from "@/components/rings";
import { GoldenGlove } from "@/components/golden-glove";
import { MentalSummary } from "./mental";
import { MenuBoard, type MenuSection } from "./menu";
import { PerformanceSummary, summarizePerformance } from "./performance";
import { PopSummary } from "./pop-report";
import { SmartSummary } from "./smart";
import { TwisBoard } from "./twis";
import { AdvancedLocked, AdvancedSummary, LEVEL_LABEL, advancedHref } from "./advanced";
import type { AdvancedBook } from "./advanced-data";
import type { LessonWork } from "@/lib/leadership-guide";
import { PlayerName } from "./player-name";
import { MentorAlerts } from "./mentor-messages";
import type { MentorMessage } from "@/lib/message-photos";
import { leadershipHref } from "./leadership";

/** The cafe-menu player dashboard: header, TWIS, then the menu boards. */
export function PlayerMenu({
  player,
  twis,
  chart,
  mental,
  pop,
  smartGoals,
  performance,
  iq,
  dugout,
  photoUrl,
  styles,
  today,
  canEdit: editor,
  advanced,
  leadership = null,
  leader = false,
  mentorMessages = null,
  isAdmin = false,
  canWriteCulture = false,
  isSelf = false,
}: {
  player: Player;
  twis: TwisWeek;
  chart: HaradaChart | null;
  smartGoals: SmartGoal[];
  performance: Performance;
  iq: IqData;
  dugout: TeamDugout[];
  photoUrl: string | null;
  styles: { movement: StyleVersion[]; hitting: StyleVersion[] };
  mental: MentalPlan | null;
  pop: PopReport;
  today: string;
  /** coach/admin or the player herself */
  canEdit: boolean;
  /** G3 Advanced: shown only when unlocked for her */
  advanced: AdvancedBook;
  /** her G3 Leadership Guide work, when she's in it */
  leadership?: LessonWork[] | null;
  /** she earned the Leader Badge (only coaches/admins and she herself are told) */
  leader?: boolean;
  /** messages from her mentors: new ones show as alerts at the top */
  mentorMessages?: { unread: MentorMessage[]; total: number; photoUrls: Map<string, string> } | null;
  /** admins see an unlock control while G3 Advanced is locked */
  isAdmin?: boolean;
  /** head coaches/admins: links to write the team's standards and culture */
  canWriteCulture?: boolean;
  /** the signed-in player viewing her own dashboard */
  isSelf?: boolean;
}) {
  const name = firstName(player);
  const method = player.goal_method ?? "harada";
  const positions = [player.primary_position, ...player.secondary_positions].filter((p): p is NonNullable<typeof p> => Boolean(p));
  const training = summarizePerformance(performance, positions, today);
  const quizzes = buildQuizzes(iq, positions);
  const iqTracks = buildTracks(iq);
  const iqBadgeTracks = buildBadgeTracks(iq);
  const iqPositions = buildPositions(iq, positions);
  const team = currentRostering(pop);
  const plate = { name: playerName(player), number: team?.jersey_number ?? null }; // engraved on awards
  const room = buildTrophyRoom(iq, iqPositions, training.achievements, plate);

  // The menu. Add a section here (and a board variant in ./menu.tsx if it needs a new look).
  const base = `/players/${player.id}`;
  const sections: MenuSection[] = [
    {
      key: "goals",
      title: `${possessive(name)} Goals`,
      subtitle: GOAL_METHOD_LABEL[method],
      variant: "neon",
      wide: true,
      summary: method === "smart" ? <SmartSummary goals={smartGoals} metrics={pop.metrics} /> : <GoalsSummary chart={chart} />,
      href: `${base}/goals`,
    },
    {
      key: "pop",
      title: `${possessive(name)} Pop Report`,
      variant: "pink",
      // Movement Preferences is G3 Advanced
      summary: <PopSummary player={player} pop={pop} styles={advanced.unlocked ? styles : { ...styles, movement: [] }} />,
      href: `${base}/pop`,
    },
    {
      key: "mental",
      title: "Mental GP",
      subtitle: "Mental Game Plan",
      variant: "navy",
      summary: <MentalSummary plan={mental} />,
      href: `${base}/mental`,
    },
    {
      key: "performance",
      title: "Performance Training",
      subtitle: "Workouts · stretching · drills",
      variant: "outlineNeon",
      wide: true,
      summary: <PerformanceSummary summary={training} />,
      href: `${base}/training`,
    },
    {
      key: "iq",
      title: "Softball IQ",
      subtitle: "Defense IQ · Baserunning IQ · Position IQ · Extra Credit",
      variant: "outlinePink",
      wide: true,
      summary: <IqSummary quizzes={quizzes} tracks={iqTracks} badgeTracks={iqBadgeTracks} positions={iqPositions} plate={plate} rings={iq.rings} bookDone={iq.managerAwards.length} />,
      href: `${base}/iq`,
    },
    ...(advanced.unlocked
      ? [
          {
            key: "advanced",
            title: advanced.title,
            subtitle: LEVEL_LABEL,
            variant: "advanced" as const,
            wide: true,
            summary: <AdvancedSummary book={advanced} leadership={leadership} />,
            href: advancedHref(player.id),
          },
        ]
      : []),
    {
      key: "trophies",
      title: `${possessive(name)} Trophy Room`,
      subtitle: "Trophies · rings · Golden Gloves · MVP badges · achievements",
      variant: "trophy",
      wide: true,
      summary: <TrophyRoomSummary room={room} />,
      href: `${base}/trophies`,
    },
  ];

  const tagline = [
    team?.jersey_number && `#${team.jersey_number}`,
    player.primary_position,
    batsThrows(player) !== "–" && `B/T ${batsThrows(player)}`,
    player.grad_year && `Class of ${player.grad_year}`,
    team?.team?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-12">
      <header className="relative overflow-hidden pt-2 text-center">
        {!isSelf && (
          <Link href="/players" className="relative z-10 text-sm text-muted hover:text-ink sm:absolute sm:top-0 sm:left-0">
            ← Players
          </Link>
        )}
        {/* Jersey number behind the name, media-day style */}
        <OutlineText className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11rem] tracking-tighter sm:text-[15rem]">
          {team?.jersey_number ?? player.primary_position ?? ""}
        </OutlineText>
        <div className="relative pt-6 sm:pt-10">
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
            <img
              src={photoUrl}
              alt={`${name} ${player.last_name}`}
              className="mx-auto mb-5 size-28 rounded-full border-2 border-neon object-cover shadow-[0_0_0_6px_rgb(0_10_45),0_0_0_7px_rgb(254_31_124)] sm:size-32"
            />
          )}
          <p className="flex items-center justify-center gap-3 font-mono text-xs tracking-[0.35em] text-pink-soft uppercase">
            <SpeedStripes className="h-3 w-9 text-pink" />
            Player menu
            <SpeedStripes className="h-3 w-9 text-pink" />
          </p>
          <PlayerName first={name} last={player.last_name} leaderHref={leader ? leadershipHref(player.id, "certificate") : null} />
          {tagline && <p className="mx-auto mt-4 max-w-2xl font-mono text-sm text-muted">{tagline}</p>}
          {player.walk_up_songs.length > 0 && (
            <p className="mx-auto mt-3 flex max-w-2xl flex-wrap items-baseline justify-center gap-x-4 gap-y-1 text-sm">
              <span className="font-mono text-[0.75rem] leading-4 tracking-[0.25em] text-pink-soft uppercase">Walk-up</span>
              {player.walk_up_songs.map((song, i) => {
                const label = `${song.title}${song.artist ? ` · ${song.artist}` : ""}`;
                return song.link ? (
                  <a key={i} href={song.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:text-pink">
                    {label} ↗
                  </a>
                ) : (
                  <span key={i} className="font-semibold text-ink">
                    {label}
                  </span>
                );
              })}
            </p>
          )}
          {(iq.rings.length > 0 || iq.gloves.length > 0 || room.championsOn) && (
            <div className="mt-6 flex flex-wrap items-end justify-center gap-6" aria-label="Trophies, rings and Golden Gloves">
              {room.plaques
                .filter((p) => p.earnedOn)
                .map((p) => (
                  <StolenBasePlaque key={p.level} name={plate.name} number={plate.number} level={p.level} engrave={false} size={48} />
                ))}
              {iq.rings.length > 0 && <RingCase earned={iq.rings} size={44} />}
              {iqPositions
                .filter((p) => p.earnedOn)
                .map((p) => (
                  <GoldenGlove key={p.position} name={plate.name} number={plate.number} position={p.label} engrave={false} size={72} />
                ))}
              {room.championsOn && <ChampionsTrophy size={52} />}
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {mentorMessages && (
          <MentorAlerts
            playerId={player.id}
            unread={mentorMessages.unread}
            total={mentorMessages.total}
            photoUrls={mentorMessages.photoUrls}
            canDismiss={isSelf}
          />
        )}
        <DugoutStrip teams={dugout} canEdit={canWriteCulture} teamHref={`${base}/team`} yearbookHref={advanced.unlocked ? `${base}/yearbook` : undefined} leaderboardHref={`${base}/leaderboard`} activityHref={`${base}/log`} />
        <TwisBoard
          playerId={player.id}
          week={twis}
          today={today}
          canEdit={editor}
        />
      </div>

      <section aria-label="Player menu" className="grid gap-8 md:grid-cols-2">
        {sections.map((section, i) => (
          <MenuBoard key={section.key} section={section} number={i + 1} />
        ))}
      </section>
      {isAdmin && !advanced.unlocked && <AdvancedLocked playerId={player.id} name={name} />}
    </div>
  );
}
