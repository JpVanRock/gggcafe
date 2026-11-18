"use client";

// Keeps --header-h on <html> equal to the sticky header's height (0 while it doesn't stick, on
// phones), so scroll-padding-top in globals.css leaves room for it: keyboard focus and #anchors
// never land under the header (WCAG 2.4.11), whether it is one row or wraps to two.
import { useEffect, useRef } from "react";

export function StickyHeaderOffset() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = marker.current?.closest("header");
    if (!header) return;
    const root = document.documentElement;
    const update = () => {
      const sticky = getComputedStyle(header).position === "sticky";
      root.style.setProperty("--header-h", sticky ? `${header.offsetHeight}px` : "0px");
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    // crossing 640px switches sticky on or off without the header changing size
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--header-h");
    };
  }, []);

  return <span ref={marker} hidden />;
}
