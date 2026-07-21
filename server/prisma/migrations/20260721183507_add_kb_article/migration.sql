-- CreateTable
CREATE TABLE "kb_article" (
    "id" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "topic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "kb_article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kb_article_topic_idx" ON "kb_article"("topic");
