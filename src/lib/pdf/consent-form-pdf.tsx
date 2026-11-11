import "server-only";
// The parental consent form a parent prints, signs by hand and uploads (COPPA; docs/features/legal.md).
// One letter page: who's asking and why, the notice, the consent statement, then lines to fill in and sign.
// The words live in src/lib/legal.ts so the family page and this form always match.
import path from "node:path";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatLongDate } from "@/lib/dates";
import { CONSENT_FORM_TITLE, CONSENT_NOTICE, CONSENT_STATEMENT, LEGAL, TERMS_VERSION } from "@/lib/legal";
import { DIR, LINE, MUTED, NAVY, NEON, PINK, SOFT, registerFonts } from "./practice-plan-pdf";

export type ConsentFormData = {
  playerName: string;
  teamName: string;
  birthDate: string | null;
  parentName: string;
};

const s = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 36, paddingHorizontal: 36, fontFamily: "DM Sans", fontSize: 9, color: NAVY, lineHeight: 1.3 },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: NAVY, borderRadius: 8, padding: 12 },
  logo: { width: 44, height: 44, borderRadius: 7 },
  kicker: { fontFamily: "Jost", fontWeight: 700, fontSize: 15, color: NEON, letterSpacing: 1.2, lineHeight: 1.15 },
  sub: { fontFamily: "Jost", fontWeight: 500, fontSize: 9.5, color: "#FFFFFF", marginTop: 4, letterSpacing: 0.4, lineHeight: 1.15 },
  facts: { flexDirection: "row", marginTop: 10, backgroundColor: SOFT, borderRadius: 6, padding: 9 },
  fact: { flex: 1, paddingRight: 8 },
  label: { fontFamily: "Jost", fontWeight: 500, fontSize: 7, color: MUTED, letterSpacing: 1.1, textTransform: "uppercase" },
  value: { fontFamily: "Jost", fontWeight: 700, fontSize: 10.5, marginTop: 2 },
  heading: {
    fontFamily: "Jost", fontWeight: 700, fontSize: 8.5, letterSpacing: 1.4, textTransform: "uppercase",
    marginTop: 7, marginBottom: 2, paddingLeft: 6, borderLeftWidth: 2.5, borderLeftColor: PINK,
  },
  statement: { marginTop: 10, borderWidth: 1.2, borderColor: PINK, borderRadius: 6, padding: 10, fontWeight: 700 },
  fields: { marginTop: 4 },
  row: { flexDirection: "row", marginTop: 12 },
  line: { flex: 1, borderBottomWidth: 0.8, borderBottomColor: NAVY, height: 18, marginRight: 14 },
  lineLast: { flex: 1, borderBottomWidth: 0.8, borderBottomColor: NAVY, height: 18 },
  under: { flexDirection: "row", marginTop: 2 },
  underCell: { flex: 1, marginRight: 14, fontSize: 7.5, color: MUTED },
  underLast: { flex: 1, fontSize: 7.5, color: MUTED },
  boxes: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  box: { width: 10, height: 10, borderWidth: 0.8, borderColor: NAVY, marginRight: 5 },
  boxLabel: { marginRight: 18 },
  steps: { marginTop: 12, backgroundColor: SOFT, borderRadius: 6, padding: 9, borderWidth: 0.5, borderColor: LINE },
  footer: { position: "absolute", bottom: 16, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED },
});

function ConsentDocument({ data }: { data: ConsentFormData }) {
  return (
    <Document title={`${CONSENT_FORM_TITLE}: ${data.playerName}`} author={LEGAL.owner}>
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image src={path.join(DIR, "ggg-logo.png")} style={s.logo} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={s.kicker}>{CONSENT_FORM_TITLE.toUpperCase()}</Text>
            <Text style={s.sub}>
              {LEGAL.name} · {LEGAL.owner} · Children&apos;s privacy (COPPA)
            </Text>
          </View>
        </View>

        <View style={s.facts}>
          <View style={s.fact}>
            <Text style={s.label}>Player</Text>
            <Text style={s.value}>{data.playerName}</Text>
          </View>
          <View style={s.fact}>
            <Text style={s.label}>Date of birth</Text>
            <Text style={s.value}>{data.birthDate ? formatLongDate(data.birthDate) : "________________"}</Text>
          </View>
          <View style={s.fact}>
            <Text style={s.label}>Team</Text>
            <Text style={s.value}>{data.teamName}</Text>
          </View>
        </View>

        {CONSENT_NOTICE.map((n) => (
          <View key={n.heading} wrap={false}>
            <Text style={s.heading}>{n.heading}</Text>
            <Text>{n.text}</Text>
          </View>
        ))}

        <Text style={s.statement}>{CONSENT_STATEMENT}</Text>

        <View style={s.fields} wrap={false}>
          <View style={s.boxes}>
            <View style={s.box} />
            <Text style={s.boxLabel}>I am her parent</Text>
            <View style={s.box} />
            <Text style={s.boxLabel}>I am her legal guardian</Text>
          </View>
          <View style={s.row}>
            <View style={s.line}>
              <Text style={{ fontFamily: "Jost", fontSize: 10.5, paddingTop: 3 }}>{data.parentName}</Text>
            </View>
            <View style={s.lineLast} />
          </View>
          <View style={s.under}>
            <Text style={s.underCell}>Parent or guardian name (print; must match your GGG.Cafe parent account)</Text>
            <Text style={s.underLast}>Email on your GGG.Cafe parent account</Text>
          </View>
          <View style={s.row}>
            <View style={{ ...s.line, flex: 2 }} />
            <View style={s.lineLast} />
          </View>
          <View style={s.under}>
            <Text style={{ ...s.underCell, flex: 2 }}>Signature (sign by hand)</Text>
            <Text style={s.underLast}>Date</Text>
          </View>
        </View>

        <View style={s.steps} wrap={false}>
          <Text style={s.label}>Return it</Text>
          <Text style={{ marginTop: 3 }}>
            Take a clear photo or scan of the whole signed page and upload it on your family page in {LEGAL.name}, under her login. Our
            staff check it, usually within two business days, and then you can make her login. Questions: {LEGAL.contact}.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text>
            {LEGAL.owner} · {LEGAL.contact}
          </Text>
          <Text>Form version {TERMS_VERSION}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderConsentFormPdf(data: ConsentFormData) {
  registerFonts();
  return renderToBuffer(<ConsentDocument data={data} />);
}

export function consentFormFilename(playerName: string) {
  return `ggg-cafe-parental-consent-${playerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
}
