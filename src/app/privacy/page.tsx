import type { Metadata } from "next";
import { LegalDocument, LegalPageShell } from "@/components/legal";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy & Security · GGG.Cafe" };

/** Public: people read the notice before they sign up. */
export default function PrivacyPage() {
  return (
    <LegalPageShell>
      <LegalDocument
        title="Privacy & Security Notice"
        intro={PRIVACY_INTRO}
        sections={PRIVACY_SECTIONS}
        other={{ href: "/terms", label: "Terms of Service" }}
      />
    </LegalPageShell>
  );
}
