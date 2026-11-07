import "server-only";
import path from "node:path";
import type { ReactNode } from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BASE_RUNNING_LABEL, HITTING_TYPE_LABEL, percent, pitcherOf, rate } from "@/lib/gameday";
import { formatLongDate } from "@/lib/dates";
import type { GamedayPlayer, Lineup } from "@/lib/gameday-data";
import { DIR, LINE, MUTED, NAVY, NEON, PINK, SOFT, registerFonts } from "./practice-plan-pdf";

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 36, paddingHorizontal: 30, fontFamily: "DM Sans", fontSize: 9, color: NAVY },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: NAVY, borderRadius: 8, padding: 12 },
  logo: { width: 44, height: 44, borderRadius: 7 },
  kicker: { fontFamily: "Jost", fontWeight: 700, fontSize: 18, color: NEON, letterSpacing: 2 },
  sub: { fontFamily: "Jost", fontWeight: 500, fontSize: 11, color: "#FFFFFF", marginTop: 2, letterSpacing: 0.5 },
  title: {
    fontFamily: "Jost", fontWeight: 700, fontSize: 9, letterSpacing: 1.6, textTransform: "uppercase",
    marginTop: 12, marginBottom: 5, paddingLeft: 6, borderLeftWidth: 2.5, borderLeftColor: PINK,
  },
  label: { fontFamily: "Jost", fontWeight: 500, fontSize: 7, color: MUTED, letterSpacing: 1.1, textTransform: "uppercase" },
  thead: { flexDirection: "row", backgroundColor: SOFT, paddingVertical: 3.5, paddingHorizontal: 4, borderRadius: 3 },
  row: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: LINE, alignItems: "center" },
  num: { fontFamily: "Jost", fontWeight: 700 },
  footer: { position: "absolute", bottom: 16, left: 30, right: 30, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED },
});

function Cell({ w, children, bold, center, color }: { w: number | string; children: ReactNode; bold?: boolean; center?: boolean; color?: string }) {
  return (
    <Text style={{ width: w as number, fontWeight: bold ? 700 : 400, textAlign: center ? "center" : "left", color: color ?? NAVY, paddingRight: 4 }}>
      {children}
    </Text>
  );
}

