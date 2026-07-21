import { Prisma } from "../generated/prisma/client";
import { prisma } from "./prisma";
import type { Language } from "@es-market/core";

// Maps each app language to the generated tsvector column built in migration
// 20260721185241_kb_article_search (title+body per language, weighted A/B).
const SEARCH_COLUMN: Record<Language, string> = {
  en: "search_en",
  ar: "search_ar",
  sw: "search_sw",
  fr: "search_fr",
};

// Postgres regconfig used to build each language's column. Swahili has no
// built-in Postgres text search config, so it falls back to 'simple'
// (tokenize/lowercase only, no stemming) — an accepted quality tradeoff.
const TS_CONFIG: Record<Language, string> = {
  en: "english",
  ar: "arabic",
  sw: "simple",
  fr: "french",
};

export type KbSearchResult = {
  id: string;
  title: unknown;
  body: unknown;
  topic: string | null;
  rank: number;
};

export async function searchKbArticles(
  query: string,
  language: Language,
  limit = 5,
): Promise<KbSearchResult[]> {
  // column/config only ever come from the fixed lookup tables above (keyed by
  // the validated Language union), never from raw request text — Prisma.raw
  // is safe here because it can't be reached with arbitrary input.
  const column = Prisma.raw(`"${SEARCH_COLUMN[language]}"`);
  const config = TS_CONFIG[language];

  return prisma.$queryRaw<KbSearchResult[]>(Prisma.sql`
    SELECT "id", "title", "body", "topic",
      ts_rank(${column}, plainto_tsquery(${config}, ${query})) AS rank
    FROM "kb_article"
    WHERE "deletedAt" IS NULL AND ${column} @@ plainto_tsquery(${config}, ${query})
    ORDER BY rank DESC
    LIMIT ${limit}
  `);
}
