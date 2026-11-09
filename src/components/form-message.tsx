"use client";

// A server action's result under a form: the error in red, or "Saved." Announced by screen
// readers. Pass `fields` (FormState.fields) and the fields it names are marked in the form and
// the first one gets focus (see field-errors.ts).
import { useEffect, useRef } from "react";
import { markFields } from "@/components/field-errors";

export function FormMessage({ error, saved, fields }: { error: string | null; saved?: boolean; fields?: Record<string, string> }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    markFields(ref.current?.closest("form"), fields);
  }, [fields]);
  return (
    <p ref={ref} aria-live="polite" className={`min-h-5 text-sm ${error ? "text-danger" : "text-highlight"}`}>
      {error ?? (saved ? "Saved." : "")}
    </p>
  );
}
