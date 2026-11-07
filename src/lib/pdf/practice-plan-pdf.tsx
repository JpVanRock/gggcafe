import "server-only";
import path from "node:path";
import {
  Circle, Document, Font, Image, Page, Path, Rect, StyleSheet, Svg, Text, View, renderToBuffer,
} from "@react-pdf/renderer";
import {
  DRILL_TAG_LABEL, FIELD_H, FIELD_SHAPES, FIELD_SPOT, FIELD_W, PLAN_POSITIONS, PRACTICE_SETTING_LABEL,
  durationLabel, equipmentChecklist, planTimeline, practiceRange,
} from "@/lib/dugout";
import { formatLongDate } from "@/lib/dates";
import type { PracticePlan, RosterPlayer } from "@/lib/practice-plans";

// Brand kit colors, on white paper so it prints cleanly.
const NAVY = "#000A2D";
const NEON = "#E7FB06";
const PINK = "#FE1F7C";
const MUTED = "#4A5578";
const LINE = "#D3D9E8";
const SOFT = "#F4F6FB";

// Fonts and logo ship with the app (next.config.ts traces this folder into the
// server bundle). DM Sans for text, Jost for titles and numbers, like the site.
const DIR = path.join(process.cwd(), "src/lib/pdf");
let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  Font.register({
    family: "DM Sans",
    fonts: [
      { src: path.join(DIR, "fonts/dm-sans-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(DIR, "fonts/dm-sans-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Jost",
    fonts: [
      { src: path.join(DIR, "fonts/jost-latin-500-normal.woff"), fontWeight: 500 },
      { src: path.join(DIR, "fonts/jost-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const s = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 44, paddingHorizontal: 36, fontFamily: "DM Sans", fontSize: 9.5, color: NAVY },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: NAVY, borderRadius: 8, padding: 14 },
  logo: { width: 52, height: 52, borderRadius: 8 },
  headerText: { flexGrow: 1, marginLeft: 14 },
  kicker: { fontFamily: "Jost", fontWeight: 700, fontSize: 20, color: NEON, letterSpacing: 2 },
  team: { fontFamily: "Jost", fontWeight: 500, fontSize: 12, color: "#FFFFFF", marginTop: 2, letterSpacing: 0.5 },
  headerRight: { alignItems: "flex-end" },
  bigTime: { fontFamily: "Jost", fontWeight: 700, fontSize: 18, color: "#FFFFFF" },
  chip: {
    marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, backgroundColor: PINK,
    fontFamily: "Jost", fontWeight: 700, fontSize: 7.5, color: NAVY, letterSpacing: 1,
  },
  info: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, borderBottomWidth: 0.75, borderBottomColor: LINE, paddingBottom: 8 },
  infoCell: { marginRight: 22, marginBottom: 2 },
  label: { fontFamily: "Jost", fontWeight: 500, fontSize: 7, color: MUTED, letterSpacing: 1.2, textTransform: "uppercase" },
  value: { fontSize: 10, fontWeight: 700, marginTop: 1 },
  sectionTitle: {
    fontFamily: "Jost", fontWeight: 700, fontSize: 9, letterSpacing: 1.6, color: NAVY, textTransform: "uppercase",
    marginTop: 14, marginBottom: 6, paddingLeft: 6, borderLeftWidth: 2.5, borderLeftColor: PINK,
  },
  thead: { flexDirection: "row", backgroundColor: SOFT, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 3 },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: LINE },
  cTime: { width: 76, paddingRight: 6, fontFamily: "Jost", fontWeight: 500, fontSize: 8.5 },
  cDrill: { flex: 1, paddingRight: 8 },
  cMin: { width: 34, fontFamily: "Jost", fontWeight: 700, textAlign: "right", paddingRight: 8 },
  cCoach: { width: 84, paddingRight: 6, fontSize: 8.5 },
  cEquip: { width: 104, fontSize: 8.5, color: MUTED },
  drillName: { fontWeight: 700, fontSize: 10.5 },
  tags: { fontFamily: "Jost", fontWeight: 500, fontSize: 6.5, color: PINK, letterSpacing: 1, marginTop: 1.5, textTransform: "uppercase" },
  desc: { fontSize: 8.5, color: MUTED, marginTop: 2, lineHeight: 1.35 },
  totals: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6 },
  totalsText: { fontFamily: "Jost", fontWeight: 500, fontSize: 9 },
  bottom: { flexDirection: "row", marginTop: 4 },
  check: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  box: { width: 8, height: 8, borderWidth: 0.9, borderColor: NAVY, borderRadius: 1.5, marginRight: 6 },
  noteLine: { borderBottomWidth: 0.5, borderBottomColor: LINE, height: 18 },
  footer: {
    position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between",
    fontSize: 7.5, color: MUTED,
  },
});

const FIELD_PX = 250;
const fieldHeight = (FIELD_PX * FIELD_H) / FIELD_W;

function Field({ names }: { names: Partial<Record<string, string[]>> }) {
  const f = FIELD_SHAPES;
  return (
    <View style={{ width: FIELD_PX, height: fieldHeight, position: "relative" }}>
      <Svg viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} style={{ width: FIELD_PX, height: fieldHeight, position: "absolute", top: 0, left: 0 }}>
        <Path d={f.grass} fill={SOFT} stroke={LINE} strokeWidth={1.5} />
        <Path d={f.foulLines} stroke="#A9B3CE" strokeWidth={1.5} />
        <Path d={f.infieldArc} fill="none" stroke={LINE} strokeWidth={1.5} strokeDasharray="4 5" />
        <Path d={f.diamond} fill="#E9EDF6" stroke="#A9B3CE" strokeWidth={1.5} />
        <Circle cx={f.circle.cx} cy={f.circle.cy} r={f.circle.r} fill="none" stroke="#A9B3CE" strokeWidth={1.5} />
        {f.bases.map(([x, y]) => (
          <Rect key={`${x}-${y}`} x={x - 6} y={y - 6} width={12} height={12} fill={NAVY} transform={`rotate(45 ${x} ${y})`} />
        ))}
        <Path d={f.plate} fill={NAVY} />
      </Svg>
      {PLAN_POSITIONS.map((pos) => {
        const [x, y] = FIELD_SPOT[pos];
        const list = names[pos] ?? [];
        const left = (x / FIELD_W) * FIELD_PX;
        const top = (y / FIELD_H) * fieldHeight;
        return (
          <View key={pos} style={{ position: "absolute", left: left - 34, top: top - 8, width: 68, alignItems: "center" }}>
            <Text
              style={{
                fontFamily: "Jost", fontWeight: 700, fontSize: 7, color: list.length ? "#FFFFFF" : NAVY,
                backgroundColor: list.length ? PINK : "#FFFFFF", borderWidth: 0.75, borderColor: list.length ? PINK : "#A9B3CE",
                borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1.5,
              }}
            >
              {pos}
            </Text>
            {list.map((n, i) => (
              <Text
                key={i}
                style={{ fontSize: 6.8, fontWeight: 700, marginTop: 1, textAlign: "center", backgroundColor: "#FFFFFF", borderRadius: 2, paddingHorizontal: 2 }}
              >
                {n}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function PlanDocument({ plan, roster }: { plan: PracticePlan; roster: RosterPlayer[] }) {
  const { slots, used } = planTimeline(plan.start_time, plan.blocks);
  const range = practiceRange(plan.start_time, plan.total_minutes);
  const gear = equipmentChecklist(plan.blocks);
  const byId = new Map(roster.map((p) => [p.id, p.short]));
  const names: Partial<Record<string, string[]>> = {};
  for (const spot of plan.spots) (names[spot.position] ??= []).push(byId.get(spot.player_id) ?? "Player");
  const open = plan.total_minutes - used;
  const info: [string, string | null][] = [
    ["Date", formatLongDate(plan.practice_date)],
    ["Time", range],
    ["Setting", PRACTICE_SETTING_LABEL[plan.setting]],
    ["Total time", durationLabel(plan.total_minutes)],
    ["Location", plan.location],
    ["Focus", plan.focus],
  ];

  return (
    <Document title={`Practice plan · ${plan.team.name} · ${plan.practice_date}`} author="GGG.Cafe" creator="GGG.Cafe">
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image src={path.join(DIR, "ggg-logo.png")} style={s.logo} />
          <View style={s.headerText}>
            <Text style={s.kicker}>PRACTICE PLAN</Text>
            <Text style={s.team}>{plan.team.name.toUpperCase()}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.bigTime}>{plan.total_minutes} MIN</Text>
            <Text style={s.chip}>{PRACTICE_SETTING_LABEL[plan.setting].toUpperCase()}</Text>
          </View>
        </View>

        <View style={s.info}>
          {info
            .filter(([, v]) => v)
            .map(([label, v]) => (
              <View key={label} style={s.infoCell}>
                <Text style={s.label}>{label}</Text>
                <Text style={s.value}>{v}</Text>
              </View>
            ))}
        </View>

        <Text style={s.sectionTitle}>Practice timeline</Text>
        <View style={s.thead}>
          <Text style={[s.cTime, s.label]}>Time</Text>
          <Text style={[s.cDrill, s.label]}>Drill</Text>
          <Text style={[s.cMin, s.label]}>Min</Text>
          <Text style={[s.cCoach, s.label]}>Coach</Text>
          <Text style={[s.cEquip, s.label]}>Equipment</Text>
        </View>
        {plan.blocks.map((b, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.cTime}>{slots[i].label ?? "–"}</Text>
            <View style={s.cDrill}>
              <Text style={s.drillName}>{b.name}</Text>
              {b.tags.length > 0 && <Text style={s.tags}>{b.tags.map((t) => DRILL_TAG_LABEL[t]).join(" · ")}</Text>}
              {b.description && <Text style={s.desc}>{b.description}</Text>}
            </View>
            <Text style={s.cMin}>{b.minutes ?? "–"}</Text>
            <Text style={s.cCoach}>{b.coaches.join(", ") || "–"}</Text>
            <Text style={s.cEquip}>{b.equipment ?? ""}</Text>
          </View>
        ))}
        <View style={s.totals}>
          <Text style={s.totalsText}>
            Planned {used} of {plan.total_minutes} min
            {open > 0 ? ` · ${open} min open` : open < 0 ? ` · over by ${-open} min` : ""}
          </Text>
        </View>

        <View style={s.bottom} wrap={false}>
          {plan.spots.length > 0 && (
            <View style={{ marginRight: 24 }}>
              <Text style={s.sectionTitle}>Positions</Text>
              <Field names={names} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            {gear.length > 0 && (
              <>
                <Text style={s.sectionTitle}>Equipment checklist</Text>
                {gear.map((item) => (
                  <View key={item} style={s.check}>
                    <View style={s.box} />
                    <Text>{item}</Text>
                  </View>
                ))}
              </>
            )}
            <Text style={s.sectionTitle}>Notes</Text>
            {Array.from({ length: plan.spots.length ? 6 : 4 }, (_, i) => (
              <View key={i} style={s.noteLine} />
            ))}
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>GGG.Cafe · Coaches Dugout</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderPracticePlanPdf(plan: PracticePlan, roster: RosterPlayer[]) {
  registerFonts();
  return renderToBuffer(<PlanDocument plan={plan} roster={roster} />);
}

/** "practice-plan-2026-09-15-sample-squad-14u.pdf" */
export function practicePlanFilename(plan: PracticePlan) {
  const slug = plan.team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `practice-plan-${plan.practice_date}${slug ? `-${slug}` : ""}.pdf`;
}
