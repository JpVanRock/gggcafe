// The Trophy Room: every accolade a player has earned, in one place.
//  - GGG World Series Trophy (Extra Credit Library run at 80%+)
//  - Stolen Base Leader plaques (one per Baserunning IQ level passed)
//  - championship rings (playbook levels), Golden Gloves (position tests)
//  - MVP badges (every miss on a test reviewed, or a perfect score)
//  - Performance Training achievements
import { RingCase } from "@/components/rings";
import { GoldenGlove } from "@/components/golden-glove";
import { MvpBadge } from "@/components/mvp-badge";
import { StolenBasePlaque } from "@/components/stolen-base-plaque";
import { WorldSeriesTrophy } from "@/components/world-series-trophy";
import { formatLongDate } from "@/lib/dates";
import type { AchievementProgress } from "@/lib/achievements";
import type { IqData } from "./data";
import type { Nameplate, PositionInfo } from "./iq-client";
import { GloveCase } from "./iq";
import { DetailHeading, MenuItem } from "./menu";
import { HexBadge } from "./performance";

export type TrophyRoom = {
  plate: Nameplate;
  worldSeriesOn: string | null;
  /** one Stolen Base Leader plaque per Baserunning IQ level */
  plaques: { level: number; earnedOn: string | null }[];
  rings: IqData["rings"];
  positions: PositionInfo[];
  mvps: { key: string; label: string; earnedOn: string }[];
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
    worldSeriesOn: iq.worldSeries ? formatLongDate(iq.worldSeries.earned_on) : null,
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
    achievements: achievements.filter((a) => a.unlockedOn),
  };
}

export function TrophyRoomSummary({ room }: { room: TrophyRoom }) {
  const gloves = room.positions.filter((p) => p.earnedOn);
  const plaques = room.plaques.filter((p) => p.earnedOn);
  const nothing = !room.worldSeriesOn && !plaques.length && !room.rings.length && !gloves.length && !room.mvps.length && !room.achievements.length;
  return (
    <div>
      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-3">
        <MenuItem name="World Series Trophy" value={room.worldSeriesOn ? "✓" : "–"} note={room.worldSeriesOn ? `Won ${room.worldSeriesOn}` : "Extra Credit Library"} />
        <MenuItem name="Stolen Base Leader" value={`${plaques.length}/3`} note="A plaque for each Baserunning IQ level" />
        <MenuItem name="Championship rings" value={`${room.rings.length}/6`} />
        <MenuItem name="Golden Gloves" value={`${gloves.length}/9`} note={gloves.length ? gloves.map((g) => g.position).join(", ") : undefined} />
        <MenuItem name="MVP badges" value={room.mvps.length} />
        <MenuItem name="Training achievements" value={room.achievements.length} />
      </div>
      {nothing ? (
        <p className="mt-5 text-sm text-muted">The shelves are empty for now. Every ring, glove, badge and trophy she earns lands here.</p>
      ) : (
        <div className="mt-6 flex flex-wrap items-end justify-center gap-5">
          {room.worldSeriesOn && <WorldSeriesTrophy size={70} />}
          {plaques.map((p) => (
            <StolenBasePlaque key={p.level} name={room.plate.name} number={room.plate.number} level={p.level} engrave={false} size={58} />
          ))}
          {room.rings.length > 0 && <RingCase earned={room.rings} size={36} showLabels={false} />}
          {gloves.map((g) => (
            <GoldenGlove key={g.position} name={room.plate.name} number={room.plate.number} position={g.label} engrave={false} size={70} />
          ))}
          {room.mvps.slice(0, 6).map((m) => (
            <MvpBadge key={m.key} label={m.label} size={52} />
          ))}
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
  return (
    <div className="flex flex-col gap-6">
      <Shelf
        title="GGG World Series Trophy"
        note={room.worldSeriesOn ? `Won ${room.worldSeriesOn}` : "Answer every Extra Credit Library question in one run with 80% or better."}
      >
        <div className="flex justify-center">
          <WorldSeriesTrophy earned={Boolean(room.worldSeriesOn)} size={220} />
        </div>
      </Shelf>

      <Shelf title="Stolen Base Leader plaques" note="One for each Baserunning IQ level passed with 80%+.">
        <ul className="flex flex-wrap justify-center gap-6">
          {room.plaques.map((p) => (
            <li key={p.level} className="flex flex-col items-center gap-2">
              <StolenBasePlaque name={room.plate.name} number={room.plate.number} level={p.level} earned={Boolean(p.earnedOn)} size={200} />
              <span className="font-mono text-[11px] tracking-wider text-muted uppercase">
                Level {p.level} · {p.earnedOn ?? "not earned yet"}
              </span>
            </li>
          ))}
        </ul>
      </Shelf>

      <Shelf title="Championship rings" note={`${room.rings.length} of 6 · one per playbook level passed with 80%+`}>
        <RingCase earned={room.rings} size={76} />
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

      <Shelf title="Training achievements" note="From Performance Training: consistency earns these.">
        {room.achievements.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {room.achievements.map((a) => (
              <li key={a.def.key} className="flex items-start gap-2.5 rounded-xl border border-neon/60 bg-neon/5 p-3">
                <HexBadge unlocked pct={100} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-neon">{a.def.title}</p>
                  <p className="text-xs text-muted">{a.def.description}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">None yet. Check off routines in Performance Training to start earning them.</p>
        )}
      </Shelf>
    </div>
  );
}
