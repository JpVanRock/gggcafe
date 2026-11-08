// The Trophy Room: every accolade a player has earned, in one place.
// Shelves, top to bottom:
//  - championship rings (playbook levels)
//  - Stolen Base Leader plaques (one per Baserunning IQ level passed)
//  - Golden Gloves (position tests)
//  - MVP badges (every miss on a test reviewed, or a perfect score)
//  - Manager of the Year (one per How to Keep the Book chapter)
//  - Hidden awards from the How to Keep the Book games: the GGG World Series Trophy
//    (a clean book in any game) and the GGG Dynasty Trophy (clean books in all ten).
//    They show up only once earned: no placeholder, no count, nothing that names them.
//  - Performance Training achievements
//  - GGG Champions Trophy (Extra Credit Library run at 80%+)
import { RingCase } from "@/components/rings";
import { GoldenGlove } from "@/components/golden-glove";
import { MvpBadge } from "@/components/mvp-badge";
import { StolenBasePlaque } from "@/components/stolen-base-plaque";
import { ChampionsTrophy } from "@/components/champions-trophy";
import { ManagerAward } from "@/components/manager-award";
import { WorldSeriesTrophy } from "@/components/world-series-trophy";
import { DYNASTY_TROPHY, DynastyTrophy } from "@/components/dynasty-trophy";
import { CHAPTERS } from "@/lib/scorebook";
import { formatLongDate } from "@/lib/dates";
import type { AchievementProgress } from "@/lib/achievements";
import type { IqData } from "./data";
import type { Nameplate, PositionInfo } from "./iq-client";
import { GloveCase } from "./iq";
import { DetailHeading, MenuItem } from "./menu";
import { HexBadge } from "./performance";

export type TrophyRoom = {
  plate: Nameplate;
  championsOn: string | null;
  /** one Stolen Base Leader plaque per Baserunning IQ level */
  plaques: { level: number; earnedOn: string | null }[];
  rings: IqData["rings"];
  positions: PositionInfo[];
  mvps: { key: string; label: string; earnedOn: string }[];
  /** Manager of the Year, one per How to Keep the Book chapter */
  managers: { chapter: number; label: string; earnedOn: string | null; year: string | null }[];
  /** hidden: null until she finds them */
  worldSeriesOn: string | null;
  dynastyOn: string | null;
  achievements: AchievementProgress[];
};

function mvpLabel(m: IqData["mvps"][number]) {
  if (m.track === "position") return `${m.position} · Golden Glove`;
  if (m.track === "extra") return "Extra Credit";
  return `${m.track === "defense" ? "Defense" : "Baserunning"} · L${m.level}`;
}

export function buildTrophyRoom(iq: IqData, positions: PositionInfo[], achievements: AchievementProgress[], plate: Nameplate): TrophyRoom {
  return {
    plate,
    championsOn: iq.championsTrophy ? formatLongDate(iq.championsTrophy.earned_on) : null,
    plaques: [1, 2, 3].map((level) => {
      const ring = iq.rings.find((r) => r.track === "baserunning" && r.level === level);
      return { level, earnedOn: ring ? formatLongDate(ring.earned_on) : null };
    }),
    rings: iq.rings,
    positions,
    mvps: iq.mvps.map((m) => ({
      key: `${m.track}-${m.level}-${m.position ?? ""}`,
      label: mvpLabel(m),
      earnedOn: formatLongDate(m.earned_on),
    })),
    managers: CHAPTERS.map((c) => {
      const award = iq.managerAwards.find((a) => a.chapter === c.n);
      return {
        chapter: c.n,
        label: `Chapter ${c.n} · ${c.short}`,
        earnedOn: award ? formatLongDate(award.earned_on) : null,
        year: award ? award.earned_on.slice(0, 4) : null,
      };
    }),
    worldSeriesOn: (() => {
      const award = iq.hiddenAwards.find((a) => a.award === "world-series");
      return award ? formatLongDate(award.earned_on) : null;
    })(),
    dynastyOn: (() => {
      const award = iq.hiddenAwards.find((a) => a.award === "all-ten");
      return award ? formatLongDate(award.earned_on) : null;
    })(),
    achievements: achievements.filter((a) => a.unlockedOn),
  };
}

