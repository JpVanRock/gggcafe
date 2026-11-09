// Ties a server action's field errors (FormState.fields) to the form's own controls: each named
// field gets aria-invalid (red border from fieldClass; screen readers say "invalid"), the first
// one gets focus, and the mark clears as soon as that field is edited. Used by ActionForm and
// FormMessage, so every form gets it without wiring each field.
export function markFields(form: HTMLFormElement | null | undefined, fields: Record<string, string> | undefined) {
  if (!form) return;
  for (const el of form.querySelectorAll<HTMLElement>("[data-field-error]")) {
    el.removeAttribute("aria-invalid");
    delete el.dataset.fieldError;
  }
  let first: HTMLElement | null = null;
  for (const name of Object.keys(fields ?? {})) {
    const found = form.elements.namedItem(name);
    const el = found instanceof RadioNodeList ? (found[0] as HTMLElement | undefined) : (found as HTMLElement | null);
    if (!el || (el as HTMLInputElement).type === "hidden") continue;
    el.setAttribute("aria-invalid", "true");
    el.dataset.fieldError = "";
    el.addEventListener(
      "input",
      () => {
        el.removeAttribute("aria-invalid");
        delete el.dataset.fieldError;
      },
      { once: true },
    );
    first ??= el;
  }
  first?.focus();
}
