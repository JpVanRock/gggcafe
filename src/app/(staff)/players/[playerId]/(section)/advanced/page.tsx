import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Loading, buttonClass } from "@/components/ui";
import { OutlineText, SpeedStripes } from "@/components/athletic";
import { ProgressBar } from "@/components/progress-bar";
import { BOOK_THEME, BOOK_TITLE_MAX, bookProgress, chapterLabel, visibleChapters } from "@/lib/advanced-book";
import { possessive } from "../../data";
import { loadAdvanced } from "../../advanced-data";
import { loadLeadership } from "../../leadership-data";
import { LeaderToggle } from "../../leadership-client";
import { leadershipHref } from "../../leadership";
import { GUIDE_TITLE, guideProgress } from "@/lib/leadership-guide";
import { AdvancedNotFoundForAdmin, LEVEL_LABEL, advancedHref } from "../../advanced";
import { AdvancedAccessToggle, BookTitle, ConfirmPosition } from "../../advanced-client";
import { firstName, loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "G3 Advanced · GGG.Cafe" };

export default function AdvancedPage({ params }: PageProps<"/players/[playerId]/advanced">) {
  return (
    <Suspense fallback={<Loading />}>
      <Advanced params={params} />
    </Suspense>
  );
}

async function Advanced({ params }: Pick<PageProps<"/players/[playerId]/advanced">, "params">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const book = await loadAdvanced(supabase, player.id);
  const isAdmin = access.user.staff?.role === "admin";
  const name = firstName(player);
  if (!book.unlocked) {
    if (!isAdmin) notFound();
    return <AdvancedNotFoundForAdmin playerId={player.id} name={name} />;
  }

  const chapters = visibleChapters(book.confirmed);
  const progress = bookProgress(book.work, chapters);
  const next = progress.next ?? chapters[0];
  const lead = await loadLeadership(supabase, player.id, book.unlocked);
  const leadProgress = lead.open ? guideProgress(lead.work) : null;
  return (
    <SectionShell title={book.title} subtitle={`${LEVEL_LABEL} · ${BOOK_THEME}`}>
      {/* the cover */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-pink bg-linear-to-br from-navy-950 via-navy-900 to-navy-800 p-6 sm:p-8">
        <OutlineText stroke="rgb(254 31 124 / 0.35)" className="absolute -right-2 -bottom-6 text-[9rem] leading-none tracking-tighter sm:text-[12rem]">
          G3
        </OutlineText>
        <p className="relative flex items-center gap-3 font-mono text-xs tracking-[0.3em] text-pink-soft uppercase">
          <SpeedStripes className="h-3 w-9 text-pink" />
          {possessive(name)} book
        </p>
        <h2 className="relative mt-3 text-4xl leading-none font-bold tracking-wide text-highlight uppercase sm:text-6xl">{book.title}</h2>
        <p className="relative mt-3 font-mono text-sm tracking-[0.2em] text-ink/80 uppercase">{BOOK_THEME}</p>
        <div className="relative mt-4">
          <BookTitle playerId={player.id} title={book.title} canEdit={access.canAct} maxLength={BOOK_TITLE_MAX} />
        </div>
        <div className="relative mt-6 max-w-md">
          <ProgressBar value={progress.done} max={progress.total} label={`${progress.done} of ${progress.total} chapters complete`} />
        </div>
        <Link href={advancedHref(player.id, next.slug)} className={`${buttonClass} relative mt-5`}>
          {progress.done === 0 && !book.work.length ? "Start reading" : progress.next ? `Continue: ${progress.next.title}` : "Read it again"}
        </Link>
      </div>

      {leadProgress && (
        <Link
          href={leadershipHref(player.id)}
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-neon bg-neon/5 p-5 transition hover:bg-neon/10"
        >
          <span>
            <span className="block font-mono text-[11px] tracking-[0.2em] text-pink-soft uppercase">Picked by your coach</span>
            <span className="block font-display text-2xl font-bold tracking-wide text-highlight uppercase">{GUIDE_TITLE}</span>
          </span>
          <span className="font-mono text-xs tracking-wider text-ink uppercase">
            {leadProgress.done} of {leadProgress.total} lessons →
          </span>
        </Link>
      )}

      {/* table of contents */}
      <h2 className="mt-8 mb-3 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Contents</h2>
      <ol className="divide-y divide-navy-700 border-y border-navy-700">
        {chapters.map((c) => {
          const work = book.work.find((w) => w.chapter === c.slug);
          const status =
            c.status === "coming"
              ? "Coming soon"
              : work?.completedAt
                ? "Complete ✓"
                : c.habits
                  ? `${work?.owned.length ?? 0} of ${c.habits.length} habits owned`
                  : "Start here";
          return (
            <li key={c.slug}>
              <Link
                href={advancedHref(player.id, c.slug)}
                className={`flex items-center gap-4 px-1 py-4 transition hover:bg-navy-800 ${c.status === "coming" ? "opacity-60" : ""}`}
              >
                <span className="w-24 shrink-0 font-mono text-[11px] tracking-wider text-muted uppercase">{chapterLabel(c, chapters)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">
                    {c.title}
                    {c.kicker && <span className="ml-2 font-mono text-[10px] tracking-wider text-pink-soft uppercase">{c.kicker}</span>}
                  </span>
                  <span className="block text-sm text-muted">{c.summary}</span>
                </span>
                <span className={`hidden shrink-0 font-mono text-[11px] tracking-wider uppercase sm:block ${work?.completedAt ? "text-highlight" : "text-muted"}`}>
                  {status}
                </span>
                <span className="text-pink">→</span>
              </Link>
            </li>
          );
        })}
      </ol>

      {access.canManage && (
        <div className="mt-8 flex flex-col gap-2 rounded-xl border border-navy-700 p-4">
          <p className="font-mono text-[11px] tracking-wider text-pink-soft uppercase">Coaches · position chapters</p>
          <p className="text-sm text-muted">
            The Pitching chapter is only in the book of a player you&apos;ve confirmed as a pitcher.
          </p>
          <ConfirmPosition playerId={player.id} name={name} position="P" label="pitcher" confirmed={book.confirmed.includes("P")} />
          <p className="mt-3 font-mono text-[11px] tracking-wider text-pink-soft uppercase">Coaches · leadership</p>
          <p className="text-sm text-muted">The G3 Leadership Guide is for the players you pick to train as leaders.</p>
          <LeaderToggle playerId={player.id} name={name} on={lead.picked} />
        </div>
      )}

      {isAdmin && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-navy-700 pt-4 text-xs text-muted">
          <span>Unlocked {book.source === "subscription" ? "by subscription" : "by an admin"}.</span>
          <AdvancedAccessToggle playerId={player.id} name={name} on />
        </div>
      )}
    </SectionShell>
  );
}
