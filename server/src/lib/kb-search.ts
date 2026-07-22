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

  // plainto_tsquery ANDs every lexeme in the input, so a realistic multi-word
  // customer question (many of whose words won't literally appear in a
  // short KB article) matches nothing even when an article is clearly
  // relevant. Take plainto_tsquery's already-stemmed/stopword-filtered
  // output and OR the terms together instead — a standard trick for
  // natural-language-input search — then re-parse via to_tsquery. Query text
  // itself is still only ever passed as a parameterized value, never
  // interpolated into raw SQL.
  const orQuery = Prisma.sql`to_tsquery(${config}, replace(plainto_tsquery(${config}, ${query})::text, ' & ', ' | '))`;

  return prisma.$queryRaw<KbSearchResult[]>(Prisma.sql`
    SELECT "id", "title", "body", "topic",
      ts_rank(${column}, ${orQuery}) AS rank
    FROM "kb_article"
    WHERE "deletedAt" IS NULL AND ${column} @@ ${orQuery}
    ORDER BY rank DESC
    LIMIT ${limit}
  `);
}
