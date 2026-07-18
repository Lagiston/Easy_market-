import type { Language } from "@es-market/core";

// Localized content fields ({ en, ar?, sw?, fr? }) fall back to English when the
// current UI language has no translation.
export function localize(
  value: { en: string } & Partial<Record<Language, string>>,
  language: string,
): string {
  return value[language as Language] ?? value.en;
}
