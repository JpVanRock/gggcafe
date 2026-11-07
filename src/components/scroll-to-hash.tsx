"use client";
// Content inside <Suspense> streams in after the page loads, so the browser has
// already given up on a link's #anchor. Render this at the end of the streamed
// content and it scrolls to the anchor once it exists.
import { useEffect } from "react";

export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return null;
}
