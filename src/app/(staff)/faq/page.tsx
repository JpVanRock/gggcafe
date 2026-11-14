import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth";
import { FAQ, FEATURE_SECTIONS, TIERS, type Access } from "@/lib/access-faq";
import { Softball } from "@/components/softball-icon";
import { Disclosure, PageHeader, eyebrowClass } from "@/components/ui";
import { FaqNav } from "./faq-nav";
import { TitleWithTeamLogo } from "@/components/team-logo";

export const metadata: Metadata = { title: "Access FAQ · GGG.Cafe" };

const heading = "font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

function Mark({ access, tier }: { access: Access; tier: string }) {
  if (access === "no") return <Softball off size={22} label={`Not in ${tier}`} />;
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <Softball size={24} label={access === "coach" ? `In ${tier}, with a coach's OK` : `In ${tier}`} />
      {access === "coach" && <span className="font-mono text-2xs leading-none tracking-wider text-pink-soft uppercase">Coach&apos;s OK</span>}
    </span>
  );
}

export default async function FaqPage() {
  const user = await requireStaffPage();
  // admins only: everyone else gets a 404
  if (user.staff.role !== "admin") notFound();

  return (
    <div className="flex flex-col gap-8">
      <TitleWithTeamLogo>
        <PageHeader title="Access FAQ" description="Admins only · what a player gets with Standard and Advanced Access, side by side" />
      </TitleWithTeamLogo>
      <FaqNav current="/faq" />

      <div className="grid gap-3 sm:grid-cols-2">
        {TIERS.map((t) => (
          <div key={t.key} className={`flex items-start gap-3 rounded-2xl border p-4 ${t.key === "advanced" ? "border-pink bg-pink/5" : "border-navy-600"}`}>
            <Softball size={34} label={t.label} />
            <div>
              <p className="font-display text-xl font-bold tracking-wide uppercase">{t.label}</p>
              <p className="text-sm text-muted">{t.note}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Softball size={18} label="Included" /> Included
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Softball off size={18} label="Not included" /> Not included
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Softball size={18} label="Included with a coach's OK" />
          <span className={eyebrowClass}>Coach&apos;s OK</span> Included once a coach or admin says so
        </span>
      </p>

      <div className="overflow-x-auto rounded-2xl border border-navy-700">
        <table className="w-full text-sm">
          <thead className="bg-navy-900">
            <tr>
              <th className="px-4 py-3 text-left font-mono text-2xs font-bold tracking-[0.2em] text-muted uppercase">Feature</th>
              {TIERS.map((t) => (
                <th key={t.key} className="w-28 px-2 py-3 text-center font-mono text-2xs font-bold tracking-[0.15em] text-highlight uppercase sm:w-36">
                  {t.label.replace(" Access", "")}
                  <span className="block text-2xs font-normal tracking-wider text-muted">Access</span>
                </th>
              ))}
            </tr>
          </thead>
          {FEATURE_SECTIONS.map((section) => (
            <tbody key={section.title} className="border-t border-navy-700">
              <tr>
                <th colSpan={1 + TIERS.length} scope="colgroup" className={`bg-navy-900/60 px-4 py-2 text-left ${heading}`}>
                  {section.title}
                </th>
              </tr>
              {section.features.map((f) => (
                <tr key={f.name} className="border-t border-navy-800">
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-ink">{f.name}</span>
                    <span className="block text-xs text-muted">{f.detail}</span>
                    {f.condition && <span className="mt-0.5 block text-xs text-pink-soft">{f.condition}</span>}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <Mark access={f.standard} tier="Standard Access" />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <Mark access={f.advanced} tier="Advanced Access" />
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className={heading}>Questions</h2>
        <div className="flex flex-col gap-2">
          {FAQ.map((item) => (
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
