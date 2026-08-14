import type { LocalizedName } from "@es-market/core";
import { prisma } from "./prisma";

// Resolves Tag translations for a set of tag values in one query, for
// attaching onto storefront product responses (see attachProductSummaries
// in storefront.ts) and the /storefront/tags filter dropdown. A tag with no
// Tag row falls back to { en: value } — an untranslated tag still renders,
// just without ar/sw/fr, same null-vs-untranslated convention used
// elsewhere in this codebase.
export async function resolveTagNames(values: string[]): Promise<Record<string, LocalizedName>> {
  const distinct = Array.from(new Set(values));
  const result: Record<string, LocalizedName> = {};
  for (const value of distinct) {
    result[value] = { en: value };
  }
  if (distinct.length === 0) return result;
  const rows = await prisma.tag.findMany({ where: { value: { in: distinct } } });
  for (const row of rows) {
    result[row.value] = row.name as LocalizedName;
  }
  return result;
}

// Called from the product create/update routes so a brand-new tag value
// gets an English-only Tag row the moment it's first used — otherwise it'd
// only ever show up on /admin/tags after someone reran
// backfill-tag-translations.ts. skipDuplicates makes this a no-op (not an
// overwrite) for any value that already has a row, so an admin's existing
// translation is never clobbered by a later product save.
export async function ensureTagRows(values: string[]): Promise<void> {
  const distinct = Array.from(new Set(values));
  if (distinct.length === 0) return;
  await prisma.tag.createMany({
    data: distinct.map((value) => ({ value, name: { en: value } })),
    skipDuplicates: true,
  });
}
