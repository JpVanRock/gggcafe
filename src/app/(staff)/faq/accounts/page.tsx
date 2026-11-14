import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth";
import { ACCOUNT_TYPES, QUESTIONS, SECTIONS, type Level } from "@/lib/account-types";
import { Softball } from "@/components/softball-icon";
import { Disclosure, PageHeader, eyebrowClass } from "@/components/ui";
import { FaqNav } from "../faq-nav";
import { TitleWithTeamLogo } from "@/components/team-logo";

export const metadata: Metadata = { title: "Account types · FAQ · GGG.Cafe" };

// Admin-only (user, 2026-11-08): the five registration types and what each
// one's dashboard can use, side by side. Content: src/lib/account-types.ts.
const heading = "font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";
const TAG: Partial<Record<Level, string>> = { part: "Part", own: "Own", view: "View" };
const SAYS: Record<Level, string> = { yes: "Yes", part: "Part of it", own: "Only their own", view: "View only", no: "No" };

function Mark({ level, who }: { level: Level; who: string }) {
  if (level === "no") return <Softball off size={20} label={`${who}: no`} />;
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <Softball size={22} label={`${who}: ${SAYS[level]}`} />
      {TAG[level] && <span className="font-mono text-2xs leading-none tracking-wider text-pink-soft uppercase">{TAG[level]}</span>}
    </span>
  );
}

export default async function AccountTypesPage() {
  const user = await requireStaffPage();
  // admins only: everyone else gets a 404
  if (user.staff.role !== "admin") notFound();

  return (
    <div className="flex flex-col gap-8">
      <TitleWithTeamLogo>
        <PageHeader title="Account types" description="Admins only · the five ways to register and what each dashboard can use, side by side" />
      </TitleWithTeamLogo>
      <FaqNav current="/faq/accounts" />

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACCOUNT_TYPES.map((t, i) => (
          <li key={t.key} className="flex flex-col gap-2 rounded-2xl border border-navy-600 p-4">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-sm font-bold text-pink-soft tabular-nums">0{i + 1}</span>
              <span className="font-display text-xl font-bold tracking-wide uppercase">{t.label}</span>
            </p>
            <p className="text-sm text-ink/90">{t.signup}</p>
            <p className="mt-auto text-xs text-muted">
              <span className="font-semibold text-highlight">Home:</span> {t.home}
            </p>
          </li>
        ))}
        <li className="flex flex-col justify-center gap-1 rounded-2xl border border-pink/50 bg-pink/5 p-4 text-sm text-muted">
          <span className="font-display text-xl font-bold tracking-wide text-ink uppercase">Admin</span>
          Not a sign-up. Everything a head coach has, plus approving head coaches and mentors, roles, G3 Advanced and these FAQ pages.
        </li>
      </ol>

      <p className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Softball size={18} label="Yes" /> Yes
        </span>
        {(["part", "own", "view"] as const).map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <Softball size={18} label={SAYS[l]} />
            <span className={eyebrowClass}>{TAG[l]}</span> {SAYS[l]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <Softball off size={18} label="No" /> No
        </span>
      </p>

      <div className="overflow-x-auto rounded-2xl border border-navy-700">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-navy-900">
            <tr>
              <th className="px-4 py-3 text-left font-mono text-2xs font-bold tracking-[0.2em] text-muted uppercase">Feature</th>
              {ACCOUNT_TYPES.map((t) => (
                <th key={t.key} className="w-20 px-1 py-3 text-center font-mono text-2xs font-bold tracking-[0.1em] text-highlight uppercase sm:w-24">
                  {t.label.split(" ").map((w) => (
                    <span key={w} className="block">
                      {w}
                    </span>
                  ))}
                </th>
              ))}
            </tr>
          </thead>
          {SECTIONS.map((section) => (
            <tbody key={section.title} className="border-t border-navy-700">
              <tr>
                <th colSpan={1 + ACCOUNT_TYPES.length} scope="colgroup" className={`bg-navy-900/60 px-4 py-2 text-left ${heading}`}>
                  {section.title}
                </th>
              </tr>
              {section.rows.map((r) => (
                <tr key={r.name} className="border-t border-navy-800">
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-ink">{r.name}</span>
                    <span className="block text-xs text-muted">{r.detail}</span>
                    {r.condition && <span className="mt-0.5 block text-xs text-pink-soft">{r.condition}</span>}
                  </td>
                  {ACCOUNT_TYPES.map((t) => (
                    <td key={t.key} className="px-1 py-3 text-center">
                      <Mark level={r.access[t.key]} who={t.label} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className={heading}>Questions</h2>
        <div className="flex flex-col gap-2">
          {QUESTIONS.map((item) => (
            <Disclosure key={item.q} summary={item.q}>
              <div className="flex flex-col gap-2 text-sm text-ink/90">
                {item.a.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </Disclosure>
          ))}
        </div>
      </section>
    </div>
  );
}
