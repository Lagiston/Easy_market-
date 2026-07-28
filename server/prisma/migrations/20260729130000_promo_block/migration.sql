-- CreateTable
CREATE TABLE "promo_block" (
    "id" TEXT NOT NULL,
    "headline" JSONB NOT NULL,
    "copy" JSONB,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "promo_block_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promo_block_isActive_sortOrder_idx" ON "promo_block"("isActive", "sortOrder");
