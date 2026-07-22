-- AlterTable
ALTER TABLE "product" ADD COLUMN "aiSuggestedCategoryId" TEXT,
ADD COLUMN "aiSuggestedTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "aiSuggestedAt" TIMESTAMP(3);
