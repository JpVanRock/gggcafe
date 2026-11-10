import type { Metadata } from "next";
import { LegalDocument, LegalPageShell } from "@/components/legal";
import { TERMS_INTRO, TERMS_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service · GGG.Cafe" };

/** Public: people read the Terms before they sign up. */
export default function TermsPage() {
  return (
    <LegalPageShell>
      <LegalDocument
        title="Terms of Service"
        intro={TERMS_INTRO}
        sections={TERMS_SECTIONS}
        other={{ href: "/privacy", label: "Privacy & Security Notice" }}
      />
    </LegalPageShell>
  );
}
