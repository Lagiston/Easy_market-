-- AlterTable
-- Per-language generated tsvector columns combining title (weight A) + body
-- (weight B), falling back to English content when a translation is missing.
-- Postgres ships no Swahili text search config, so search_sw uses 'simple'
-- (tokenize/lowercase only, no stemming) — a known, accepted quality gap.
ALTER TABLE "kb_article"
  ADD COLUMN "search_en" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title"->>'en', '')), 'A') ||
    setweight(to_tsvector('english', coalesce("body"->>'en', '')), 'B')
  ) STORED,
  ADD COLUMN "search_ar" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('arabic', coalesce("title"->>'ar', "title"->>'en', '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce("body"->>'ar', "body"->>'en', '')), 'B')
  ) STORED,
  ADD COLUMN "search_sw" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title"->>'sw', "title"->>'en', '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("body"->>'sw', "body"->>'en', '')), 'B')
  ) STORED,
  ADD COLUMN "search_fr" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce("title"->>'fr', "title"->>'en', '')), 'A') ||
    setweight(to_tsvector('french', coalesce("body"->>'fr', "body"->>'en', '')), 'B')
  ) STORED;

-- CreateIndex
CREATE INDEX "kb_article_search_en_idx" ON "kb_article" USING GIN ("search_en");

-- CreateIndex
CREATE INDEX "kb_article_search_ar_idx" ON "kb_article" USING GIN ("search_ar");

-- CreateIndex
CREATE INDEX "kb_article_search_sw_idx" ON "kb_article" USING GIN ("search_sw");

-- CreateIndex
CREATE INDEX "kb_article_search_fr_idx" ON "kb_article" USING GIN ("search_fr");
