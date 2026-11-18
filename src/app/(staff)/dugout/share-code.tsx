"use client";

// Copy code and Share invite beside the parent code (design audit 2026-11-18, P3): coaches text this
// code to parents. Share invite opens the phone's share sheet with the sign-up page and the code; where
// there's no share sheet (most desktops) it copies the same invite. The result is announced.
import { useState } from "react";
import { pillQuietClass } from "@/components/ui";

export function ShareCode({ code, teamName, signUpUrl }: { code: string; teamName: string; signUpUrl: string }) {
  const [said, setSaid] = useState("");
  const invite = `Join ${teamName} on GGG.Cafe: sign up at ${signUpUrl} and enter the parent code ${code}.`;

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setSaid(done);
    } catch {
      setSaid("Couldn't copy. Select the code and copy it instead.");
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `Join ${teamName} on GGG.Cafe`, text: invite });
        setSaid("");
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // closed the share sheet
      }
    }
    await copy(invite, "Invite copied: paste it into a text or email.");
  }

  return (
    <>
      <button type="button" className={pillQuietClass} onClick={() => copy(code, "Code copied.")}>
        Copy code
      </button>
      <button type="button" className={pillQuietClass} onClick={share}>
        Share invite
      </button>
      {/* always in the page (an empty live region still announces its first message), shown once it says something */}
      <span role="status" className={said ? "basis-full text-xs text-muted" : "sr-only"}>
        {said}
      </span>
    </>
  );
}
