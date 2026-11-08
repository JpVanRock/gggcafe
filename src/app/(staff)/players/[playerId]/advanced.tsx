// G3 Advanced on the server: the menu board summary, the locked view admins see,
// and links. Reads the book from src/lib/advanced-book.ts (server only).
import Link from "next/link";
import { BOOK_THEME, bookProgress, chapterLabel, visibleChapters } from "@/lib/advanced-book";
import { ProgressBar } from "@/components/progress-bar";
import { EmptyState } from "@/components/ui";
import type { AdvancedBook } from "./advanced-data";
import { AdvancedAccessToggle } from "./advanced-client";
import { MenuItem } from "./menu";
import { guideProgress, type LessonWork } from "@/lib/leadership-guide";

export const LEVEL_LABEL = "G3 Advanced · Level 2";

export function advancedHref(playerId: string, slug?: string) {
  return `/players/${playerId}/advanced${slug ? `/${slug}` : ""}`;
}

/** Menu board summary: her book, where she is in it. */
export function AdvancedSummary({ book, leadership = null }: { book: AdvancedBook; leadership?: LessonWork[] | null }) {
  const lead = leadership ? guideProgress(leadership) : null;
  const chapters = visibleChapters(book.confirmed);
  const progress = bookProgress(book.work, chapters);
  const coming = chapters.filter((c) => c.status === "coming").length;
  return (
    <div>
      <p className="font-mono text-xs tracking-[0.2em] text-[var(--menu-note)] uppercase">{BOOK_THEME}</p>
      <div className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2">
        <MenuItem name="Chapters complete" value={`${progress.done}/${progress.total}`} note={coming ? `${coming} more chapters coming` : undefined} />
        <MenuItem
          name="Up next"
          value={progress.next ? chapterLabel(progress.next, chapters).replace("Chapter ", "Ch. ") : "✓"}
          note={progress.next ? progress.next.title : "Every chapter so far is complete"}
        />
        {lead && (
          <MenuItem name="Leadership Guide" value={`${lead.done}/${lead.total}`} note={lead.next ? `Next: ${lead.next.title}` : "Every lesson complete"} />
        )}
      </div>
      <div className="mt-5">
        <ProgressBar value={progress.done} max={progress.total} label={`${progress.done} of ${progress.total} chapters`} />
      </div>
    </div>
  );
}

/** What admins see before G3 Advanced is unlocked for a player (everyone else sees nothing). */
export function AdvancedLocked({ playerId, name }: { playerId: string; name: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-navy-600 px-5 py-4">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-pink-soft uppercase">{LEVEL_LABEL} · Admins only</p>
        <p className="mt-1 text-sm text-muted">
          Locked for {name}. Players don&apos;t see G3 Advanced until it&apos;s unlocked.
        </p>
      </div>
      <AdvancedAccessToggle playerId={playerId} name={name} on={false} />
    </div>
  );
}

export function AdvancedNotFoundForAdmin({ playerId, name }: { playerId: string; name: string }) {
  return (
    <div className="flex flex-col gap-4">
      <EmptyState>G3 Advanced isn&apos;t unlocked for {name} yet.</EmptyState>
      <AdvancedLocked playerId={playerId} name={name} />
      <Link href={`/players/${playerId}`} className="text-sm text-pink hover:underline">
        ← Back to {name}&apos;s menu
      </Link>
    </div>
  );
}
