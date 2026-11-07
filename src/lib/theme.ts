// Night Game (dark, default) / Day Game (white background). Shared by the
// switch (src/components/theme-toggle.tsx) and the root layout.

/** localStorage key for the chosen background: "day" or "night". */
export const THEME_KEY = "ggg-theme";

/** Inline <head> script: puts the saved choice on <html> before the first paint (no flash). */
export const THEME_BOOT_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="day")document.documentElement.dataset.theme="day"}catch(e){}`;
