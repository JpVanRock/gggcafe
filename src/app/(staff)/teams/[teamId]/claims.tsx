import Link from "next/link";
import { Card } from "@/components/ui";
import type { ClaimRow, SpotOption } from "@/lib/approvals";
import { ApprovedClaimList, PendingClaimList } from "../../dugout/approvals";

/** Players' account claims for this team (the full review lives in Dugout → Roster). */
export function ClaimsCard({ teamId, claims, spots }: { teamId: string; claims: ClaimRow[]; spots: SpotOption[] }) {
  const pending = claims.filter((c) => c.status === "pending");
  const approved = claims.filter((c) => c.status === "approved");
  if (claims.length === 0) return null;
  return (
    <div id="claims">
      <Card
        title={`Player claims${pending.length ? ` · ${pending.length} waiting` : ""}`}
        actions={
          <Link href={`/dugout/roster?team=${teamId}`} className="text-xs font-semibold text-pink hover:underline">
            Dugout roster →
          </Link>
        }
      >
        {pending.length > 0 && (
          <div className="mb-5">
            <PendingClaimList claims={pending} spots={spots} />
          </div>
        )}
        {approved.length > 0 && <ApprovedClaimList claims={approved} spots={spots} />}
      </Card>
    </div>
  );
}
