import Link from "next/link";
import { OutlineText, SpeedStripes } from "@/components/athletic";
import { GOAL_METHOD_LABEL, batsThrows, playerName, type Player } from "@/lib/softball";
import {
  currentRostering, firstName, possessive,
  type ActivityRow, type HaradaChart, type IqData, type MentalPlan, type MetricOption, type Performance, type PopReport,
  type SmartGoal, type TeamDugout, type TwisWeek,
} from "./data";
import { DugoutStrip } from "@/components/dugout-strip";
import { GoalsDetail, GoalsSummary } from "./goals";
import { IqDetail, IqSummary, buildLibrary, buildPositions, buildQuizzes, buildTracks } from "./iq";
import { TrophyRoomDetail, TrophyRoomSummary, buildTrophyRoom } from "./trophy-room";
import { StolenBasePlaque } from "@/components/stolen-base-plaque";
import { ChampionsTrophy } from "@/components/champions-trophy";
import { RingCase } from "@/components/rings";
import { GoldenGlove } from "@/components/golden-glove";
import { MentalDetail, MentalSummary } from "./mental";
import { MenuBoard, type MenuSection } from "./menu";
import { PerformanceDetail, PerformanceSummary, summarizePerformance } from "./performance";
import { PopDetail, PopSummary } from "./pop-report";
import { SmartGoalsPanel, SmartSummary } from "./smart";
import { GoalMethodSwitch } from "./smart-client";
import { TwisBoard } from "./twis";

/** The cafe-menu player dashboard: header, TWIS, then the menu boards. */
export function PlayerMenu({
  player,
  twis,
  chart,
  mental,
  pop,
  activities,
  smartGoals,
  metricOptions,
  performance,
  iq,
  dugout,
  photoUrl,
  today,
  canEdit: editor,
}: {
  player: Player;
  twis: TwisWeek;
  chart: HaradaChart | null;
  smartGoals: SmartGoal[];
  metricOptions: MetricOption[];
  performance: Performance;
  iq: IqData;
  dugout: TeamDugout[];
  photoUrl: string | null;
  mental: MentalPlan | null;
  pop: PopReport;
  activities: ActivityRow[];
  today: string;
  canEdit: boolean;
}) {
  const name = firstName(player);
  const method = player.goal_method ?? "harada";
  const positions = [player.primary_position, ...player.secondary_positions].filter((p): p is NonNullable<typeof p> => Boolean(p));
  const training = summarizePerformance(performance, positions, today);
  const quizzes = buildQuizzes(iq, positions);
  const iqTracks = buildTracks(iq);
  const iqPositions = buildPositions(iq, positions);
  const team = currentRostering(pop);
  const plate = { name: playerName(player), number: team?.jersey_number ?? null }; // engraved on awards
  const library = buildLibrary(iq);
  const room = buildTrophyRoom(iq, iqPositions, training.achievements, plate);

  // The menu. Add a section here (and a board variant in ./menu.tsx if it needs a new look).
  const sections: MenuSection[] = [
    {
      key: "goals",
      title: `${possessive(name)} Goals`,
      subtitle: GOAL_METHOD_LABEL[method],
      variant: "neon",
      wide: true,
      summary: method === "smart" ? <SmartSummary goals={smartGoals} metrics={pop.metrics} /> : <GoalsSummary chart={chart} />,
      detail: (
        <div className="flex flex-col gap-8">
          <GoalMethodSwitch playerId={player.id} method={method} canEdit={editor} />
          {method === "smart" ? (
            <SmartGoalsPanel
              playerId={player.id}
              goals={smartGoals}
              metrics={pop.metrics}
              metricOptions={metricOptions}
              canEdit={editor}
            />
          ) : (
            <GoalsDetail playerId={player.id} chart={chart} canEdit={editor} />
          )}
        </div>
      ),
    },
    {
      key: "pop",
      title: `${possessive(name)} Pop Report`,
      variant: "pink",
      summary: <PopSummary player={player} pop={pop} />,
      detail: <PopDetail player={player} pop={pop} canEdit={editor} photoUrl={photoUrl} />,
    },
    {
      key: "mental",
      title: "Mental GP",
      subtitle: "Mental Game Plan",
      variant: "navy",
      summary: <MentalSummary plan={mental} />,
      detail: <MentalDetail playerId={player.id} plan={mental} canEdit={editor} />,
    },
    {
      key: "performance",
      title: "Performance Training",
      subtitle: "Workouts · stretching · drills",
      variant: "outlineNeon",
      wide: true,
      summary: <PerformanceSummary summary={training} />,
      detail: <PerformanceDetail playerId={player.id} perf={performance} summary={training} today={today} canEdit={editor} />,
    },
    {
      key: "iq",
      title: "Softball IQ",
      subtitle: "Defense IQ · Baserunning IQ · Position IQ · Extra Credit",
      variant: "outlinePink",
      wide: true,
      summary: <IqSummary quizzes={quizzes} tracks={iqTracks} positions={iqPositions} plate={plate} rings={iq.rings} />,
      detail: (
        <IqDetail
          playerId={player.id}
          quizzes={quizzes}
          tracks={iqTracks}
          positions={iqPositions}
          library={library}
          plate={plate}
          iq={iq}
          canEdit={editor}
        />
      ),
    },
    {
      key: "trophies",
      title: `${possessive(name)} Trophy Room`,
      subtitle: "Trophies · rings · Golden Gloves · MVP badges · achievements",
      variant: "trophy",
      wide: true,
      summary: <TrophyRoomSummary room={room} />,
      detail: <TrophyRoomDetail room={room} />,
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
        <Link href="/players" className="relative z-10 text-sm text-muted hover:text-ink sm:absolute sm:top-0 sm:left-0">
          ← Players
        </Link>
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
          <h1 className="mt-3 text-5xl leading-none font-bold tracking-tight text-highlight uppercase sm:text-7xl">
            {name} <span className="text-ink">{player.last_name}</span>
          </h1>
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
        <DugoutStrip teams={dugout} canEdit={editor} />
        <TwisBoard
          playerId={player.id}
          week={twis}
          today={today}
          activities={activities.filter((a) => !a.category)}
          pillars={(chart?.pillars ?? []).map((p) => ({ id: p.id, title: p.title }))}
          canEdit={editor}
        />
      </div>

      <section aria-label="Player menu" className="grid gap-8 md:grid-cols-2">
        {sections.map((section, i) => (
          <MenuBoard key={section.key} section={section} number={i + 1} />
        ))}
      </section>
    </div>
  );
}
