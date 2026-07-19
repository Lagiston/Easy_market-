import { sanitize } from "isomorphic-dompurify";

// Strips all HTML/SVG/MathML markup from user-supplied plain-text input while
// keeping the text itself intact. DOMPurify serializes the surviving text
// nodes with `&`/`<`/`>` (and NBSP) entity-encoded; these fields are stored
// and rendered as plain text (React escapes on output), so decode those
// entities back — otherwise "Bags & Belts" would persist as "Bags &amp; Belts".
// Decode order matters: `&amp;` last, so "&amp;lt;" round-trips to "&lt;".
export function sanitizeText(value: string): string {
  return sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .trim();
}
