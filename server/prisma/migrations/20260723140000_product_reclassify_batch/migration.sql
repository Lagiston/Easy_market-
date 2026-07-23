-- CreateTable
CREATE TABLE "product_reclassify_batch" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reclassify_batch_pkey" PRIMARY KEY ("id")
);
