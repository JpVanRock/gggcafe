// The app's stored lifecycles, declared once (docs/architecture/state-machines.md lists every state
// machine in the app, including the ones computed from times and the ones inside a page).
// - States are typed from the database, so a value the database doesn't allow won't compile.
// - `guarded` ones are enforced by the database too (migration 20261116030522): any status change
//   that isn't a listed move raises P0010. tests/unit/lifecycles.test.ts fails when the moves here
//   and the database's edges differ, so add a move in both places, in a new migration.
// - Server actions make a move only from its `from` states (`.in("status", X.moves.approve.from)`),
//   so a page left open can't redo a decision someone else already made.
// No runtime imports: node --test runs it directly.
import type { BadgeTone } from "@/components/ui";
import type { Database } from "@/lib/supabase/database.types";

// ---------------------------------------------------------------------------
// The shape and the helpers
// ---------------------------------------------------------------------------

export type Move<S extends string> = {
  /** the states this move starts from */
  from: readonly S[];
  to: S;
  /** who makes it, and where (for people and agents reading the code) */
  by: string;
};

export type Lifecycle<S extends string, M extends string> = {
  /** where the state is stored, e.g. "public.player_claims.status" */
  column: string;
  states: readonly S[];
  /** the state a new row starts in */
  initial: S;
  /** the default words for each state (pages may say it more specifically for their reader) */
  label: Record<S, string>;
  tone: Record<S, BadgeTone>;
  moves: Record<M, Move<S>>;
  /**
   * The database refuses any other change (a private.guard_transition trigger with these edges;
   * tests/unit/lifecycles.test.ts keeps the two in step).
   */
  guarded: boolean;
};

/** Declares a lifecycle; the literal types of its states and moves are kept. */
export function lifecycle<const S extends string, const M extends string>(def: Lifecycle<S, M>): Lifecycle<S, M> {
  return def;
}

/** Whether `move` can start from `state`. */
export function canMove<S extends string, M extends string>(lc: Lifecycle<S, M>, state: S, move: M): boolean {
  return lc.moves[move].from.includes(state);
}

/** The state `move` leads to from `state`, or null when it can't start there. */
export function next<S extends string, M extends string>(lc: Lifecycle<S, M>, state: S, move: M): S | null {
  return canMove(lc, state, move) ? lc.moves[move].to : null;
}

/** The moves that can start from `state`, e.g. which buttons to show. */
export function movesFrom<S extends string, M extends string>(lc: Lifecycle<S, M>, state: S): M[] {
  return (Object.keys(lc.moves) as M[]).filter((m) => canMove(lc, state, m));
}

/** A state nothing moves out of. */
export function isSettled<S extends string, M extends string>(lc: Lifecycle<S, M>, state: S): boolean {
  return movesFrom(lc, state).length === 0;
}

/** Every allowed change as "from>to", sorted: the form the database guard takes. */
export function edges<S extends string, M extends string>(lc: Lifecycle<S, M>): string[] {
  const out = new Set<string>();
  for (const m of Object.values(lc.moves) as Move<S>[]) {
    for (const f of m.from) if (f !== m.to) out.add(`${f}>${m.to}`);
  }
  return [...out].sort();
}

/** Narrows an unknown value (a form field, a row from an untyped RPC) to one of the states. */
export function isState<S extends string, M extends string>(lc: Lifecycle<S, M>, value: unknown): value is S {
  return typeof value === "string" && (lc.states as readonly string[]).includes(value);
}

type Enum<N extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][N];
type Decided = "approve" | "decline";

// ---------------------------------------------------------------------------
// Approval requests: someone asks, someone decides once
// ---------------------------------------------------------------------------

/** A player's account claiming her roster spot (Dugout → Roster; /me). */
export const PLAYER_CLAIM = lifecycle<Enum<"player_claim_status">, Decided | "askAgain" | "consentWithdrawn">({
  column: "public.player_claims.status",
  states: ["pending", "approved", "declined"],
  initial: "pending",
  label: { pending: "Waiting for a coach", approved: "Approved", declined: "Not approved" },
  tone: { pending: "pink", approved: "neon", declined: "neutral" },
  moves: {
    approve: { from: ["pending"], to: "approved", by: "a coach: decidePlayerClaim (teams/actions.ts)" },
    decline: { from: ["pending"], to: "declined", by: "a coach: decidePlayerClaim (teams/actions.ts)" },
    askAgain: { from: ["declined"], to: "pending", by: "the player: request_player_claim()" },
    consentWithdrawn: { from: ["approved"], to: "declined", by: "her parent: withdraw_parental_consent()" },
  },
  guarded: true,
});

