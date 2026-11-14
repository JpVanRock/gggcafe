import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { EmptyState, eyebrowClass } from "@/components/ui";
import { PACKET_KIND_LABEL, type PacketKind } from "@/lib/family";
import { markPacketRead } from "../actions";
import { loadFamily } from "../family-data";
import { FamilyShell, SectionTitle } from "../shell";

export const metadata: Metadata = { title: "Welcome packet · GGG.Cafe" };

// The family menu's Welcome packet (user, 2026-11-13; it was on the family page): the coach's
// letter, team policies and tips, marked read one by one. The parent switch closes it per team.
export default function FamilyPacketPage() {
  return (
    <FamilyShell>
      <FamilyPacket />
    </FamilyShell>
  );
}

async function FamilyPacket() {
  const { supabase, user, offOn } = await loadFamily();
  const [{ data: itemRows }, { data: readRows }] = await Promise.all([
    supabase.from("parent_packet_items").select("id, team_id, kind, title, body, position").order("position"),
    supabase.from("parent_packet_reads").select("item_id").eq("parent_id", user.id),
  ]);
  const readIds = new Set((readRows ?? []).map((r) => r.item_id));
  const items = ((itemRows ?? []) as { id: string; team_id: string; kind: PacketKind; title: string; body: string }[]).filter(
    (i) => !offOn(i.team_id, "parent.packet"),
  );
  const read = items.filter((i) => readIds.has(i.id)).length;
  return (
    <div className="flex flex-col gap-8">
      <SectionTitle
        title="Welcome packet"
        line={items.length ? `${read} of ${items.length} read. Your coach's letter, the team's policies and tips for the season.` : undefined}
      />
      {items.length === 0 ? (
        <EmptyState>Your coach hasn&apos;t posted the welcome packet yet.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((it) => (
            <li key={it.id} className={`rounded-2xl border p-5 ${readIds.has(it.id) ? "border-navy-700" : "border-pink/60 bg-pink/5"}`}>
              <p className={eyebrowClass}>{PACKET_KIND_LABEL[it.kind]}</p>
              <p className="mt-1 font-display text-xl font-bold tracking-wide uppercase">{it.title}</p>
              <p className="mt-2 text-sm whitespace-pre-wrap text-ink/90">{it.body}</p>
              {readIds.has(it.id) ? (
                <p className="mt-3 text-xs text-muted">Read ✓</p>
              ) : (
                <ActionForm action={markPacketRead} className="mt-3">
                  <input type="hidden" name="item_id" value={it.id} />
                  <button type="submit" className="text-sm font-semibold text-link hover:underline">
                    Mark as read
                  </button>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
