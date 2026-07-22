-- AlterTable
ALTER TABLE "inquiry" ADD COLUMN     "aiConfidence" DOUBLE PRECISION,
ADD COLUMN     "aiProductId" TEXT,
ADD COLUMN     "aiTopic" TEXT,
ADD COLUMN     "aiUrgency" TEXT;

-- CreateIndex
CREATE INDEX "inquiry_aiProductId_idx" ON "inquiry"("aiProductId");

-- AddForeignKey
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_aiProductId_fkey" FOREIGN KEY ("aiProductId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