function LineupDocument({ lineup, roster }: { lineup: Lineup; roster: GamedayPlayer[] }) {
  const byId = new Map(roster.map((p) => [p.id, p]));
  const rotations = Array.from({ length: lineup.rotations }, (_, i) => String(i + 1));
  // Players with any defensive spot, batting order first, then the rest
  const inDefense = new Set(rotations.flatMap((r) => Object.keys(lineup.defense[r] ?? {})));
  const defenseRows = [...lineup.batting_order, ...roster.map((p) => p.id).filter((id) => !lineup.batting_order.includes(id))].filter(
    (id) => inDefense.has(id) || lineup.batting_order.includes(id),
  );
  const vs = lineup.opponent ? `vs ${lineup.opponent}` : "";
  const colW = Math.min(46, Math.floor(330 / Math.max(1, rotations.length)));

  return (
    <Document title={`Lineup · ${lineup.team.name} · ${lineup.game_date}`} author="GGG.Cafe" creator="GGG.Cafe">
      <Page size="LETTER" orientation="landscape" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image src={path.join(DIR, "ggg-logo.png")} style={s.logo} />
          <View style={{ flexGrow: 1, marginLeft: 12 }}>
            <Text style={s.kicker}>LINEUP CARD</Text>
            <Text style={s.sub}>{[lineup.team.name.toUpperCase(), vs.toUpperCase()].filter(Boolean).join("  ")}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Jost", fontWeight: 700, fontSize: 12, color: "#FFFFFF" }}>{formatLongDate(lineup.game_date)}</Text>
            {lineup.title && <Text style={{ fontSize: 8.5, color: NEON, marginTop: 2 }}>{lineup.title}</Text>}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 18 }}>
          {/* Batting order */}
          <View style={{ width: 330 }}>
            <Text style={s.title}>Batting order</Text>
            <View style={s.thead}>
              <Cell w={18}><Text style={s.label}>#</Text></Cell>
              <Cell w={118}><Text style={s.label}>Player</Text></Cell>
              <Cell w={70}><Text style={s.label}>Hitter</Text></Cell>
              <Cell w={52}><Text style={s.label}>Speed</Text></Cell>
              <Cell w={24} center><Text style={s.label}>AVG</Text></Cell>
              <Cell w={24} center><Text style={s.label}>OBP</Text></Cell>
              <Cell w={24} center><Text style={s.label}>K%</Text></Cell>
            </View>
            {lineup.batting_order.map((id, i) => {
              const p = byId.get(id);
              return (
                <View key={id} style={s.row} wrap={false}>
                  <Cell w={18} bold><Text style={s.num}>{i + 1}</Text></Cell>
                  <Cell w={118} bold>{p?.short ?? "Player"}</Cell>
                  <Cell w={70}>{p?.hitting_type ? HITTING_TYPE_LABEL[p.hitting_type].replace(" hitter", "") : "–"}</Cell>
                  <Cell w={52}>{p?.base_running ? BASE_RUNNING_LABEL[p.base_running].replace(" speed", "") : "–"}</Cell>
                  <Cell w={24} center>{rate(p?.avg)}</Cell>
                  <Cell w={24} center>{rate(p?.obp)}</Cell>
                  <Cell w={24} center>{percent(p?.k_pct)}</Cell>
                </View>
              );
            })}
            {lineup.notes && (
              <>
                <Text style={s.title}>Notes</Text>
                <Text style={{ lineHeight: 1.4 }}>{lineup.notes}</Text>
              </>
            )}
          </View>

          {/* Defensive rotations + pitching */}
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Defensive rotations</Text>
            <View style={s.thead}>
              <Cell w={96}><Text style={s.label}>Player</Text></Cell>
              {rotations.map((r) => (
                <Cell key={r} w={colW} center><Text style={s.label}>R{r}</Text></Cell>
              ))}
            </View>
            {defenseRows.map((id) => (
              <View key={id} style={s.row} wrap={false}>
                <Cell w={96} bold>{byId.get(id)?.short ?? "Player"}</Cell>
                {rotations.map((r) => {
                  const spot = lineup.defense[r]?.[id];
                  return (
                    <Cell key={r} w={colW} center bold={spot === "P"} color={spot === "P" ? PINK : spot === "Sub" ? MUTED : NAVY}>
                      {spot ?? "–"}
                    </Cell>
                  );
                })}
              </View>
            ))}

            <Text style={s.title}>Pitching plan</Text>
            <View style={s.thead}>
              <Cell w={28}><Text style={s.label}>Rot.</Text></Cell>
              <Cell w={96}><Text style={s.label}>Pitcher</Text></Cell>
              <Cell w={70}><Text style={s.label}>Primary</Text></Cell>
              <Cell w={70}><Text style={s.label}>Secondary</Text></Cell>
              <Cell w={140}><Text style={s.label}>Chase pitches</Text></Cell>
            </View>
            {rotations.map((r) => {
              const pitcher = pitcherOf(lineup.defense[r]);
              const plan = lineup.pitching[r];
              return (
                <View key={r} style={s.row} wrap={false}>
                  <Cell w={28} bold>R{r}</Cell>
                  <Cell w={96} bold>{pitcher ? (byId.get(pitcher)?.short ?? "Player") : "–"}</Cell>
                  <Cell w={70}>{plan?.primary ?? "–"}</Cell>
                  <Cell w={70}>{plan?.secondary ?? "–"}</Cell>
                  <Cell w={140}>{plan?.chase.length ? plan.chase.join(", ") : "–"}</Cell>
                </View>
              );
            })}
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>GGG.Cafe · Coaches Dugout · GameDay Prep</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderLineupPdf(lineup: Lineup, roster: GamedayPlayer[]) {
  registerFonts();
  return renderToBuffer(<LineupDocument lineup={lineup} roster={roster} />);
}

/** "lineup-2026-09-20-nw-explosion.pdf" */
export function lineupFilename(lineup: Lineup) {
  const slug = `${lineup.team.name}${lineup.opponent ? `-vs-${lineup.opponent}` : ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `lineup-${lineup.game_date}${slug ? `-${slug}` : ""}.pdf`;
}