export function TrophyRoomSummary({ room }: { room: TrophyRoom }) {
  const gloves = room.positions.filter((p) => p.earnedOn);
  const plaques = room.plaques.filter((p) => p.earnedOn);
  const managers = room.managers.filter((m) => m.earnedOn);
  const nothing =
    !room.championsOn && !plaques.length && !room.rings.length && !gloves.length && !room.mvps.length && !managers.length &&
    !room.worldSeriesOn && !room.dynastyOn && !room.achievements.length;
  return (
    <div>
      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-3">
        <MenuItem name="Championship rings" value={`${room.rings.length}/6`} />
        <MenuItem name="Stolen Base Leader" value={`${plaques.length}/3`} note="A plaque for each Baserunning IQ level" />
        <MenuItem name="Golden Gloves" value={`${gloves.length}/9`} note={gloves.length ? gloves.map((g) => g.position).join(", ") : undefined} />
        <MenuItem name="MVP badges" value={room.mvps.length} />
        <MenuItem name="Manager of the Year" value={`${managers.length}/${room.managers.length}`} note="One for each How to Keep the Book chapter" />
        {room.worldSeriesOn && <MenuItem name="World Series Trophy" value="✓" note={`Found ${room.worldSeriesOn}`} />}
        {room.dynastyOn && <MenuItem name={DYNASTY_TROPHY.replace("GGG ", "")} value="✓" note={`Found ${room.dynastyOn}`} />}
        <MenuItem name="Training achievements" value={room.achievements.length} />
        <MenuItem name="Champions Trophy" value={room.championsOn ? "✓" : "–"} note={room.championsOn ? `Won ${room.championsOn}` : "Extra Credit Library"} />
      </div>
      {nothing ? (
        <p className="mt-5 text-sm text-muted">The shelves are empty for now. Every ring, glove, badge and trophy she earns lands here.</p>
      ) : (
        <div className="mt-6 flex flex-wrap items-end justify-center gap-5">
          {room.rings.length > 0 && <RingCase earned={room.rings} size={36} showLabels={false} />}
          {plaques.map((p) => (
            <StolenBasePlaque key={p.level} name={room.plate.name} number={room.plate.number} level={p.level} engrave={false} size={48} />
          ))}
          {gloves.map((g) => (
            <GoldenGlove key={g.position} name={room.plate.name} number={room.plate.number} position={g.label} engrave={false} size={70} />
          ))}
          {room.mvps.slice(0, 6).map((m) => (
            <MvpBadge key={m.key} label={m.label} size={52} />
          ))}
          {managers.map((m) => (
            <ManagerAward key={m.chapter} name={room.plate.name} chapter={m.label} engrave={false} size={48} />
          ))}
          {room.worldSeriesOn && <WorldSeriesTrophy size={46} />}
          {room.dynastyOn && <DynastyTrophy size={46} />}
          {room.championsOn && <ChampionsTrophy size={56} />}
        </div>
      )}
    </div>
  );
}

function Shelf({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-navy-700 bg-navy-950/50 p-5">
      <DetailHeading>{title}</DetailHeading>
      {note && <p className="-mt-1 mb-4 text-xs text-muted">{note}</p>}
      {children}
    </section>
  );
}

