"use client";

// Preferred Hitting Style's switch (user, 2026-11-16: "a toggle switch that defaults to Coach Observation
// to Player Choice"): two panels drawn on the server, one shown at a time. Opens on Coach Observation.
import { useId, useState, type ReactNode } from "react";
import { HITTING_SOURCES, HITTING_SOURCE_LABEL, type HittingSource } from "@/lib/movement";

const item = "inline-flex min-h-9 items-center rounded-full px-4 transition";

export function HittingStyleToggle({ panels }: { panels: Record<HittingSource, ReactNode> }) {
  const [shown, setShown] = useState<HittingSource>("coach");
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Show hitting style" className="inline-flex self-start rounded-full border border-navy-600 p-0.5 text-xs font-semibold tracking-wider uppercase">
        {HITTING_SOURCES.map((source) => (
          <button
            key={source}
            type="button"
            aria-pressed={shown === source}
            aria-controls={`${id}-${source}`}
            onClick={() => setShown(source)}
            className={`${item} ${shown === source ? "bg-pink text-on-accent" : "text-muted hover:text-ink"}`}
          >
            {HITTING_SOURCE_LABEL[source]}
          </button>
        ))}
      </div>
      {HITTING_SOURCES.map((source) => (
        <div key={source} id={`${id}-${source}`} hidden={shown !== source}>
          {panels[source]}
        </div>
      ))}
    </div>
  );
}
