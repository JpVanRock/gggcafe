import { RATING_LABELS } from "@/lib/training-plan";
import { badgeClass } from "@/components/ui";

/** A 1-5 athletic-test rating as a chip: Building, Developing, Solid, Strong, Elite. */
export function RatingChip({ rating }: { rating: number }) {
  const tone = rating >= 5 ? "neon" : rating === 4 ? "pink" : rating === 3 ? "ink" : "neutral";
  return (
    <span className={badgeClass(tone)} title={`${rating} of 5`}>
      {RATING_LABELS[rating - 1]}
    </span>
  );
}
