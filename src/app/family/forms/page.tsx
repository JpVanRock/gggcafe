import type { Metadata } from "next";
import { Disclosure, EmptyState } from "@/components/ui";
import { MedicalForm, QuestionnaireForm } from "@/components/family-forms";
import { medicalOnFile, type Questionnaire } from "@/lib/family";
import { saveMedicalAsParent, saveQuestionnaireAsParent } from "../actions";
import { firstOf, loadFamily } from "../family-data";
import { FamilyShell, SectionHeading, SectionTitle } from "../shell";

export const metadata: Metadata = { title: "Season forms · GGG.Cafe" };

// The family menu's Season forms (user, 2026-11-13; they were on the family page): each daughter's
// preseason questionnaire (the parent switch can close it) and her medical & emergency card.
export default function FamilyFormsPage() {
  return (
    <FamilyShell>
      <FamilyForms />
    </FamilyShell>
  );
}

async function FamilyForms() {
  const { supabase, daughters, offForDaughter } = await loadFamily();
  const forms = await Promise.all(
    daughters.map(async (d) => ({
      daughter: d,
      questionnaire: ((await supabase.rpc("parent_questionnaire", { p_player_id: d.player_id })).data ?? null) as Partial<Questionnaire> | null,
      medical: ((await supabase.rpc("parent_medical_card", { p_player_id: d.player_id })).data ?? null) as Record<string, string | null> | null,
    })),
  );
  return (
    <div className="flex flex-col gap-10">
      <SectionTitle
        title="Season forms"
        line="Sizes, numbers and positions for the coaches, and the medical & emergency card they carry to every game. Only her head coaches and you see the medical card."
      />
      {forms.length === 0 && <EmptyState>Her forms show here once your coach approves you.</EmptyState>}
      {forms.map(({ daughter: d, questionnaire, medical }) => (
        <section key={d.player_id} aria-label={`${d.player_name}'s season forms`} className="flex flex-col gap-3">
          <SectionHeading id={`forms-${d.player_id}`}>{forms.length > 1 ? d.player_name : `${firstOf(d.player_name)}'s forms`}</SectionHeading>
          {!offForDaughter(d, "parent.questionnaire") && (
            <Disclosure summary={`Preseason questionnaire: sizes, numbers, positions${questionnaire ? " ✓" : " · to do"}`} open={!questionnaire}>
              <QuestionnaireForm action={saveQuestionnaireAsParent} hidden={{ player_id: d.player_id }} values={questionnaire} />
            </Disclosure>
          )}
          <Disclosure summary={`Medical & emergency card${medicalOnFile(medical) ? " ✓ on file" : " · not on file yet"}`} open={!medicalOnFile(medical)}>
            <MedicalForm action={saveMedicalAsParent} hidden={{ player_id: d.player_id }} values={medical} />
          </Disclosure>
        </section>
      ))}
    </div>
  );
}
