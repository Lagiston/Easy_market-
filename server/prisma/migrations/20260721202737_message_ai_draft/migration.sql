-- AlterEnum
ALTER TYPE "MessageSender" ADD VALUE 'AI_DRAFT';

-- AlterTable
ALTER TABLE "message" ADD COLUMN "sourceKbArticleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
