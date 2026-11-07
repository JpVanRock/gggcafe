// Pink-to-neon progress bar with a label and percentage underneath. Works in
// server and client components.
export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-navy-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-linear-to-r from-pink to-neon transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 flex justify-between font-mono text-[11px] tracking-wider text-muted uppercase">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </p>
    </div>
  );
}
