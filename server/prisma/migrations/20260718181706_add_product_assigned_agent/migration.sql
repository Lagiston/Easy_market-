-- AlterTable
ALTER TABLE "product" ADD COLUMN     "assignedAgentId" TEXT;

-- CreateIndex
CREATE INDEX "product_assignedAgentId_idx" ON "product"("assignedAgentId");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
