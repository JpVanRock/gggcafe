// The messaging center as an inbox (user, 2026-11-23: "The messaging center should be like a streaming platform or
// inbox"): conversations on the left, newest first, with what's new; the open one on the right as a chat. On phones
// the list fills the screen until you open a conversation, which then fills it, with a link back.
import Link from "next/link";
import type { ReactNode } from "react";
import { CountBadge, eyebrowClass } from "@/components/ui";

export type InboxItem = {
  key: string;
  href: string;
  title: string;
  /** who the conversation is with: "Player", "Parents", "Mentor" */
  tag: string;
  preview: string;
  /** already formatted ("2:04 PM", "Nov 21"); null for an empty conversation */
  when: string | null;
  unread: number;
  active: boolean;
  photo?: string | null;
  /** what the round avatar shows without a photo (initials, a jersey number) */
  initials: string;
};

export function Inbox({ list, open, children, placeholder }: { list: ReactNode; open: boolean; children?: ReactNode; placeholder: ReactNode }) {
  return (
    // grid-cols-1 and min-w-0: a long name (truncated on one line) can't widen the page on a phone
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <div className={open ? "hidden min-w-0 lg:block" : "min-w-0"}>{list}</div>
      <div className={open ? "min-w-0" : "hidden min-w-0 lg:block"}>{open ? children : placeholder}</div>
    </div>
  );
}

export function InboxList({ label, items, empty, top }: { label: string; items: InboxItem[]; empty: string; top?: ReactNode }) {
  return (
    <nav aria-label={label} className="flex flex-col rounded-2xl border border-navy-700 bg-navy-900/70">
      {top && <div className="flex flex-col gap-3 border-b border-navy-700 p-3">{top}</div>}
      {items.length === 0 ? (
        <p className="p-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-navy-700 lg:max-h-[68vh] lg:overflow-y-auto">
          {items.map((i) => (
            <li key={i.key}>
              <Link
                href={i.href}
                aria-current={i.active ? "page" : undefined}
                className={`flex gap-3 border-l-[3px] px-3 py-3 transition hover:bg-navy-800 ${i.active ? "border-l-pink bg-navy-800" : "border-l-transparent"}`}
              >
                {i.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
                  <img src={i.photo} alt="" className="size-10 shrink-0 rounded-full border-2 border-neon-edge object-cover" />
                ) : (
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-navy-600 font-display text-sm font-bold text-highlight">
                    {i.initials}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate ${i.unread ? "font-bold text-ink" : "font-semibold text-ink/90"}`}>{i.title}</span>
                    {i.when && <span className="shrink-0 font-display text-xs text-muted tabular-nums">{i.when}</span>}
                  </span>
                  <span className={eyebrowClass}>{i.tag}</span>
                  <span className="flex items-center justify-between gap-2">
                    <span className={`line-clamp-1 text-sm ${i.unread ? "text-ink" : "text-muted"}`}>{i.preview || "No messages yet"}</span>
                    <CountBadge count={i.unread} label={`${i.unread} new`} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

/** The open conversation: who it's with, a line about who reads it, the messages, then the box to write in. */
export function ConversationPane({
  back,
  title,
  tag,
  note,
  aside,
  children,
  composer,
}: {
  /** the list, for phones (on wider screens it's beside the conversation) */
  back: { href: string; label: string };
  title: string;
  tag: string;
  note: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  composer?: ReactNode;
}) {
  return (
    <section aria-label={`${title}: ${tag}`} className="flex min-w-0 flex-col rounded-2xl border border-navy-700 bg-navy-900/70">
      <header className="flex flex-col gap-1 border-b border-navy-700 p-4">
        <Link href={back.href} className="text-sm text-muted hover:text-ink lg:hidden">
          <span aria-hidden="true">←</span> {back.label}
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="font-display text-xl leading-tight font-bold tracking-wide text-highlight uppercase">{title}</h2>
          {aside}
        </div>
        <p className={eyebrowClass}>{tag}</p>
        <p className="text-xs text-muted">{note}</p>
      </header>
      <div className="p-3 sm:p-4">{children}</div>
      {composer && <div className="border-t border-navy-700 p-4">{composer}</div>}
    </section>
  );
}

/** The right side before a conversation is open (wide screens only). */
export function InboxPlaceholder({ children }: { children: ReactNode }) {
  return <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-navy-600 p-6 text-center text-sm text-muted">{children}</div>;
}
