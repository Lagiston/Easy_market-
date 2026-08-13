import { DEFAULT_SITE_CONTENT, SITE_CONTENT_KEYS, type SiteContent } from "@es-market/core";
import { prisma } from "./prisma";

// Missing rows (fresh DB, or a key never edited) fall back to
// DEFAULT_SITE_CONTENT — no seed required, same convention as getSettings().
export async function getSiteContent(): Promise<SiteContent> {
  const rows = await prisma.siteContent.findMany();
  const content: SiteContent = { ...DEFAULT_SITE_CONTENT };
  for (const row of rows) {
    if ((SITE_CONTENT_KEYS as readonly string[]).includes(row.key)) {
      content[row.key as keyof SiteContent] = row.value;
    }
  }
  return content;
}
