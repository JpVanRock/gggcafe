// The Terms of Service checkbox (clickwrap): unchecked to start, required, with the documents one
// tap away in a new tab so the form isn't lost. Used at sign-up and on /terms/accept.
import Link from "next/link";
import { AGREEMENT_LABEL } from "@/lib/legal";

const docLink = "text-link underline underline-offset-2 hover:text-ink";

export function AgreementCheckbox({ name = "agree" }: { name?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" name={name} required className="mt-1 size-4 shrink-0 accent-pink" />
        <span>{AGREEMENT_LABEL}</span>
      </label>
      <p className="pl-7 text-sm text-muted">
        Read the{" "}
        <Link href="/terms" target="_blank" rel="noopener" className={docLink}>
          Terms of Service<span className="sr-only"> (opens in a new tab)</span>
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" target="_blank" rel="noopener" className={docLink}>
          Privacy &amp; Security Notice<span className="sr-only"> (opens in a new tab)</span>
        </Link>
        .
      </p>
    </div>
  );
}