export function TrophyRoomDetail({ room }: { room: TrophyRoom }) {
  const gloves = room.positions.filter((p) => p.earnedOn);
  const managers = room.managers.filter((m) => m.earnedOn);
  return (
    <div className="flex flex-col gap-6">
      <Shelf title="Championship rings" note={`${room.rings.length} of 6 · one per playbook level passed with 80%+`}>
        <RingCase earned={room.rings} size={76} />
      </Shelf>

      <Shelf title="Stolen Base Leader plaques" note="One for each Baserunning IQ level passed with 80%+.">
        <ul className="flex flex-wrap justify-center gap-6">
          {room.plaques.map((p) => (
            <li key={p.level} className="flex flex-col items-center gap-2">
              <StolenBasePlaque name={room.plate.name} number={room.plate.number} level={p.level} earned={Boolean(p.earnedOn)} size={150} />
              <span className="font-mono text-[11px] tracking-wider text-muted uppercase">
                Level {p.level} · {p.earnedOn ?? "not earned yet"}
              </span>
            </li>
          ))}
        </ul>
      </Shelf>

      <Shelf title="Golden Gloves" note={`${gloves.length} of 9 positions · 80%+ on a position test`}>
        {gloves.length ? (
          <GloveCase positions={room.positions} plate={room.plate} size={200} />
        ) : (
          <div className="flex items-center gap-4">
            <GoldenGlove name={room.plate.name} position="Any position" earned={false} engrave={false} size={110} />
            <p className="text-sm text-muted">Pick a position in Softball IQ and score 80% or better to earn its Golden Glove.</p>
          </div>
        )}
      </Shelf>

      <Shelf title="MVP badges" note="One per test: review every question she missed (a perfect score earns it outright).">
        {room.mvps.length ? (
          <ul className="flex flex-wrap gap-5">
            {room.mvps.map((m) => (
              <li key={m.key} className="flex flex-col items-center gap-1.5">
                <MvpBadge label={m.label} size={92} />
                <span className="font-mono text-[10px] tracking-wider text-muted uppercase">{m.earnedOn}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-4">
            <MvpBadge label="Any test" earned={false} size={72} />
            <p className="text-sm text-muted">Finish a test, then go back through every question she missed.</p>
          </div>
        )}
      </Shelf>

      <Shelf
        title="Manager of the Year"
        note={`${managers.length} of ${room.managers.length} · one for each How to Keep the Book chapter: finish the lessons, then score 80%+ on the quiz.`}
      >
        <ul className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-6 sm:grid-cols-3">
          {room.managers.map((m) => (
            <li key={m.chapter} className="flex flex-col items-center gap-2">
              <ManagerAward
                name={room.plate.name}
                number={room.plate.number}
                year={m.year}
                chapter={m.label}
                earned={Boolean(m.earnedOn)}
                size={140}
              />
              <span className="text-center font-mono text-[10px] tracking-wider text-muted uppercase">
                {m.label}
                <br />
                {m.earnedOn ?? "not earned yet"}
              </span>
            </li>
          ))}
        </ul>
      </Shelf>

      {room.worldSeriesOn && (
        <Shelf title="GGG World Series Trophy" note={`Found ${room.worldSeriesOn} · a clean book in a How to Keep the Book game.`}>
          <div className="flex justify-center">
            <WorldSeriesTrophy size={170} />
          </div>
        </Shelf>
      )}

      {room.dynastyOn && (
        <Shelf title={DYNASTY_TROPHY} note={`Found ${room.dynastyOn} · clean books in all ten How to Keep the Book games.`}>
          <div className="flex justify-center">
            <DynastyTrophy size={170} />
          </div>
        </Shelf>
      )}

      <Shelf title="Training achievements" note="From Performance Training: consistency earns these.">
        {room.achievements.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {room.achievements.map((a) => (
              <li key={a.def.key} className="flex items-start gap-2.5 rounded-xl border border-neon/60 bg-neon/5 p-3">
                <HexBadge unlocked pct={100} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-highlight">{a.def.title}</p>
                  <p className="text-xs text-muted">{a.def.description}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">None yet. Check off routines in Performance Training to start earning them.</p>
        )}
      </Shelf>

      <Shelf
        title="GGG Champions Trophy"
        note={room.championsOn ? `Won ${room.championsOn}` : "Answer every Extra Credit Library question in one run with 80% or better."}
      >
        <div className="flex justify-center">
          <ChampionsTrophy earned={Boolean(room.championsOn)} size={160} />
        </div>
      </Shelf>
    </div>
  );
}
