import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/softball";
import { consentFormFilename, renderConsentFormPdf } from "@/lib/pdf/consent-form-pdf";

/** The parental consent form for one daughter, filled in with her name, birth date and team. Her approved parents only. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/family/consent/[playerId]/pdf">) {
  const { playerId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to get the consent form.", { status: 401 });
  if (!isUuid(playerId)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  // both functions return only the signed-in parent's own approved daughters
  const [{ data: statuses }, { data: daughters }, { data: account }] = await Promise.all([
    supabase.rpc("parent_consent_status"),
    supabase.rpc("parent_player_logins"),
    supabase.from("parent_accounts").select("display_name").eq("user_id", user.id).maybeSingle(),
  ]);
  const status = (statuses ?? []).find((s) => s.player_id === playerId);
  const daughter = ((daughters ?? []) as { player_id: string; player_name: string; team_name: string }[]).find((d) => d.player_id === playerId);
  if (!status || !daughter) return new Response("Not found", { status: 404 });

  const pdf = await renderConsentFormPdf({
    playerName: daughter.player_name,
    teamName: daughter.team_name,
    birthDate: status.birth_date,
    parentName: account?.display_name ?? "",
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${consentFormFilename(daughter.player_name)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
