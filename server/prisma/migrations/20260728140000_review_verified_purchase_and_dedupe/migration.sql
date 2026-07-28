-- AlterTable
ALTER TABLE "review" ADD COLUMN     "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex
DROP INDEX "review_customerId_idx";

-- CreateIndex
-- NULL customerId values are distinct, so guest reviews stay unlimited while
-- one signed-in customer can only review a given product once.
CREATE UNIQUE INDEX "review_customerId_productId_key" ON "review"("customerId", "productId");
