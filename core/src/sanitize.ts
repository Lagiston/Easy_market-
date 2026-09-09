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

// Shared z.preprocess step for an optional schema field whose form control
// can't submit `undefined` directly — a blank text/select input gives "",
// a cleared PUT-to-clear API payload gives null, and a cleared number input's
// `valueAsNumber` gives NaN. All three mean "not provided" the same way
// across every schema that used to hand-roll this check per field.
export function emptyToUndefined(value: unknown): unknown {
  if (value === "" || value === null) return undefined;
  if (typeof value === "number" && Number.isNaN(value)) return undefined;
  return value;
}
