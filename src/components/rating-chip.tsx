import { RATING_LABELS } from "@/lib/training-plan";

/** A 1-5 athletic-test rating as a chip: Building, Developing, Solid, Strong, Elite. */
export function RatingChip({ rating }: { rating: number }) {
  const cls =
    rating >= 5 ? "bg-neon text-on-accent" : rating === 4 ? "border border-pink text-pink-soft" : rating === 3 ? "border border-navy-600 text-ink" : "border border-navy-700 text-muted";
  return (
    <span className={`rounded px-1.5 py-px font-mono text-[10px] font-bold tracking-wider uppercase ${cls}`} title={`${rating} of 5`}>
      {RATING_LABELS[rating - 1]}
    </span>
  );
}
