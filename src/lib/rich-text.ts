// Light formatting coaches can type in free-form text (user, 2026-11-11: the Team Culture
// box): **bold**, __underline__ and *italic*, nested any way. Parsed into a tree and drawn
// as React elements (components/rich-text.tsx), never as HTML, so nothing typed can run.
// No imports, so it runs in unit tests and client code.

export type Mark = "bold" | "underline" | "italic";
export type RichNode = string | { mark: Mark; children: RichNode[] };

export const MARKERS: Record<Mark, string> = { bold: "**", underline: "__", italic: "*" };

// longest markers first, so "**" isn't read as two "*"; a marked run can't start or end
// with a space, so "2 * 3" or a stray "**" stays plain text
const PATTERN = /\*\*(?!\s)([\s\S]*?\S)\*\*|__(?!\s)([\s\S]*?\S)__|\*(?!\s)([^*\n]*?[^\s*])\*/;

/** Text to nodes: marked runs become { mark, children }; anything unmatched stays plain text. */
export function parseRich(text: string): RichNode[] {
  const out: RichNode[] = [];
  let rest = text;
  while (rest) {
    const m = PATTERN.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const [whole, bold, underline, italic] = m;
    const mark: Mark = bold !== undefined ? "bold" : underline !== undefined ? "underline" : "italic";
    out.push({ mark, children: parseRich(bold ?? underline ?? italic ?? "") });
    rest = rest.slice(m.index + whole.length);
  }
  return out;
}

/** The text without its markers (for a one-line preview or a screen-reader label). */
export function plainText(text: string): string {
  const walk = (nodes: RichNode[]): string => nodes.map((n) => (typeof n === "string" ? n : walk(n.children))).join("");
  return walk(parseRich(text));
}

/** Wraps the selected part of a text in a mark's markers: the new text and where the selection goes. */
export function wrapSelection(text: string, from: number, to: number, mark: Mark) {
  const m = MARKERS[mark];
  // a double-click often grabs the space after a word: leave spaces outside the markers
  let start = from;
  let end = to;
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  const picked = text.slice(start, end);
  // already wrapped: take the markers off again
  if (text.slice(start - m.length, start) === m && text.slice(end, end + m.length) === m && picked) {
    return { text: text.slice(0, start - m.length) + picked + text.slice(end + m.length), start: start - m.length, end: end - m.length };
  }
  return { text: text.slice(0, start) + m + picked + m + text.slice(end), start: start + m.length, end: end + m.length };
}
