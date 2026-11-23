"use client";

// Writing in a mentor conversation (user, 2026-11-23): the player answering her mentor, a parent writing to her
// daughter's mentor, and the mentor's notes to the parents. Free text; what was typed stays when sending fails.
import { useState, useTransition } from "react";
import { Field, buttonStyles, inputClass } from "@/components/ui";
import { MESSAGE_MAX } from "@/lib/mentors";

export function ReplyForm({
  action,
  label,
  placeholder,
  sendLabel = "Send",
  hint,
}: {
  /** a server action bound to the thread: gets the text */
  action: (body: string) => Promise<{ error: string | null }>;
  label: string;
  placeholder?: string;
  sendLabel?: string;
  hint?: string;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSent(false);
        startTransition(async () => {
          const res = await action(body);
          if (res.error) return setError(res.error);
          setBody("");
          setSent(true);
        });
      }}
      aria-busy={pending}
    >
      <Field label={label} hint={hint} error={error}>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setSent(false);
          }}
          maxLength={MESSAGE_MAX}
          rows={3}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={inputClass}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !body.trim()} className={buttonStyles("primary")}>
          {pending ? "Sending…" : sendLabel}
        </button>
        {sent && (
          <span role="status" className="text-sm text-muted">
            Sent.
          </span>
        )}
      </div>
    </form>
  );
}
