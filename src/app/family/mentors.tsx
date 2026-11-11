// Her mentors on the family page: requests to approve or decline, the mentors who work with
// her (one-player ones the parent can remove; whole-team ones the head coach approved), and a
// link to everything they send and write about her (/family/mentors).
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, buttonStyles } from "@/components/ui";
import type { createClient } from "@/lib/supabase/server";
import { decideMentorForDaughter, removeMentorFromDaughter } from "./actions";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type FamilyDaughter = { player_id: string; player_name: string };
type MentorLink = { id: string; mentor_id: string; team_id: string | null; player_id: string | null; status: string };
type Mentor = { user_id: string; display_name: string; specialty: string | null };

/** The mentor links and names a parent can see (her daughters' and her teams' whole-team mentors). */
export async function loadFamilyMentors(supabase: Supabase) {
  const [{ data: links }, { data: mentors }] = await Promise.all([
    supabase.from("mentor_links").select("id, mentor_id, team_id, player_id, status").neq("status", "declined").order("requested_at"),
    supabase.from("mentors").select("user_id, display_name, specialty"),
  ]);
  return { links: (links ?? []) as MentorLink[], mentors: (mentors ?? []) as Mentor[] };
}

export function DaughterMentors({
  daughter,
  teams,
  links,
  mentors,
}: {
  daughter: FamilyDaughter;
  /** her approved teams (whole-team mentors on them work with her too) */
  teams: { id: string; name: string }[];
  links: MentorLink[];
  mentors: Mentor[];
}) {
  const first = daughter.player_name.split(" ")[0];
  const mentor = (id: string) => mentors.find((m) => m.user_id === id);
  const describe = (id: string) => [mentor(id)?.display_name ?? "A mentor", mentor(id)?.specialty].filter(Boolean).join(" · ");
  const mine = links.filter((l) => l.player_id === daughter.player_id);
  const pending = mine.filter((l) => l.status === "pending");
  const approved = mine.filter((l) => l.status === "approved");
  const wholeTeam = links.filter((l) => !l.player_id && l.status === "approved" && teams.some((t) => t.id === l.team_id));
  if (pending.length + approved.length + wholeTeam.length === 0) return null;
  return (
    <Card title={`${first}'s mentors`}>
      <div className="flex flex-col gap-4">
        {pending.length > 0 && (
          <ul className="flex flex-col gap-2">
            {pending.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-pink/60 bg-pink/5 p-3">
                <span className="text-sm">
                  <span className="font-semibold">{describe(l.mentor_id)}</span> <span className="text-muted">asks to mentor {first}.</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <ActionForm action={decideMentorForDaughter} className="flex items-center gap-2">
                    <input type="hidden" name="link_id" value={l.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <SubmitButton pendingLabel="Saving…">Approve</SubmitButton>
                  </ActionForm>
                  <ActionForm action={decideMentorForDaughter} className="flex items-center gap-2">
                    <input type="hidden" name="link_id" value={l.id} />
                    <input type="hidden" name="decision" value="decline" />
                    <ConfirmSubmit message={`Decline ${mentor(l.mentor_id)?.display_name ?? "this mentor"}?`} confirmLabel="Decline" className={buttonStyles("secondary")}>
                      Decline
                    </ConfirmSubmit>
                  </ActionForm>
                </span>
              </li>
            ))}
          </ul>
        )}
        {pending.length > 0 && (
          <p className="text-xs text-muted">
            An approved mentor sees {first}&apos;s Goals, Pop Report and Mental GP, can message her and add training to her week, and keeps notes with her coaches.
            You read all of it.
          </p>
        )}
        {(approved.length > 0 || wholeTeam.length > 0) && (
          <ul className="divide-y divide-navy-800">
            {approved.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="text-sm font-semibold">{describe(l.mentor_id)}</span>
                <ActionForm action={removeMentorFromDaughter} className="flex items-center gap-2">
                  <input type="hidden" name="link_id" value={l.id} />
                  <ConfirmSubmit
                    message={`Remove ${mentor(l.mentor_id)?.display_name ?? "this mentor"}? They lose access to ${first}'s pages.`}
                    confirmLabel="Remove"
                    tone="danger"
                    className={buttonStyles("link", "text-muted")}
                  >
                    Remove
                  </ConfirmSubmit>
                </ActionForm>
              </li>
            ))}
            {wholeTeam.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="text-sm font-semibold">{describe(l.mentor_id)}</span>
                <Badge tone="neutral">Whole team · {teams.find((t) => t.id === l.team_id)?.name}</Badge>
              </li>
            ))}
          </ul>
        )}
        {(approved.length > 0 || wholeTeam.length > 0) && (
          <Link href={`/family/mentors?player=${daughter.player_id}`} className={buttonStyles("link", "self-start")}>
            Messages, focus areas and notes →
          </Link>
        )}
      </div>
    </Card>
  );
}