/** A parent asking to join a team for her daughter (Dugout → Parents; /family). */
export const PARENT_LINK = lifecycle<Enum<"parent_link_status">, Decided>({
  column: "public.parent_links.status",
  states: ["pending", "approved", "declined"],
  initial: "pending",
  label: { pending: "Waiting for the head coach", approved: "Approved", declined: "Not approved" },
  tone: { pending: "pink", approved: "neon", declined: "neutral" },
  moves: {
    approve: {
      from: ["pending"],
      to: "approved",
      by: "the head coach: decideParentLink (dugout/parents/actions.ts); or the parent code, when her name matches one player on the roster: private.match_parent_link",
    },
    decline: { from: ["pending"], to: "declined", by: "the head coach: decideParentLink (dugout/parents/actions.ts)" },
  },
  guarded: true,
});

/** A mentor asking to work with a whole team (head coach decides) or one player (her parents decide). */
export const MENTOR_LINK = lifecycle<Enum<"mentor_link_status">, Decided>({
  column: "public.mentor_links.status",
  states: ["pending", "approved", "declined"],
  initial: "pending",
  label: { pending: "Waiting", approved: "Approved", declined: "Not approved" },
  tone: { pending: "pink", approved: "neon", declined: "neutral" },
  moves: {
    approve: { from: ["pending"], to: "approved", by: "head coach, her parents or an admin: decide_mentor_link()" },
    decline: { from: ["pending"], to: "declined", by: "head coach, her parents or an admin: decide_mentor_link()" },
  },
  guarded: true,
});

/** A coach sign-up: admins decide head coaches, head coaches decide assistants. */
export const STAFF_REQUEST = lifecycle<Database["public"]["Tables"]["staff_requests"]["Row"]["status"], Decided>({
  column: "public.staff_requests.status",
  states: ["pending", "approved", "declined"],
  initial: "pending",
  label: { pending: "Waiting", approved: "Approved", declined: "Not approved" },
  tone: { pending: "pink", approved: "neon", declined: "neutral" },
  moves: {
    approve: { from: ["pending"], to: "approved", by: "an admin, or a head coach for assistants: decide_staff_request()" },
    decline: { from: ["pending"], to: "declined", by: "an admin, or a head coach for assistants: decide_staff_request()" },
  },
  guarded: true,
});

/** Verified parental consent for a player under 13 (COPPA; /family, admin approvals). */
export const PARENTAL_CONSENT = lifecycle<
  Database["public"]["Tables"]["parental_consents"]["Row"]["status"],
  "verify" | "decline" | "withdraw"
>({
  column: "public.parental_consents.status",
  states: ["pending", "verified", "declined", "withdrawn"],
  // accepted online (user, 2026-11-16): accept_parental_consent() inserts it "verified" (no admin check)
  initial: "pending",
  label: { pending: "Waiting to be checked", verified: "Verified", declined: "Declined", withdrawn: "Withdrawn" },
  tone: { pending: "pink", verified: "neon", declined: "danger", withdrawn: "neutral" },
  moves: {
    verify: { from: ["pending"], to: "verified", by: "an admin: review_parental_consent()" },
    decline: { from: ["pending"], to: "declined", by: "an admin: review_parental_consent()" },
    withdraw: { from: ["pending", "verified"], to: "withdrawn", by: "her parent: withdraw_parental_consent()" },
  },
  guarded: true,
});

// ---------------------------------------------------------------------------
// Drafts a coach finishes and can reopen
// ---------------------------------------------------------------------------

const draftFinal = {
  states: ["draft", "final"],
  initial: "draft",
  label: { draft: "Draft", final: "Final" },
  tone: { draft: "neutral", final: "neon" },
  guarded: false,
} as const;

/** A practice plan: edited as a draft; final plans are locked (save_practice_plan raises P0004) until reopened. */
export const PRACTICE_PLAN = lifecycle<Enum<"practice_plan_status">, "finalize" | "reopen">({
  ...draftFinal,
  column: "public.practice_plans.status",
  moves: {
    finalize: { from: ["draft"], to: "final", by: "a coach: finalizePracticePlan, or sharing it (dugout/plans/actions.ts)" },
    reopen: { from: ["final"], to: "draft", by: "a coach: reopenPracticePlan (dugout/plans/actions.ts)" },
  },
});

/** A GameDay lineup card: the same draft → final → reopen cycle. */
export const GAMEDAY_LINEUP = lifecycle<Enum<"gameday_status">, "finalize" | "reopen">({
  ...draftFinal,
  column: "public.gameday_lineups.status",
  moves: {
    finalize: { from: ["draft"], to: "final", by: "a coach: finalizeLineup, or sharing it (dugout/gameday/actions.ts)" },
    reopen: { from: ["final"], to: "draft", by: "a coach: reopenLineup (dugout/gameday/actions.ts)" },
  },
});

/** The message when a move's row has already moved on (another coach, another tab). */
// (no refresh with it: the request's form would vanish with the message)
export const ALREADY_DECIDED = "Someone already decided this request, so nothing changed. Reload the page to see where it stands.";
