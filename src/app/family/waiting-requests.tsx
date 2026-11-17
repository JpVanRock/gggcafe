import Link from "next/link";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { FamilyLink } from "./family-data";
import { FixNameForm } from "./join-form";

/**
 * Requests still waiting (user, 2026-11-16). With the parent code her name matched no one (or two
 * players) on the current roster, so the parent fixes it here; with the team code, the head coach
 * approves them, or they join again with the parent code.
 */
export async function WaitingRequests({ links }: { links: FamilyLink[] }) {
  const supabase = await createClient();
  const { data } = await supabase.from("parent_links").select("id, via_parent_code").in("id", links.map((l) => l.link_id));
  const withParentCode = new Set((data ?? []).filter((r) => r.via_parent_code).map((r) => r.id));
  return (
    <Card title="Waiting to join">
      <ul className="flex flex-col divide-y divide-navy-800">
        {links.map((l) => (
          <li key={l.link_id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <p className="text-sm">
              <span className="font-semibold">{l.team_name}</span> · parent of {l.child_name}
            </p>
            {withParentCode.has(l.link_id) ? (
              <>
                <p className="text-sm text-muted">
                  We couldn&apos;t find her on the team&apos;s current roster under that name. Fix it to match the roster and you&apos;re in. If
                  she isn&apos;t on the roster yet, your head coach adds her and approves you.
                </p>
                <FixNameForm linkId={l.link_id} defaultChild={l.child_name} />
              </>
            ) : (
              <p className="text-sm text-muted">
                You joined with the team code, so your head coach approves you. Have the parent code?{" "}
                <Link href="/family/join" className="font-semibold text-link hover:underline">
                  Join with it
                </Link>{" "}
                and you&apos;re in right away.
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
