import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { JoinForm } from "../join-form";
import { loadFamily } from "../family-data";
import { FamilyShell, SectionTitle } from "../shell";

export const metadata: Metadata = { title: "Join another team · GGG.Cafe" };

// Join another team (user, 2026-11-16: it was at the bottom of Logins & teams; now it's in the family
// page's menu): another daughter, or a second team, with that team's parent code.
export default function FamilyJoinPage() {
  return (
    <FamilyShell>
      <FamilyJoin />
    </FamilyShell>
  );
}

async function FamilyJoin() {
  const { supabase, user, meta } = await loadFamily();
  const { data: account } = await supabase.from("parent_accounts").select("display_name").eq("user_id", user.id).maybeSingle();
  return (
    <div className="flex flex-col gap-10">
      <SectionTitle
        title="Join another team"
        line="Another daughter, or a second team: enter the parent code from that team's coach and her name as it is on the roster. You're in right away."
      />
      <Card title="Join a team">
        <JoinForm askName={!account} defaultName={(meta.display_name ?? "").trim()} />
      </Card>
    </div>
  );
}
