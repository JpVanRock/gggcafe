"use client";

// Bold, italic and underline buttons for a textarea: they wrap the selected words in the
// markers src/lib/rich-text.ts reads (press again to take them off). The textarea stays a
// plain form field, so the form saves it as usual.
import { useRef, useState, type ReactElement, type TextareaHTMLAttributes } from "react";
import { wrapSelection, type Mark } from "@/lib/rich-text";
import { RichText } from "@/components/rich-text";

const BUTTONS: { mark: Mark; label: string; face: ReactElement }[] = [
  { mark: "bold", label: "Bold", face: <span className="font-bold">B</span> },
  { mark: "italic", label: "Italic", face: <span className="font-serif italic">I</span> },
  { mark: "underline", label: "Underline", face: <span className="underline underline-offset-2">U</span> },
];

/** A textarea with the B, I and U buttons, and a live preview of how the formatting looks. */
export function FormattedTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(String(props.defaultValue ?? ""));
  const apply = (mark: Mark) => {
    const el = ref.current;
    if (!el) return;
    const next = wrapSelection(el.value, el.selectionStart, el.selectionEnd, mark);
    el.value = next.text;
    setText(next.text);
    el.focus();
    el.setSelectionRange(next.start, next.end);
  };
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-1.5">
      <div role="toolbar" aria-label="Format text" className="flex items-center gap-1">
        {BUTTONS.map((b) => (
          <button
            key={b.mark}
            type="button"
            onMouseDown={(e) => e.preventDefault()} // keep the selection in the box
            onClick={() => apply(b.mark)}
            aria-label={b.label}
            title={`${b.label}: select words, then tap`}
            className="grid size-8 place-items-center rounded-md border border-navy-600 text-sm text-ink transition hover:border-pink hover:bg-navy-800"
          >
            {b.face}
          </button>
        ))}
        <span className="ml-2 text-xs text-muted">Select words, then tap B, I or U.</span>
      </div>
      <textarea ref={ref} {...props} onInput={(e) => setText(e.currentTarget.value)} />
      {/[*_]/.test(text) && paragraphs.length > 0 && (
        <div className="rounded-lg border border-navy-700 bg-navy-950/60 p-3" aria-live="polite">
          <p className="mb-2 font-mono text-2xs font-bold tracking-[0.2em] text-muted uppercase">Preview</p>
          <div className="flex flex-col gap-2 text-sm text-ink">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                <RichText text={p} />
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
