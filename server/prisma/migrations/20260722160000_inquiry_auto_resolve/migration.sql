-- AlterEnum
ALTER TYPE "DraftStatus" ADD VALUE 'AUTO_RESOLVED';

-- AlterTable
ALTER TABLE "inquiry" ADD COLUMN     "autoResolvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "inquiry_autoResolvedAt_idx" ON "inquiry"("autoResolvedAt");
