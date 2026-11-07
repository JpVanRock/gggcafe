"use client";

// The Night Game / Day Game switch. Night Game (dark, the default) and Day Game
// (white background) are set by html[data-theme]; the choice is remembered in
// this browser. A script in the root layout applies it before the page paints,
// so a Day Game page never flashes dark first.
import { useSyncExternalStore } from "react";
import { THEME_KEY } from "@/lib/theme";

const CHANGE_EVENT = "ggg-theme-change";

type Theme = "night" | "day";

function apply(theme: Theme) {
  if (theme === "day") document.documentElement.dataset.theme = "day";
  else delete document.documentElement.dataset.theme;
}

function subscribe(onChange: () => void) {
  // another tab switched: follow it
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) {
      apply(e.newValue === "day" ? "day" : "night");
      onChange();
    }
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const current = (): Theme => (document.documentElement.dataset.theme === "day" ? "day" : "night");
const serverTheme = (): Theme => "night";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, current, serverTheme);
  const day = theme === "day";

  function toggle() {
    const next: Theme = day ? "night" : "day";
    apply(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // private mode or storage blocked: the switch still works for this visit
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  const label = (on: boolean) =>
    `font-mono text-[10px] tracking-[0.15em] uppercase transition ${on ? "text-ink" : "text-muted"}`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={day}
      aria-label="Day Game: white background"
      title={day ? "Switch to Night Game (dark background)" : "Switch to Day Game (white background)"}
      onClick={toggle}
      className={`group inline-flex items-center gap-2 rounded-full py-1 ${className}`}
    >
      <span className={`${label(!day)} ${day ? "hidden sm:inline" : ""}`}>Night Game</span>
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full border transition ${
          day ? "border-pink bg-neon" : "border-navy-600 bg-navy-800"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full shadow transition-transform ${
            day ? "translate-x-4 bg-on-accent" : "bg-pink"
          }`}
        />
      </span>
      <span className={`${label(day)} ${day ? "" : "hidden sm:inline"}`}>Day Game</span>
    </button>
  );
}

/** The switch pinned to the top right of pages without the staff header. */
export function CornerThemeToggle() {
  return (
    <div className="fixed top-3 right-4 z-20">
      <ThemeToggle />
    </div>
  );
}
